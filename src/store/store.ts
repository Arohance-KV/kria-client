import { combineReducers, configureStore, type Reducer } from '@reduxjs/toolkit';
import authReducer, { authSlice } from './slices/authSlice';
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

const appReducer = combineReducers({
    auth: authReducer,
    tournament: tournamentReducer,
    team: teamReducer,
    registration: registrationReducer,
    category: categoryReducer,
    ...sportReducers,
});

// Every sign-out (the logout thunk, a 401 on page load) is auth/logout: drop
// everything the last user loaded, entrants' phones included (LAUNCH-AUDIT M17).
// Auth's initial state holds the token read at page load; the logout case
// reducer still runs on it and clears that.
const rootReducer: typeof appReducer = (state, action) =>
    appReducer(action.type === authSlice.actions.logout.type ? undefined : state, action);

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
