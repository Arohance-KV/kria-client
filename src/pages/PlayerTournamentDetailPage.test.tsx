import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import authReducer from '@/store/slices/authSlice';
import tournamentReducer from '@/store/slices/tournamentSlice';
import registrationReducer from '@/store/slices/registrationSlice';
import teamReducer from '@/store/slices/teamSlice';
import { server } from '@/test/server';
import PlayerTournamentDetailPage from './PlayerTournamentDetailPage';

vi.mock('@/components/PlayerNavigation', () => ({ PlayerNavigation: () => null }));
vi.mock('@/components/HoverFooter', () => ({ default: () => null }));
vi.mock('./player-tournament/OverviewTab', () => ({ default: () => null }));

const API = 'https://api.kria.club';

// LAUNCH-AUDIT Low/Web: the Pay button worked the fee out itself and rounded differently from the charge.
describe('PlayerTournamentDetailPage', () => {
    it("shows the server's total for a paid entry, paise included, in the summary and on the Pay button", async () => {
        const quoted: (string | null)[] = [];
        server.use(
            http.get(`${API}/tournament/t1`, () => HttpResponse.json({ data: {
                _id: 't1', name: 'Monsoon Smash', status: 'registration_open', sport: 'badminton',
                startDate: '2026-12-10', endDate: '2026-12-11', registrationDeadline: '2026-12-05', venue: { name: 'Arena', city: 'Bengaluru' },
            } })),
            http.get(`${API}/tournaments/t1/categories`, () => HttpResponse.json({ data: [{ _id: 'c1', name: "Men's Singles", isPaidRegistration: true, registrationFee: 500 }] })),
            http.get(`${API}/tournaments/t1/teams`, () => HttpResponse.json({ data: [] })),
            http.get(`${API}/registrations/my-registrations`, () => HttpResponse.json({ data: [] })),
            http.get(`${API}/payments/quote`, ({ request }) => {
                quoted.push(new URL(request.url).searchParams.get('categoryId'));
                return HttpResponse.json({ data: {
                    baseAmount: 500, feeBreakdown: { razorpayFee: 10.48, platformFee: 10, gst: 3.69 }, convenienceFee: 24.17, amount: 524.17, currency: 'INR',
                } });
            }),
        );
        const player = { _id: 'p1', firstName: 'Asha', lastName: 'Rao', email: 'a@kria.test', phone: '9876543210', gender: 'female', dateOfBirth: '1998-01-01' };
        const store = configureStore({
            reducer: { auth: authReducer, tournament: tournamentReducer, registration: registrationReducer, team: teamReducer },
            preloadedState: { auth: { ...authReducer(undefined, { type: 'init' }), user: player as never, role: 'player' as const, accessToken: 't' } },
        });
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/player/tournament/t1']}>
                    <Routes><Route path="/player/tournament/:id" element={<PlayerTournamentDetailPage />} /></Routes>
                </MemoryRouter>
            </Provider>,
        );
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'categories' }));
        await user.click(await screen.findByRole('button', { name: 'Pay ₹500+ & Register' }));

        expect(await screen.findByRole('button', { name: 'Pay ₹524.17 & Register' })).toBeInTheDocument();
        expect(screen.getByText('Total').nextSibling).toHaveTextContent('₹524.17');
        expect(screen.getByText('₹24.17')).toBeInTheDocument();
        expect(quoted).toEqual(['c1']);
    });
});
