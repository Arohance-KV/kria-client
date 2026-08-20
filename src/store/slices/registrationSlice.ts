import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axios';

// --- TYPES ---

export interface Category {
    _id: string;
    tournamentId: string;
    name: string;
    description?: string;
    minAge?: number;
    maxAge?: number;
    gender: 'Male' | 'Female' | 'Mixed' | 'Any';
    maxParticipants: number;
    maxRegistrations?: number;
    isPaidRegistration: boolean;
    registrationFee: number;
    status: 'draft' | 'registration_open' | 'registration_closed' | 'auction_in_progress' | 'ongoing' | 'completed';
    bracketType?: 'knockout' | 'round_robin' | 'group_knockout' | 'league' | 'hybrid' | 'team_league';
    teamLeagueConfig?: {
        subTeamSlots: { slotNumber: number; matchType: string; label: string }[];
        numberOfGroups: number;
        topNPerGroup: number;
        pointsForWin?: number;
        pointsForLoss?: number;
        pointsForDraw?: number;
    };
    matchFormat?: string;
    isActive: boolean;
}

export interface PlayerStats {
    battingStyle?: string;
    bowlingStyle?: string;
    role?: string;
    previousTeams?: string[];
    matchesPlayed?: number;
}

export interface Registration {
    _id: string;
    tournamentId: string;
    categoryId: string;
    playerId: string;
    status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'assigned' | 'auctioned';
    paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
    playerStats?: PlayerStats;
    teamId?: string;
    auctionData?: {
        basePrice?: number;
        soldPrice?: number;
        auctionedAt?: string;
    };
    stats?: {
        matchesPlayed: number;
        matchesWon: number;
        pointsContributed: number;
    };
    categoryDetails?: Category;
    tournamentDetails?: any;
    profile?: {
        firstName: string;
        lastName: string;
        age: number;
        gender: string;
        phone: string;
        skillLevel?: string;
    };
}

export interface TournamentHistoryEntry {
    _id: string;
    status: string;
    profile?: { skillLevel?: string; age?: number; gender?: string };
    auctionData?: { basePrice?: number; soldPrice?: number; auctionedAt?: string };
    stats?: { matchesPlayed: number; matchesWon: number; pointsContributed: number };
    tournament?: { _id: string; name: string; sport: string; startDate: string; endDate: string; status: string; venue?: { name: string; city: string } };
    category?: { _id: string; name: string; gender: string };
    team?: { _id: string; name: string; primaryColor?: string };
    createdAt: string;
}

interface RegistrationState {
    categories: Category[];
    myRegistrations: Registration[];
    tournamentRegistrations: Registration[];
    categoryRegistrations: Registration[];
    tournamentHistory: TournamentHistoryEntry[];
    historyLoading: boolean;
    isLoading: boolean;
    error: string | null;
}

const initialState: RegistrationState = {
    categories: [],
    myRegistrations: [],
    tournamentRegistrations: [],
    categoryRegistrations: [],
    tournamentHistory: [],
    historyLoading: false,
    isLoading: false,
    error: null,
};

// --- ERROR HELPER ---
const extractError = (err: any) => {
    return err.response?.data?.message || err.response?.data?.error || err.message || 'Something went wrong';
};

// --- THUNKS ---

