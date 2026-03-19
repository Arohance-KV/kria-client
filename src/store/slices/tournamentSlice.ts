import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axios';

// --- TYPES ---

export interface Tournament {
    _id: string;
    name: string;
    description?: string;
    sport: string;
    bannerImage?: string;
    startDate: string;
    endDate: string;
    venue: {
        name: string;
        address?: string;
        city: string;
        coordinates?: { lat: number; lng: number };
    };
    registrationDeadline: string;
    status: string;
    createdBy: string;
    staffIds: string[];
    settings: {
        maxTeams: number;
        defaultBudget: number;
        auctionType: string;
        allowLateRegistration: boolean;
    };
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    registeredPlayersCount?: number;
    teamsCount?: number;
}

interface TournamentState {
    myTournaments: Tournament[];
    publicTournaments: Tournament[];
    currentTournament: Tournament | null;
    isLoading: boolean;
    error: string | null;
}

const initialState: TournamentState = {
    myTournaments: [],
    publicTournaments: [],
    currentTournament: null,
    isLoading: false,
    error: null,
};

// --- ERROR HELPER ---
const extractError = (err: any) => {
    return err.response?.data?.message || err.response?.data?.error || err.message || 'Something went wrong';
};

// --- THUNKS ---

export const fetchMyTournaments = createAsyncThunk(
    'tournament/fetchMyTournaments',
    async (_, { rejectWithValue }) => {
        try {
            const response = await API.get('/tournament/organizer/my-tournaments');
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const fetchPublicTournaments = createAsyncThunk(
    'tournament/fetchPublicTournaments',
    async (params: { status?: string, sport?: string, city?: string, limit?: number } | undefined, { rejectWithValue }) => {
        try {
            let url = '/tournament';
            if (params) {
                const queryParams = new URLSearchParams();
                Object.entries(params).forEach(([key, value]) => {
                    if (value) queryParams.append(key, value.toString());
                });
                if (queryParams.toString()) url += `?${queryParams.toString()}`;
            }
            const response = await API.get(url);
            const payload = response.data?.data?.data || response.data?.data || {};
            const data = payload.tournaments || (Array.isArray(payload) ? payload : []);
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const fetchTournament = createAsyncThunk(
    'tournament/fetchTournament',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await API.get(`/tournament/${id}`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const createTournament = createAsyncThunk(
    'tournament/createTournament',
    async (tournamentData: any, { rejectWithValue }) => {
        try {
            const response = await API.post('/tournament', tournamentData);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const updateTournament = createAsyncThunk(
    'tournament/updateTournament',
    async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
        try {
            const response = await API.put(`/tournament/${id}`, data);
            const resData = response.data?.data?.data || response.data?.data;
            return resData;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const deleteTournament = createAsyncThunk(
    'tournament/deleteTournament',
    async (id: string, { rejectWithValue }) => {
        try {
            await API.delete(`/tournament/${id}`);
            return id;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// --- STATUS ACTION THUNKS ---

export const openRegistration = createAsyncThunk(
    'tournament/openRegistration',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await API.post(`/tournament/${id}/open-registration`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const closeRegistration = createAsyncThunk(
    'tournament/closeRegistration',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await API.post(`/tournament/${id}/close-registration`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const startAuction = createAsyncThunk(
    'tournament/startAuction',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await API.post(`/tournament/${id}/start-auction`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const startTournament = createAsyncThunk(
    'tournament/startTournament',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await API.post(`/tournament/${id}/start`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const completeTournament = createAsyncThunk(
    'tournament/completeTournament',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await API.post(`/tournament/${id}/complete`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const cancelTournament = createAsyncThunk(
    'tournament/cancelTournament',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await API.post(`/tournament/${id}/cancel`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const addStaff = createAsyncThunk(
    'tournament/addStaff',
    async ({ id, staffData }: { id: string; staffData: any }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/tournament/${id}/staff`, staffData);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const removeStaff = createAsyncThunk(
    'tournament/removeStaff',
    async ({ id, staffId }: { id: string; staffId: string }, { rejectWithValue }) => {
        try {
            const response = await API.delete(`/tournament/${id}/staff/${staffId}`);
            const data = response.data?.data?.data || response.data?.data;
            return data; // returns updated tournament
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

const tournamentSlice = createSlice({
    name: 'tournament',
    initialState,
    reducers: {
        clearTournamentError: (state) => {
            state.error = null;
        },
        clearCurrentTournament: (state) => {
            state.currentTournament = null;
        },
    },
    extraReducers: (builder) => {
        const handleStatusActionSuccess = (state: TournamentState, action: any) => {
            state.isLoading = false;
            const updated = action.payload;
            if (updated && updated._id) {
                state.currentTournament = updated;
                state.myTournaments = state.myTournaments.map(t =>
                    t._id === updated._id ? updated : t
                );
            }
        };

        builder.addCase(fetchMyTournaments.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(fetchMyTournaments.fulfilled, (state, action) => {
            state.isLoading = false;
            state.myTournaments = Array.isArray(action.payload) ? action.payload : [];
        });
        builder.addCase(fetchMyTournaments.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        builder.addCase(fetchPublicTournaments.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(fetchPublicTournaments.fulfilled, (state, action) => {
            state.isLoading = false;
            state.publicTournaments = Array.isArray(action.payload) ? action.payload : [];
        });
        builder.addCase(fetchPublicTournaments.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        builder.addCase(fetchTournament.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(fetchTournament.fulfilled, (state, action) => {
            state.isLoading = false;
            state.currentTournament = action.payload;
        });
        builder.addCase(fetchTournament.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        builder.addCase(createTournament.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(createTournament.fulfilled, (state, action) => {
            state.isLoading = false;
            if (action.payload) {
                state.myTournaments.unshift(action.payload);
            }
        });
        builder.addCase(createTournament.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        builder.addCase(updateTournament.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(updateTournament.fulfilled, (state, action) => {
            handleStatusActionSuccess(state, action);
        });
        builder.addCase(updateTournament.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        builder.addCase(deleteTournament.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(deleteTournament.fulfilled, (state, action) => {
            state.isLoading = false;
            state.myTournaments = state.myTournaments.filter(t => t._id !== action.payload);
            if (state.currentTournament?._id === action.payload) {
                state.currentTournament = null;
            }
        });
        builder.addCase(deleteTournament.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        const statusThunks = [openRegistration, closeRegistration, startAuction, startTournament, completeTournament, cancelTournament, addStaff, removeStaff];
        statusThunks.forEach(thunk => {
            builder.addCase(thunk.pending, (state) => { state.isLoading = true; state.error = null; });
            builder.addCase(thunk.fulfilled, handleStatusActionSuccess);
            builder.addCase(thunk.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });
        });
    },
});

export const { clearTournamentError, clearCurrentTournament } = tournamentSlice.actions;
export default tournamentSlice.reducer;
