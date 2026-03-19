import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import API from '../../api/axios';

export type Role = 'player' | 'organizer';

interface User {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: string;
    [key: string]: any;
}

export interface PlayerStats {
    totalTournaments: number;
    pendingCount: number;
    approvedCount: number;
    auctionedCount: number;
    totalMatchesPlayed: number;
    totalMatchesWon: number;
    totalPointsContributed: number;
    totalEarnings: number;
    highestBid: number;
}

export interface OrganizerStats {
    totalTournaments: number;
    activeTournaments: number;
    completedTournaments: number;
    draftTournaments: number;
    totalPlayersHosted: number;
}

interface AuthState {
    user: User | null;
    role: Role | null;
    accessToken: string | null;
    isLoading: boolean;
    error: string | null;

    // Registration specific state
    registrationStep: number;
    registrationEmail: string | null;

    // Stats
    playerStats: PlayerStats | null;
    organizerStats: OrganizerStats | null;
    statsLoading: boolean;
}

const initialState: AuthState = {
    user: null,
    role: (localStorage.getItem('role') as Role) || null,
    accessToken: localStorage.getItem('accessToken') || null,
    isLoading: false,
    error: null,
    registrationStep: 1,
    registrationEmail: null,
    playerStats: null,
    organizerStats: null,
    statsLoading: false,
};

// --- ERROR HELPER ---
const extractError = (err: any) => {
    return err.response?.data?.message || err.response?.data?.error || err.message || 'Something went wrong';
};

// --- THUNKS ---