// Fetch categories for a specific tournament (Public)
export const fetchTournamentCategories = createAsyncThunk(
    'registration/fetchCategories',
    async (tournamentId: string, { rejectWithValue }) => {
        try {
            const response = await API.get(`/tournaments/${tournamentId}/categories`);
            // Assuming standard API response wrapper { success, data: { data: [...] } }
            const data = response.data?.data?.data || response.data?.data || [];
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Register a player for a category (Player Only)
export const registerForCategory = createAsyncThunk(
    'registration/register',
    async (registrationData: { tournamentId: string; categoryId: string; profile: { firstName: string, lastName: string, age: number, gender: string, phone: string, skillLevel?: string } }, { rejectWithValue }) => {
        try {
            const response = await API.post('/registrations/register', registrationData);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Fetch a player's own registrations (Player Only)
export const fetchMyRegistrations = createAsyncThunk(
    'registration/fetchMyRegistrations',
    async (_, { rejectWithValue }) => {
        try {
            const response = await API.get('/registrations/my-registrations');
            const data = response.data?.data?.data || response.data?.data || [];
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Withdraw a registration (Player Only)
export const withdrawRegistration = createAsyncThunk(
    'registration/withdraw',
    async (registrationId: string, { rejectWithValue }) => {
        try {
            await API.post(`/registrations/${registrationId}/withdraw`);
            return registrationId;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Fetch player tournament history with enriched team/tournament/category details
export const fetchPlayerTournamentHistory = createAsyncThunk(
    'registration/fetchTournamentHistory',
    async (_, { rejectWithValue }) => {
        try {
            const response = await API.get('/player/auth/tournament-history');
            const data = response.data?.data?.data || response.data?.data || {};
            return Array.isArray(data.history) ? data.history : [];
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Fetch registrations by tournament (Organizer)
export const fetchRegistrationsByTournament = createAsyncThunk(
    'registration/fetchByTournament',
    async ({ tournamentId, filters }: { tournamentId: string, filters?: any }, { rejectWithValue }) => {
        try {
            const query = filters ? `?${new URLSearchParams(filters).toString()}` : '';
            const response = await API.get(`/registrations/tournaments/${tournamentId}${query}`);
            const data = response.data?.data?.data || response.data?.data || [];
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Fetch registrations by category (Public/Player View)
export const fetchRegistrationsByCategory = createAsyncThunk(
    'registration/fetchByCategory',
    async (categoryId: string, { rejectWithValue }) => {
        try {
            const response = await API.get(`/registrations/categories/${categoryId}`);
            const data = response.data?.data?.data || response.data?.data || [];
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Approve a registration (Organizer)
export const approveRegistration = createAsyncThunk(
    'registration/approve',
    async (registrationId: string, { rejectWithValue }) => {
        try {
            const response = await API.post(`/registrations/${registrationId}/approve`);
            return response.data?.data?.data || response.data?.data || registrationId;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Reject a registration (Organizer)
export const rejectRegistration = createAsyncThunk(
    'registration/reject',
    async (registrationId: string, { rejectWithValue }) => {
        try {
            const response = await API.post(`/registrations/${registrationId}/reject`);
            return response.data?.data?.data || response.data?.data || registrationId;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Manually assign (or reassign) a player to a team (Organizer)
export const manualAssignPlayer = createAsyncThunk(
    'registration/manualAssign',
    async ({ registrationId, teamId, soldPrice }: { registrationId: string; teamId: string; soldPrice?: number }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/registrations/${registrationId}/manual-assign`, { teamId, soldPrice });
            const data = response.data?.data?.data || response.data?.data;
            return { registrationId, teamId, data };
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// --- SLICE ---

const registrationSlice = createSlice({
    name: 'registration',
    initialState,
    reducers: {
        clearRegistrationError: (state) => {
            state.error = null;
        },
        clearCategories: (state) => {
            state.categories = [];
        }
    },
    extraReducers: (builder) => {
        // FETCH CATEGORIES
        builder.addCase(fetchTournamentCategories.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(fetchTournamentCategories.fulfilled, (state, action) => {
            state.isLoading = false;
            state.categories = action.payload;
        });
        builder.addCase(fetchTournamentCategories.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
        });

        // REGISTER
        builder.addCase(registerForCategory.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(registerForCategory.fulfilled, (state, action) => {
            state.isLoading = false;
            if (action.payload) {
                state.myRegistrations.unshift(action.payload);
            }
        });
        builder.addCase(registerForCategory.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
        });

        // FETCH MY REGISTRATIONS
        builder.addCase(fetchMyRegistrations.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(fetchMyRegistrations.fulfilled, (state, action) => {
            state.isLoading = false;
            state.myRegistrations = action.payload;
        });
        builder.addCase(fetchMyRegistrations.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
        });

        // WITHDRAW REGISTRATION
        builder.addCase(withdrawRegistration.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(withdrawRegistration.fulfilled, (state, action) => {
            state.isLoading = false;
            const updatedId = action.payload;
            // Optimistically update status to withdrawn
            state.myRegistrations = state.myRegistrations.map(reg =>
                reg._id === updatedId ? { ...reg, status: 'withdrawn' } : reg
            );
        });
        builder.addCase(withdrawRegistration.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
        });

        // TOURNAMENT HISTORY
        builder.addCase(fetchPlayerTournamentHistory.pending,   (state) => { state.historyLoading = true; state.error = null; });
        builder.addCase(fetchPlayerTournamentHistory.fulfilled, (state, action) => { state.historyLoading = false; state.tournamentHistory = action.payload; });
        builder.addCase(fetchPlayerTournamentHistory.rejected,  (state, action) => { state.historyLoading = false; state.error = action.payload as string; });

        // FETCH BY TOURNAMENT
        builder.addCase(fetchRegistrationsByTournament.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(fetchRegistrationsByTournament.fulfilled, (state, action) => {
            state.isLoading = false;
            state.tournamentRegistrations = action.payload;
        });
        builder.addCase(fetchRegistrationsByTournament.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
        });

        // FETCH BY CATEGORY
        builder.addCase(fetchRegistrationsByCategory.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(fetchRegistrationsByCategory.fulfilled, (state, action) => {
            state.isLoading = false;
            state.categoryRegistrations = action.payload;
        });
        builder.addCase(fetchRegistrationsByCategory.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
        });

        // APPROVE
        builder.addCase(approveRegistration.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(approveRegistration.fulfilled, (state, action) => {
            state.isLoading = false;
            const updated = action.payload;
            state.tournamentRegistrations = state.tournamentRegistrations.map(reg =>
                reg._id === (updated._id || updated) ? { ...reg, status: 'approved' } : reg
            );
        });
        builder.addCase(approveRegistration.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
        });

        // REJECT
        builder.addCase(rejectRegistration.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(rejectRegistration.fulfilled, (state, action) => {
            state.isLoading = false;
            const updated = action.payload;
            state.tournamentRegistrations = state.tournamentRegistrations.map(reg =>
                reg._id === (updated._id || updated) ? { ...reg, status: 'rejected' } : reg
            );
        });
        builder.addCase(rejectRegistration.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
        });

        // MANUAL ASSIGN
        builder.addCase(manualAssignPlayer.pending, (state) => {
            state.error = null;
        });
        builder.addCase(manualAssignPlayer.fulfilled, (state, action) => {
            const { registrationId, teamId, data } = action.payload;
            const newStatus = data?.status || 'assigned';
            state.tournamentRegistrations = state.tournamentRegistrations.map(reg =>
                reg._id === registrationId ? { ...reg, teamId, status: newStatus } : reg
            );
        });
        builder.addCase(manualAssignPlayer.rejected, (state, action) => {
            state.error = action.payload as string;
        });
    },
});

export const { clearRegistrationError, clearCategories } = registrationSlice.actions;
export default registrationSlice.reducer;
