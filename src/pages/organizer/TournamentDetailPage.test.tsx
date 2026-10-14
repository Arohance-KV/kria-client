import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/slices/authSlice';
import tournamentReducer from '@/store/slices/tournamentSlice';
import registrationReducer from '@/store/slices/registrationSlice';
import teamReducer from '@/store/slices/teamSlice';
import { server } from '@/test/server';
import TournamentDetailPage from './TournamentDetailPage';

const API = 'https://api.kria.club';

const tournament = (patch = {}) => ({
    _id: 't1', name: 'Monsoon Smash Open', sport: 'badminton', status: 'registration_open',
    startDate: '2026-11-01', endDate: '2026-11-02', registrationDeadline: '2026-10-14',
    venue: { name: 'Arena', city: 'Bangalore' }, staffIds: [],
    settings: { maxTeams: 8, defaultBudget: 100000, auctionType: 'manual', allowLateRegistration: false },
    ...patch,
});

const mockApi = (patch = {}) => server.use(
    // The detail endpoint includes the computed counts; status/update responses don't.
    http.get(`${API}/tournament/t1`, () => HttpResponse.json({ data: { ...tournament(patch), registeredPlayersCount: 48, teamsCount: 6 } })),
    http.get(`${API}/tournaments/t1/categories`, () => HttpResponse.json({ data: [] })),
);

const renderPage = (section = 'overview', role = 'organizer') => {
    const store = configureStore({
        reducer: { auth: authReducer, tournament: tournamentReducer, registration: registrationReducer, team: teamReducer },
        preloadedState: { auth: { ...authReducer(undefined, { type: 'init' }), user: { firstName: 'Rohan', role } as never } },
    });
    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[`/organizer/tournament/t1?section=${section}`]}>
                <Routes><Route path="/organizer/tournament/:id" element={<TournamentDetailPage />} /></Routes>
            </MemoryRouter>
        </Provider>,
    );
};

describe('TournamentDetailPage', () => {
    it('asks before advancing the lifecycle and keeps the counts afterwards', async () => {
        mockApi();
        let closed = false;
        server.use(http.post(`${API}/tournament/t1/close-registration`, () => {
            closed = true;
            return HttpResponse.json({ data: tournament({ status: 'registration_closed' }) });
        }));
        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'Close registration' }));
        expect(closed).toBe(false); // first click only asks
        await userEvent.click(screen.getByRole('button', { name: 'Yes, close registration' }));

        expect(await screen.findByRole('button', { name: 'Start auction' })).toBeInTheDocument();
        expect(closed).toBe(true);
        expect(screen.getByRole('button', { name: /Registered players/ })).toHaveTextContent('48');
    });

    it('opens old section links on the merged Details form and saves edits', async () => {
        mockApi();
        let saved: { name?: string } = {};
        server.use(http.put(`${API}/tournament/t1`, async ({ request }) => {
            saved = await request.json() as { name?: string };
            return HttpResponse.json({ data: tournament({ name: saved.name }) });
        }));
        renderPage('location');

        const name = await screen.findByLabelText('Tournament name');
        expect(screen.getByLabelText('City')).toHaveValue('Bangalore');
        expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();

        await userEvent.type(name, ' 2026');
        expect(name).toHaveFocus(); // the form must not remount while typing
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(await screen.findByText('Changes saved')).toBeInTheDocument();
        expect(saved.name).toBe('Monsoon Smash Open 2026');
    });

    it('hides the danger zone and payments from staff', async () => {
        mockApi();
        renderPage('danger', 'staff');
        expect(await screen.findByLabelText('Maximum teams')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete tournament' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Payments' })).not.toBeInTheDocument();
    });

    it('makes Teams view-only on a completed tournament and says why', async () => {
        mockApi({ status: 'completed' });
        server.use(
            http.get(`${API}/tournaments/t1/teams`, () => HttpResponse.json({ data: [
                { _id: 'tm1', name: 'Net Ninjas', owner: { name: 'Priya Nair', phone: '99001 23456' }, budget: 0, initialBudget: 100000, tournamentId: 't1' },
            ] })),
            http.get(`${API}/registrations/tournaments/t1`, () => HttpResponse.json({ data: [] })),
        );
        renderPage('teams');

        expect(await screen.findByText("Completed tournaments can't be edited.")).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add team/ })).not.toBeInTheDocument();
        await userEvent.click(await screen.findByRole('button', { name: /Net Ninjas/ })); // browsing still works
        expect(screen.getByRole('dialog', { name: 'Net Ninjas' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit team' })).not.toBeInTheDocument();
    });

    it('keeps Announcements open on a completed tournament', async () => {
        mockApi({ status: 'completed' });
        server.use(http.get(`${API}/tournaments/t1/announcements`, () => HttpResponse.json({ data: { data: [] } })));
        renderPage('announcements');

        expect((await screen.findAllByRole('button', { name: /New announcement/ })).length).toBeGreaterThan(0);
        expect(screen.queryByText(/can't be edited/)).not.toBeInTheDocument();
    });
});
