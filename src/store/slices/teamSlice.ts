import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axios';

// --- TYPES ---
export interface Team {
    _id: string;
    name: string;
    /** Where the full name won't fit in the player app (SERVER-GAPS #21). */
    shortName?: string;
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    owner: {
        name: string;
        phone: string;
        email?: string;
    };
    captainId?: string;
    whatsappGroupLink?: string;
    tournamentId: string;
    budget: number;
    initialBudget: number;
    spent: number;
    remainingBudget: number;
    isActive: boolean;
    playersCount?: number;
    createdAt: string;
    updatedAt: string;
}

interface TeamState {
    teams: Team[];
    isLoading: boolean;
    error: string | null;
}

const initialState: TeamState = {
    teams: [],
    isLoading: false,
    error: null,
};

// --- ERROR HELPER ---
const extractError = (err: any) => {
    return err.response?.data?.message || err.response?.data?.error || err.message || 'Something went wrong';
};

// --- THUNKS ---

export const fetchTournamentTeams = createAsyncThunk(
    'team/fetchTournamentTeams',
    async (tournamentId: string, { rejectWithValue }) => {
        try {
            const response = await API.get(`/tournaments/${tournamentId}/teams`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const createTeam = createAsyncThunk(
    'team/createTeam',
    async ({ tournamentId, teamData }: { tournamentId: string; teamData: any }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/tournaments/${tournamentId}/teams`, teamData);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const updateTeam = createAsyncThunk(
    'team/updateTeam',
    async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
        try {
            const response = await API.put(`/teams/${id}`, data);
            const resData = response.data?.data?.data || response.data?.data;
            return resData;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const deleteTeam = createAsyncThunk(
    'team/deleteTeam',
    async (id: string, { rejectWithValue }) => {
        try {
            await API.delete(`/teams/${id}`);
            return id;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const updateTeamBudget = createAsyncThunk(
    'team/updateTeamBudget',
    async ({ id, amount }: { id: string; amount: number }, { rejectWithValue }) => {
        try {
            const response = await API.put(`/teams/${id}/budget`, { budget: amount });
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const searchPlayerByEmail = createAsyncThunk(
    'team/searchPlayerByEmail',
    async (email: string, { rejectWithValue }) => {
        try {
            const response = await API.get(`/players/search-by-email?email=${encodeURIComponent(email)}`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const resetTeamBudget = createAsyncThunk(
    'team/resetTeamBudget',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await API.post(`/teams/${id}/reset-budget`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// --- SLICE ---
const teamSlice = createSlice({
    name: 'team',
    initialState,
    reducers: {
        clearTeamError: (state) => {
            state.error = null;
        },
        clearTeams: (state) => {
            state.teams = [];
        }
    },
    extraReducers: (builder) => {
        // FETCH
        builder.addCase(fetchTournamentTeams.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(fetchTournamentTeams.fulfilled, (state, action) => {
            state.isLoading = false;
            state.teams = Array.isArray(action.payload) ? action.payload : [];
        });
        builder.addCase(fetchTournamentTeams.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // CREATE
        builder.addCase(createTeam.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(createTeam.fulfilled, (state, action) => {
            state.isLoading = false;
            if (action.payload) {
                state.teams.push(action.payload);
            }
        });
        builder.addCase(createTeam.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // UPDATE
        const updateThunks = [updateTeam, updateTeamBudget, resetTeamBudget];
        updateThunks.forEach(thunk => {
            builder.addCase(thunk.pending, (state) => { state.isLoading = true; state.error = null; });
            builder.addCase(thunk.fulfilled, (state, action) => {
                state.isLoading = false;
                const updated = action.payload;
                if (updated && updated._id) {
                    state.teams = state.teams.map(t => t._id === updated._id ? updated : t);
                }
            });
            builder.addCase(thunk.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });
        });

        // DELETE
        builder.addCase(deleteTeam.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(deleteTeam.fulfilled, (state, action) => {
            state.isLoading = false;
            state.teams = state.teams.filter(t => t._id !== action.payload);
        });
        builder.addCase(deleteTeam.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });
    }
});

export const { clearTeamError, clearTeams } = teamSlice.actions;
export default teamSlice.reducer;
