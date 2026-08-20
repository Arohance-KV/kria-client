import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api/axios';

// --- TYPES ---

export interface Category {
    _id: string;
    tournamentId: string;
    name: string;
    description?: string;
    sport?: string;
    gender: 'male' | 'female' | 'mixed';
    ageGroup: {
        min?: number;
        max?: number;
        label: string;
    };
    matchType: 'singles' | 'doubles';
    matchFormat: {
        bestOf: number;
        pointsPerGame: number;
        tieBreakPoints?: number;
    };
    bracketType: 'league' | 'knockout' | 'hybrid' | 'team_league';
    hybridConfig?: {
        leagueSize: number;
        topN: number;
    };
    teamLeagueConfig?: {
        subTeamSlots: { slotNumber: number; matchType: 'singles' | 'doubles' | 'mixed_doubles'; label: string }[];
        numberOfGroups: number;
        topNPerGroup: number;
        pointsForWin?: number;
        pointsForLoss?: number;
        pointsForDraw?: number;
    };
    isPaidRegistration: boolean;
    registrationFee: number;
    maxRegistrations?: number;
    status: 'setup' | 'registration' | 'auction' | 'groups_configured' | 'bracket_configured' | 'ongoing' | 'completed';
    isActive: boolean;
}

interface CategoryState {
    categories: Category[];
    currentCategory: Category | null;
    isLoading: boolean;
    error: string | null;
}

const initialState: CategoryState = {
    categories: [],
    currentCategory: null,
    isLoading: false,
    error: null,
};

// --- ERROR HELPER ---
const extractError = (err: any) => {
    return err.response?.data?.message || err.response?.data?.error || err.message || 'Something went wrong';
};

// --- THUNKS ---

export const fetchTournamentCategories = createAsyncThunk(
    'category/fetchTournamentCategories',
    async (tournamentId: string, { rejectWithValue }) => {
        try {
            const response = await API.get(`/tournaments/${tournamentId}/categories`);
            const data = response.data?.data?.data || response.data?.data || [];
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const fetchCategory = createAsyncThunk(
    'category/fetchCategory',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await API.get(`/categories/${id}`);
            const data = response.data?.data?.data || response.data?.data;
            return data;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const createCategory = createAsyncThunk(
    'category/createCategory',
    async ({ tournamentId, data }: { tournamentId: string; data: Partial<Category> }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/tournaments/${tournamentId}/categories`, data);
            const resData = response.data?.data?.data || response.data?.data;
            return resData;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const updateCategory = createAsyncThunk(
    'category/updateCategory',
    async ({ id, data }: { id: string; data: Partial<Category> }, { rejectWithValue }) => {
        try {
            const response = await API.put(`/categories/${id}`, data);
            const resData = response.data?.data?.data || response.data?.data;
            return resData;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const deleteCategory = createAsyncThunk(
    'category/deleteCategory',
    async (id: string, { rejectWithValue }) => {
        try {
            await API.delete(`/categories/${id}`);
            return id;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// --- STATUS ACTION THUNKS ---

const performStatusAction = async (url: string) => {
    const response = await API.post(url);
    return response.data?.data?.data || response.data?.data;
};

export const openCategoryRegistration = createAsyncThunk(
    'category/openRegistration',
    async (id: string, { rejectWithValue }) => {
        try {
            return await performStatusAction(`/categories/${id}/open-registration`);
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const startCategoryAuction = createAsyncThunk(
    'category/startAuction',
    async ({ id, tournamentId }: { id: string; tournamentId: string }, { rejectWithValue }) => {
        try {
            // Step 1: Update category status to auction
            const result = await performStatusAction(`/categories/${id}/start-auction`);
            // Step 2: Create the Auction document with player queue
            await API.post('/auction/start', { tournamentId, categoryId: id });
            return result;
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const configureCategoryBracket = createAsyncThunk(
    'category/configureBracket',
    async (id: string, { rejectWithValue }) => {
        try {
            return await performStatusAction(`/categories/${id}/configure-bracket`);
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const startCategory = createAsyncThunk(
    'category/startCategory',
    async (id: string, { rejectWithValue }) => {
        try {
            return await performStatusAction(`/categories/${id}/start`);
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

export const completeCategory = createAsyncThunk(
    'category/completeCategory',
    async (id: string, { rejectWithValue }) => {
        try {
            return await performStatusAction(`/categories/${id}/complete`);
        } catch (error) {
            return rejectWithValue(extractError(error));
        }
    }
);

// --- SLICE ---

const categorySlice = createSlice({
    name: 'category',
    initialState,
    reducers: {
        clearCategoryError: (state) => {
            state.error = null;
        },
        clearCurrentCategory: (state) => {
            state.currentCategory = null;
        },
    },
    extraReducers: (builder) => {
        const handleStatusActionSuccess = (state: CategoryState, action: any) => {
            state.isLoading = false;
            const updated = action.payload;
            if (updated && updated._id) {
                state.currentCategory = updated;
                state.categories = state.categories.map(c =>
                    c._id === updated._id ? updated : c
                );
            }
        };

        // FETCH CATEGORIES
        builder.addCase(fetchTournamentCategories.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(fetchTournamentCategories.fulfilled, (state, action) => {
            state.isLoading = false;
            state.categories = Array.isArray(action.payload) ? action.payload : [];
        });
        builder.addCase(fetchTournamentCategories.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // FETCH SINGLE CATEGORY
        builder.addCase(fetchCategory.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(fetchCategory.fulfilled, (state, action) => {
            state.isLoading = false;
            state.currentCategory = action.payload;
        });
        builder.addCase(fetchCategory.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // CREATE CATEGORY
        builder.addCase(createCategory.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(createCategory.fulfilled, (state, action) => {
            state.isLoading = false;
            if (action.payload) {
                state.categories.push(action.payload);
            }
        });
        builder.addCase(createCategory.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // UPDATE CATEGORY
        builder.addCase(updateCategory.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(updateCategory.fulfilled, handleStatusActionSuccess);
        builder.addCase(updateCategory.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        // DELETE CATEGORY
        builder.addCase(deleteCategory.pending, (state) => { state.isLoading = true; state.error = null; });
        builder.addCase(deleteCategory.fulfilled, (state, action) => {
            state.isLoading = false;
            state.categories = state.categories.filter(c => c._id !== action.payload);
            if (state.currentCategory?._id === action.payload) {
                state.currentCategory = null;
            }
        });
        builder.addCase(deleteCategory.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });

        const statusThunks = [openCategoryRegistration, startCategoryAuction, configureCategoryBracket, startCategory, completeCategory];
        statusThunks.forEach(thunk => {
            builder.addCase(thunk.pending, (state) => { state.isLoading = true; state.error = null; });
            builder.addCase(thunk.fulfilled, handleStatusActionSuccess);
            builder.addCase(thunk.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });
        });
    },
});

export const { clearCategoryError, clearCurrentCategory } = categorySlice.actions;
export default categorySlice.reducer;
