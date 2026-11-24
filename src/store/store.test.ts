import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';

// Signed in when the page loaded, so the auth slice's initial state holds this token.
vi.hoisted(() => {
    localStorage.setItem('accessToken', 'tok-1');
    localStorage.setItem('role', 'organizer');
});

// Plugins before the store, as in main.tsx.
import '@/sports/badminton';
import '@/sports/cricket';
import { store } from './store';
import { fetchProfile, logout } from './slices/authSlice';

const BASE = 'https://api.kria.club';
const initial = store.getState();
const signedOut = { ...initial, auth: { ...initial.auth, role: null, accessToken: null } };

const loadOrganiserData = () => {
    store.dispatch({ type: 'auth/login/fulfilled', payload: { role: 'organizer', responseData: { organizer: { _id: 'o1', phone: '9000000001' }, accessToken: 'tok-1' } } });
    store.dispatch({ type: 'auth/fetchOrganizerStats/fulfilled', payload: { totalTournaments: 2 } });
    store.dispatch({ type: 'tournament/fetchMyTournaments/fulfilled', payload: [{ _id: 't1' }] });
    store.dispatch({ type: 'registration/fetchByTournament/fulfilled', payload: [{ _id: 'r1', player: { phone: '9876543210' } }] });
    store.dispatch({ type: 'team/fetchTournamentTeams/fulfilled', payload: [{ _id: 'tm1', owner: { phone: '9000000002' } }] });
    store.dispatch({ type: 'category/fetchCategory/fulfilled', payload: { _id: 'c1' } });
    store.dispatch({ type: 'cricketLiveState/liveStateReceived', payload: { matchId: 'm1', liveState: { over: 3 } } });
};

// LAUNCH-AUDIT M17: logging out left the last user's data, entrants' phones included, in memory for the next one.
describe('ending a session resets the whole store', () => {
    it('on logout, and comes out signed out though auth read storage at load', () => {
        server.use(http.post(`${BASE}/organizer/auth/logout`, () => HttpResponse.json({})));
        loadOrganiserData();
        expect(store.getState()).not.toEqual(signedOut);

        store.dispatch(logout());

        expect(store.getState()).toEqual(signedOut);
        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(localStorage.getItem('role')).toBeNull();
    });

    it('on a 401 when the page loads (an expired or revoked session)', async () => {
        server.use(http.get(`${BASE}/organizer/auth/profile`, () => HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })));
        loadOrganiserData();

        await store.dispatch(fetchProfile());

        // fetchProfile.rejected lands after the reset and records its own failure.
        expect(store.getState()).toEqual({ ...signedOut, auth: { ...signedOut.auth, error: 'Unauthorized' } });
    });
});
