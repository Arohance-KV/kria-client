import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { cricketMatchApi, type CricketLineupPayload, type BallPayload } from '@/sports/cricket/api/cricketMatch';

export interface MatchEntry {
    match: any | null;          // the cricket match doc (incl. cricketSetup, teams)
    liveState: any | null;      // ICricketLiveState
    matchEnded?: boolean;
    winnerId?: string;
    status: 'idle' | 'loading' | 'error';
    error?: string;
}

interface CricketLiveStateShape {
    byMatchId: Record<string, MatchEntry>;
}

const initialState: CricketLiveStateShape = { byMatchId: {} };

const ensure = (state: CricketLiveStateShape, matchId: string): MatchEntry => {
    if (!state.byMatchId[matchId]) {
        state.byMatchId[matchId] = { match: null, liveState: null, status: 'idle' };
    }
    return state.byMatchId[matchId];
};

// Fetch the match doc + live state together (console load).
export const fetchMatchAndLive = createAsyncThunk(
    'cricketLive/fetchMatchAndLive',
    async (matchId: string) => {
        const [match, liveResp] = await Promise.all([
            cricketMatchApi.getById(matchId),
            cricketMatchApi.getLiveState(matchId).catch(() => null), // live may be null pre-start
        ]);
        // getLiveState returns a wrapper { liveState, recentBalls, match }; unwrap to the
        // inner ICricketLiveState so the shape matches recordBall/socket (null pre-start).
        return { matchId, match, liveState: liveResp?.liveState ?? null };
    },
);

export const recordToss = createAsyncThunk(
    'cricketLive/recordToss',
    async ({ matchId, winnerTeamId, decision }: { matchId: string; winnerTeamId: string; decision: 'bat' | 'bowl' }) => {
        await cricketMatchApi.recordToss(matchId, winnerTeamId, decision);
        // Re-fetch the canonical match so cricketSetup is guaranteed fresh (phase advances
        // reliably regardless of what the POST response shape is).
        const match = await cricketMatchApi.getById(matchId);
        return { matchId, match };
    },
);

export const recordLineup = createAsyncThunk(
    'cricketLive/recordLineup',
    async ({ matchId, payload }: { matchId: string; payload: CricketLineupPayload }) => {
        await cricketMatchApi.recordLineup(matchId, payload);
        const match = await cricketMatchApi.getById(matchId);
        return { matchId, match };
    },
);

export const recordBall = createAsyncThunk(
    'cricketLive/recordBall',
    async ({ matchId, payload }: { matchId: string; payload: BallPayload }) => {
        const result = await cricketMatchApi.recordBall(matchId, payload);
        return { matchId, result };
    },
);

export const undoLastBall = createAsyncThunk(
    'cricketLive/undoLastBall',
    async (matchId: string) => {
        const result = await cricketMatchApi.undoLastBall(matchId);
        return { matchId, result };
    },
);

const slice = createSlice({
    name: 'cricketLiveState',
    initialState,
    reducers: {
        // Single write path for live state (also used by socket in S2).
        liveStateReceived(state, action: PayloadAction<{ matchId: string; liveState: any; match?: any }>) {
            const e = ensure(state, action.payload.matchId);
            e.liveState = action.payload.liveState;
            if (action.payload.match) e.match = action.payload.match;
            e.status = 'idle';
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMatchAndLive.pending, (state, action) => {
                ensure(state, action.meta.arg).status = 'loading';
            })
            .addCase(fetchMatchAndLive.fulfilled, (state, action) => {
                const e = ensure(state, action.payload.matchId);
                e.match = action.payload.match;
                e.liveState = action.payload.liveState;
                e.status = 'idle';
            })
            .addCase(fetchMatchAndLive.rejected, (state, action) => {
                const e = ensure(state, action.meta.arg);
                e.status = 'error';
                e.error = action.error.message;
            })
            .addCase(recordToss.fulfilled, (state, action) => {
                ensure(state, action.payload.matchId).match = action.payload.match;
            })
            .addCase(recordLineup.fulfilled, (state, action) => {
                ensure(state, action.payload.matchId).match = action.payload.match;
            })
            .addCase(recordBall.fulfilled, (state, action) => {
                const e = ensure(state, action.payload.matchId);
                const r = action.payload.result || {};
                if (r.liveState) e.liveState = r.liveState;
                e.matchEnded = !!r.matchEnded;
                e.winnerId = r.winnerId;
                e.status = 'idle';
            })
            .addCase(undoLastBall.fulfilled, (state, action) => {
                const e = ensure(state, action.payload.matchId);
                const r = action.payload.result || {};
                if (r.liveState) e.liveState = r.liveState;
                e.matchEnded = false;
                e.status = 'idle';
            });
    },
});

export const { liveStateReceived } = slice.actions;
export default slice.reducer;

// Typed selector — RootState is static (Stream 1), so cricket selects via a loose cast.
export const selectMatchEntry = (matchId: string) => (root: any): MatchEntry | undefined =>
    root.cricketLiveState?.byMatchId?.[matchId];
