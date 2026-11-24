import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { changePassword, fetchProfile, logout } from './authSlice';
import { server } from '@/test/server';

// LAUNCH-AUDIT H1: logging out has to end the session on the server too, and
// a password change hands back the only token that still works.

const BASE = 'https://api.kria.club';
const makeStore = () => configureStore({ reducer: { auth: authReducer } });

afterEach(() => localStorage.clear());

describe('logout', () => {
    it('signs out at once and tells the server, with the token it just forgot', async () => {
        localStorage.setItem('accessToken', 'tok-1');
        localStorage.setItem('role', 'organizer');
        let sentAuth: string | null = null;
        server.use(http.post(`${BASE}/organizer/auth/logout`, ({ request }) => {
            sentAuth = request.headers.get('authorization');
            return HttpResponse.json({ data: { success: true } });
        }));
        const store = makeStore();

        store.dispatch(logout());

        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(store.getState().auth.accessToken).toBeNull();
        await vi.waitFor(() => expect(sentAuth).toBe('Bearer tok-1'));
    });

    it('still signs out when the server is unreachable', async () => {
        localStorage.setItem('accessToken', 'tok-1');
        localStorage.setItem('role', 'player');
        server.use(http.post(`${BASE}/player/auth/logout`, () => HttpResponse.error()));
        const store = makeStore();

        store.dispatch(logout());

        expect(localStorage.getItem('accessToken')).toBeNull();
    });
});

// LAUNCH-AUDIT H20: any failed profile load on a page refresh (offline, a 5xx,
// a deploy) cleared the token, and nothing renewed it, so organisers were signed out.
describe('page load (fetchProfile)', () => {
    const signedIn = () => {
        localStorage.setItem('accessToken', 'tok-1');
        localStorage.setItem('role', 'organizer');
        const initial = authReducer(undefined, { type: '@@INIT' });
        return configureStore({ reducer: { auth: authReducer }, preloadedState: { auth: { ...initial, role: 'organizer' as const, accessToken: 'tok-1' } } });
    };
    const profile = (res: () => Response) => server.use(
        http.get(`${BASE}/organizer/auth/profile`, res),
        http.post(`${BASE}/organizer/auth/refresh-token`, () => HttpResponse.json({ data: { data: { accessToken: 'tok-1' } } })),
    );

    it('keeps the session when the server fails', async () => {
        profile(() => HttpResponse.json({ message: 'Bad gateway' }, { status: 502 }));
        const store = signedIn();

        await store.dispatch(fetchProfile());

        expect(localStorage.getItem('accessToken')).toBe('tok-1');
        expect(store.getState().auth.accessToken).toBe('tok-1');
    });

    it('signs out on a 401', async () => {
        profile(() => HttpResponse.json({ message: 'Session Expired!' }, { status: 401 }));
        const store = signedIn();

        await store.dispatch(fetchProfile());

        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(store.getState().auth.accessToken).toBeNull();
    });

    it('renews the token, so an organiser who visits weekly stays signed in', async () => {
        profile(() => HttpResponse.json({ data: { data: { _id: 'o1' } } }));
        server.use(http.post(`${BASE}/organizer/auth/refresh-token`, () => HttpResponse.json({ data: { data: { accessToken: 'tok-2' } } })));
        const store = signedIn();

        await store.dispatch(fetchProfile());

        await vi.waitFor(() => expect(localStorage.getItem('accessToken')).toBe('tok-2'));
        expect(store.getState().auth.accessToken).toBe('tok-2');
    });
});

describe('changePassword', () => {
    it('keeps the new token the server hands back, since the old one now fails', async () => {
        localStorage.setItem('accessToken', 'old');
        localStorage.setItem('role', 'organizer');
        server.use(http.post(`${BASE}/organizer/auth/change-password`, () =>
            HttpResponse.json({ data: { success: true, data: { accessToken: 'new' } } })));
        const store = makeStore();

        await store.dispatch(changePassword({ role: 'organizer', data: { currentPassword: 'a', newPassword: 'b' } }));

        expect(localStorage.getItem('accessToken')).toBe('new');
        expect(store.getState().auth.accessToken).toBe('new');
    });
});