// Re-fetch logged-in user's profile (used on page refresh)
export const fetchProfile = createAsyncThunk(
    'auth/fetchProfile',
    async (_, { getState, rejectWithValue }) => {
        try {
            const state = getState() as { auth: AuthState };
            const role = state.auth.role;
            if (!role) return rejectWithValue('No role found');
            const response = await API.get(`/${role}/auth/profile`);
            const responseData = response.data?.data?.data || response.data?.data;
            return responseData;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const loginUser = createAsyncThunk(
    'auth/login',
    async ({ role, data }: { role: Role; data: any }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/${role}/auth/login`, data);
            const responseData = response.data?.data?.data || response.data?.data;
            return { role, responseData };
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const requestLoginOtp = createAsyncThunk(
    'auth/requestLoginOtp',
    async ({ role, data }: { role: Role; data: { email: string } }, { rejectWithValue }) => {
        try {
            await API.post(`/${role}/auth/login/otp`, data);
            return true;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const verifyLoginOtp = createAsyncThunk(
    'auth/verifyLoginOtp',
    async ({ role, data }: { role: Role; data: { email: string; otp: string } }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/${role}/auth/login/otp/verify`, data);
            const responseData = response.data?.data?.data || response.data?.data;
            return { role, responseData };
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Registration Step 1
export const registerUser = createAsyncThunk(
    'auth/register',
    async ({ role, data }: { role: Role; data: any }, { rejectWithValue }) => {
        try {
            await API.post(`/${role}/auth/register`, data);
            return { email: data.email };
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Registration Step 2
export const verifyOtp = createAsyncThunk(
    'auth/verifyOtp',
    async ({ role, data }: { role: Role; data: { email: string; otp: string } }, { rejectWithValue }) => {
        try {
            await API.post(`/${role}/auth/verify-otp`, data);
            return true;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Registration Step 3
export const setPassword = createAsyncThunk(
    'auth/setPassword',
    async ({ role, data }: { role: Role; data: { email: string; password: string } }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/${role}/auth/set-password`, data);
            const responseData = response.data?.data?.data || response.data?.data;
            return { role, responseData };
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Player Stats
export const fetchPlayerStats = createAsyncThunk(
    'auth/fetchPlayerStats',
    async (_, { rejectWithValue }) => {
        try {
            const response = await API.get('/player/auth/stats');
            return response.data?.data?.data || response.data?.data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Player Tournament History is in registrationSlice

// Organizer Stats
export const fetchOrganizerStats = createAsyncThunk(
    'auth/fetchOrganizerStats',
    async (_, { rejectWithValue }) => {
        try {
            const response = await API.get('/organizer/auth/stats');
            return response.data?.data?.data || response.data?.data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Player Profile Image Upload
export const uploadPlayerProfileImage = createAsyncThunk(
    'auth/uploadPlayerProfileImage',
    async (file: File, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            formData.append('image', file);
            const response = await API.put('/player/auth/profile-image', formData);
            return response.data?.data?.data || response.data?.data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Organizer Profile Image Upload
export const uploadOrganizerProfileImage = createAsyncThunk(
    'auth/uploadOrganizerProfileImage',
    async (file: File, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            formData.append('image', file);
            const response = await API.put('/organizer/auth/profile-image', formData);
            return response.data?.data?.data || response.data?.data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// Profile Update
export const updateProfile = createAsyncThunk(
    'auth/updateProfile',
    async ({ role, data }: { role: Role; data: { firstName?: string; lastName?: string; phone?: string } }, { rejectWithValue }) => {
        try {
            const response = await API.patch(`/${role}/auth/profile`, data);
            const responseData = response.data?.data?.data || response.data?.data;
            return responseData;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        logout: (state) => {
            state.user = null;
            state.role = null;
            state.accessToken = null;
            localStorage.removeItem('accessToken');
            localStorage.removeItem('role');
        },
        resetRegistration: (state) => {
            state.registrationStep = 1;
            state.registrationEmail = null;
            state.error = null;
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        const handleLoginSuccess = (state: AuthState, action: any) => {
            state.isLoading = false;
            const { role, responseData } = action.payload;
            state.role = role;
            state.user = responseData.user || responseData.player || responseData.organizer;
            state.accessToken = responseData.accessToken;
            if (state.accessToken) localStorage.setItem('accessToken', state.accessToken);
            if (state.role) localStorage.setItem('role', state.role);
        };

        // LOGIN
        builder.addCase(loginUser.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(loginUser.fulfilled, handleLoginSuccess);
        builder.addCase(loginUser.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // LOGIN OTP REQUEST
        builder.addCase(requestLoginOtp.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(requestLoginOtp.fulfilled, (state) => { state.isLoading = false; });
        builder.addCase(requestLoginOtp.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // LOGIN OTP VERIFY
        builder.addCase(verifyLoginOtp.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(verifyLoginOtp.fulfilled, handleLoginSuccess);
        builder.addCase(verifyLoginOtp.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // REGISTER
        builder.addCase(registerUser.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(registerUser.fulfilled, (state, action) => {
            state.isLoading = false;
            state.registrationStep = 2;
            state.registrationEmail = action.payload.email;
        });
        builder.addCase(registerUser.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // VERIFY OTP (REGISTRATION)
        builder.addCase(verifyOtp.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(verifyOtp.fulfilled, (state) => {
            state.isLoading = false;
            state.registrationStep = 3;
        });
        builder.addCase(verifyOtp.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // SET PASSWORD
        builder.addCase(setPassword.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(setPassword.fulfilled, (state, action) => {
            handleLoginSuccess(state, action);
            state.registrationStep = 1; // reset
            state.registrationEmail = null;
        });
        builder.addCase(setPassword.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // UPDATE PROFILE
        builder.addCase(updateProfile.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(updateProfile.fulfilled, (state, action) => {
            state.isLoading = false;
            if (state.user && action.payload) {
                state.user = { ...state.user, ...action.payload };
            }
        });
        builder.addCase(updateProfile.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // PLAYER STATS
        builder.addCase(fetchPlayerStats.pending,    (state) => { state.statsLoading = true; });
        builder.addCase(fetchPlayerStats.fulfilled,  (state, action) => { state.statsLoading = false; state.playerStats = action.payload; });
        builder.addCase(fetchPlayerStats.rejected,   (state) => { state.statsLoading = false; });

        // ORGANIZER STATS
        builder.addCase(fetchOrganizerStats.pending,    (state) => { state.statsLoading = true; });
        builder.addCase(fetchOrganizerStats.fulfilled,  (state, action) => { state.statsLoading = false; state.organizerStats = action.payload; });
        builder.addCase(fetchOrganizerStats.rejected,   (state) => { state.statsLoading = false; });

        // UPLOAD PLAYER PROFILE IMAGE
        builder.addCase(uploadPlayerProfileImage.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(uploadPlayerProfileImage.fulfilled, (state, action) => {
            state.isLoading = false;
            if (state.user && action.payload) {
                state.user = { ...state.user, ...action.payload };
            }
        });
        builder.addCase(uploadPlayerProfileImage.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // UPLOAD ORGANIZER PROFILE IMAGE
        builder.addCase(uploadOrganizerProfileImage.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(uploadOrganizerProfileImage.fulfilled, (state, action) => {
            state.isLoading = false;
            if (state.user && action.payload) {
                state.user = { ...state.user, ...action.payload };
            }
        });
        builder.addCase(uploadOrganizerProfileImage.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // FETCH PROFILE (rehydrate on refresh)
        builder.addCase(fetchProfile.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(fetchProfile.fulfilled, (state, action) => {
            state.isLoading = false;
            state.user = action.payload?.user || action.payload?.player || action.payload?.organizer || action.payload;
        });
        builder.addCase(fetchProfile.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload as string;
            // If profile fetch fails (e.g. expired token), clear auth
            state.user = null;
            state.role = null;
            state.accessToken = null;
            localStorage.removeItem('accessToken');
            localStorage.removeItem('role');
        });
    }
});

export const { logout, resetRegistration, clearError } = authSlice.actions;

export default authSlice.reducer;
