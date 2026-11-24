import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import authReducer from '@/store/slices/authSlice';
import { server } from '@/test/server';
import { ProtectedRoute } from './ProtectedRoute';

const API = 'https://api.kria.club';

// LAUNCH-AUDIT H20 review: a refresh that can't load the account (server down,
// deploy) keeps the session, but must not then show pages with no one signed in.
describe('ProtectedRoute', () => {
    it("says the account didn't load and retries, instead of showing pages with no one signed in", async () => {
        let up = false;
        server.use(
            http.get(`${API}/organizer/auth/profile`, () => (up
                ? HttpResponse.json({ data: { data: { _id: 'o1', firstName: 'Ria' } } })
                : HttpResponse.json({ message: 'Bad gateway' }, { status: 502 }))),
            http.post(`${API}/organizer/auth/refresh-token`, () => HttpResponse.json({ data: { data: { accessToken: 'tok-1' } } })),
        );
        const initial = authReducer(undefined, { type: '@@INIT' });
        const store = configureStore({ reducer: { auth: authReducer }, preloadedState: { auth: { ...initial, role: 'organizer' as const, accessToken: 'tok-1' } } });
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/organizer/home']}>
                    <Routes>
                        <Route element={<ProtectedRoute allowedRoles={['organizer']} />}>
                            <Route path="/organizer/home" element={<p>Dashboard</p>} />
                        </Route>
                    </Routes>
                </MemoryRouter>
            </Provider>,
        );

        expect(await screen.findByText("Couldn't load your account")).toBeInTheDocument();
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();

        up = true;
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    });
});
