import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import API from '@/api/axios';
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

// Rejects with the SERVER's message rather than letting createAsyncThunk
// serialize the axios error, which discards `response.data.message` and leaves
// callers with "Request failed with status code 400". Shaped as an object with
// `message` so callers reading `e?.message` get the real reason.
const reason = (e: any, fallback: string) => ({ message: e?.response?.data?.message || e?.message || fallback });

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
    async ({ matchId, winnerTeamId, decision }: { matchId: string; winnerTeamId: string; decision: 'bat' | 'bowl' }, { rejectWithValue }) => {
        try {
            await cricketMatchApi.recordToss(matchId, winnerTeamId, decision);
            // Re-fetch the canonical match so cricketSetup is guaranteed fresh (phase advances
            // reliably regardless of what the POST response shape is).
            const match = await cricketMatchApi.getById(matchId);
            return { matchId, match };
        } catch (e) {
            return rejectWithValue(reason(e, 'Failed to record the toss.'));
        }
    },
);

export const recordLineup = createAsyncThunk(
    'cricketLive/recordLineup',
    async ({ matchId, payload }: { matchId: string; payload: CricketLineupPayload }, { rejectWithValue }) => {
        try {
            await cricketMatchApi.recordLineup(matchId, payload);
            const match = await cricketMatchApi.getById(matchId);
            return { matchId, match };
        } catch (e) {
            return rejectWithValue(reason(e, 'Failed to save the lineup.'));
        }
    },
);

export const recordBall = createAsyncThunk(
    'cricketLive/recordBall',
    async ({ matchId, payload }: { matchId: string; payload: BallPayload }, { rejectWithValue }) => {
        try {
            const result = await cricketMatchApi.recordBall(matchId, payload);
            return { matchId, result };
        } catch (e) {
            return rejectWithValue(reason(e, 'Failed to record the ball.'));
        }
    },
);

// The undo's refusals are specific and actionable — "No balls to undo." for a
// match completed through the manual result endpoint, or a bracket conflict —
// so they have to survive the trip (see `reason`).
export const undoLastBall = createAsyncThunk(
    'cricketLive/undoLastBall',
    async (matchId: string, { rejectWithValue }) => {
        try {
            const result = await cricketMatchApi.undoLastBall(matchId);
            return { matchId, result };
        } catch (e) {
            return rejectWithValue(reason(e, 'Failed to undo the last ball.'));
        }
    },
);

// Names the side that went through a tied knockout, then re-reads the match so
// the result card shows it without a page reload.
export const resolveTie = createAsyncThunk(
    'cricketLive/resolveTie',
    async ({ matchId, winnerTeamId }: { matchId: string; winnerTeamId: string }, { rejectWithValue }) => {
        try {
            await API.post(`/sports/cricket/match/${matchId}/resolve-tie`, { winnerTeamId });
            const match = await cricketMatchApi.getById(matchId);
            return { matchId, match };
        } catch (e) {
            return rejectWithValue(reason(e, 'Could not record who advanced.'));
        }
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
            // A refetch (socket reconnect, end of match) must not flip a loaded
            // match back to 'loading' or 'error': screens swap in a full-page
            // spinner for those, which would unmount an open wicket dialog or
            // picks not yet posted.
            .addCase(fetchMatchAndLive.pending, (state, action) => {
                const e = ensure(state, action.meta.arg);
                if (!e.match) e.status = 'loading';
            })
            .addCase(fetchMatchAndLive.fulfilled, (state, action) => {
                const e = ensure(state, action.payload.matchId);
                e.match = action.payload.match;
                e.liveState = action.payload.liveState;
                e.status = 'idle';
            })
            .addCase(fetchMatchAndLive.rejected, (state, action) => {
                const e = ensure(state, action.meta.arg);
                if (e.match) return; // keep what we have; the next push or reconnect catches up
                e.status = 'error';
                e.error = action.error.message;
            })
            .addCase(recordToss.fulfilled, (state, action) => {
                ensure(state, action.payload.matchId).match = action.payload.match;
            })
            .addCase(recordLineup.fulfilled, (state, action) => {
                ensure(state, action.payload.matchId).match = action.payload.match;
            })
            .addCase(resolveTie.fulfilled, (state, action) => {
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
