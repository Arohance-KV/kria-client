import { configureStore, type Reducer } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import tournamentReducer from './slices/tournamentSlice';
import teamReducer from './slices/teamSlice';
import registrationReducer from './slices/registrationSlice';
import categoryReducer from './slices/categorySlice';
import { sportRegistry } from '@/sports/registry';

// Plugin reducers are merged at store-build time. main.tsx imports all sport
// plugins above this module so sportRegistry.list() is populated by now.
const sportReducers = sportRegistry.list().reduce<Record<string, Reducer>>(
    (acc, plugin) => ({ ...acc, ...(plugin.reducer ?? {}) }),
    {}
);

export const store = configureStore({
    reducer: {
        auth: authReducer,
        tournament: tournamentReducer,
        team: teamReducer,
        registration: registrationReducer,
        category: categoryReducer,
        ...sportReducers,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
