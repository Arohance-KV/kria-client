import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axios';

// --- TYPES ---

export interface MatchTeams {
    team1Id: string;
    team2Id: string;
    team1Name: string;
    team2Name: string;
}

export interface MatchSchedule {
    date?: string;
    time?: string;
    court?: string;
    venue?: string;
}

export interface GameScore {
    gameNumber: number;
    team1Score: number;
    team2Score: number;
    winnerId?: string;
}

export interface MatchResult {
    team1Summary?: string;
    team2Summary?: string;
    team1Total?: number;
    team2Total?: number;
    marginOfVictory?: string;
}

export interface PlayerCompetitor {
    registrationId: string;
    name: string;
    teamId: string;
    teamName: string;
}

export interface Match {
    _id: string;
    tournamentId: string;
    categoryId: string;
    sportType: string;
    competitorType?: 'player' | 'team';
    bracketRound: string;
    matchNumber: number;
    roundNumber?: number;
    positionInRound?: number;
    nextMatchId?: string;
    nextMatchSlot?: string;
    teams: MatchTeams;
    player1?: PlayerCompetitor;
    player2?: PlayerCompetitor;
    schedule?: MatchSchedule;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'walkover';
    gameScores: GameScore[];
    setScores: any[];
    periodScores: any[];
    inningsScores: any[];
    matchConfig?: {
        bestOf?: number;
        pointsToWin?: number;
        maxOvers?: number;
        periodMinutes?: number;
        numberOfPeriods?: number;
        gamesPerSeries?: number;
    };
    result?: MatchResult;
    winnerId?: string;
    winReason?: string;
    recordedBy?: string;
    lockedAt?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface MatchState {
    matches: Match[];
    rounds: Record<string, Match[]>;
    currentMatch: Match | null;
    isLoading: boolean;
    error: string | null;
}

const initialState: MatchState = {
    matches: [],
    rounds: {},
    currentMatch: null,
    isLoading: false,
    error: null,
};

const extractError = (err: any) =>
    err.response?.data?.message || err.response?.data?.error || err.message || 'Something went wrong';

// --- THUNKS ---

export const fetchMatchesByCategory = createAsyncThunk(
    'match/fetchByCategory',
    async (categoryId: string, { rejectWithValue }) => {
        try {
            const res = await API.get(`/matches/categories/${categoryId}`);
            const payload = res.data?.data?.data || res.data?.data || {};
            return {
                matches: payload.matches || [],
                rounds: payload.rounds || {},
            };
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const fetchMatchById = createAsyncThunk(
    'match/fetchById',
    async (matchId: string, { rejectWithValue }) => {
        try {
            const res = await API.get(`/matches/${matchId}`);
            return res.data?.data?.data || res.data?.data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const generateBracket = createAsyncThunk(
    'match/generateBracket',
    async (categoryId: string, { rejectWithValue }) => {
        try {
            const res = await API.post(`/matches/generate/${categoryId}`);
            const payload = res.data?.data?.data || res.data?.data || {};
            return {
                matches: payload.matches || [],
                bracketType: payload.bracketType,
            };
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const recordMatchResult = createAsyncThunk(
    'match/recordResult',
    async ({ matchId, ...resultData }: { matchId: string; winnerId: string; gameScores?: any[]; result?: MatchResult; winReason?: string }, { rejectWithValue }) => {
        try {
            const res = await API.post(`/matches/${matchId}/result`, resultData);
            return res.data?.data?.data || res.data?.data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const updateMatchSchedule = createAsyncThunk(
    'match/updateSchedule',
    async ({ matchId, ...schedule }: { matchId: string; date?: string; time?: string; court?: string; venue?: string }, { rejectWithValue }) => {
        try {
            const res = await API.put(`/matches/${matchId}/schedule`, schedule);
            return res.data?.data?.data || res.data?.data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// --- SLICE ---

const matchSlice = createSlice({
    name: 'match',
    initialState,
    reducers: {
        clearMatches: (state) => {
            state.matches = [];
            state.rounds = {};
            state.currentMatch = null;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        // fetchByCategory
        builder.addCase(fetchMatchesByCategory.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(fetchMatchesByCategory.fulfilled, (state, action) => {
            state.isLoading = false;
            state.matches = action.payload.matches;
            state.rounds = action.payload.rounds;
        });
        builder.addCase(fetchMatchesByCategory.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // fetchById
        builder.addCase(fetchMatchById.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(fetchMatchById.fulfilled, (state, action) => { state.isLoading = false; state.currentMatch = action.payload; });
        builder.addCase(fetchMatchById.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // generateBracket
        builder.addCase(generateBracket.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(generateBracket.fulfilled, (state, action) => {
            state.isLoading = false;
            state.matches = action.payload.matches;
        });
        builder.addCase(generateBracket.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // recordResult
        builder.addCase(recordMatchResult.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(recordMatchResult.fulfilled, (state, action) => {
            state.isLoading = false;
            const updated = action.payload;
            state.matches = state.matches.map(m => m._id === updated._id ? updated : m);
        });
        builder.addCase(recordMatchResult.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // updateSchedule
        builder.addCase(updateMatchSchedule.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(updateMatchSchedule.fulfilled, (state, action) => {
            state.isLoading = false;
            const updated = action.payload;
            state.matches = state.matches.map(m => m._id === updated._id ? updated : m);
        });
        builder.addCase(updateMatchSchedule.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });
    },
});

export const { clearMatches } = matchSlice.actions;
export default matchSlice.reducer;
