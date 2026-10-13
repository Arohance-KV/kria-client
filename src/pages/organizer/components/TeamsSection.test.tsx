import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/slices/authSlice';
import tournamentReducer from '@/store/slices/tournamentSlice';
import registrationReducer from '@/store/slices/registrationSlice';
import teamReducer from '@/store/slices/teamSlice';
import { server } from '@/test/server';
import TeamsSection from './TeamsSection';

const API = 'https://api.kria.club';
const existing = { _id: 'tm1', name: 'Net Ninjas', owner: { name: 'Priya Nair', phone: '99001 23456' }, budget: 48500, initialBudget: 100000, tournamentId: 't1' };

const renderSection = (role = 'organizer') => {
    const store = configureStore({
        reducer: { auth: authReducer, tournament: tournamentReducer, registration: registrationReducer, team: teamReducer },
        preloadedState: {
            auth: { ...authReducer(undefined, { type: 'init' }), user: { firstName: 'Rohan', role } as never },
            tournament: { ...tournamentReducer(undefined, { type: 'init' }), currentTournament: { _id: 't1', settings: { maxTeams: 8 } } as never },
        },
    });
    server.use(
        http.get(`${API}/tournaments/t1/teams`, () => HttpResponse.json({ data: [existing] })),
        http.get(`${API}/registrations/tournaments/t1`, () => HttpResponse.json({ data: [] })),
    );
    return render(<Provider store={store}><TeamsSection tournamentId="t1" defaultBudget={100000} /></Provider>);
};

describe('TeamsSection', () => {
    it('validates required fields and leaves empty optional fields out of the create payload', async () => {
        let body: Record<string, any> | null = null;
        server.use(http.post(`${API}/tournaments/t1/teams`, async ({ request }) => {
            body = await request.json() as Record<string, any>;
            return HttpResponse.json({ data: { ...body, _id: 'tm2', tournamentId: 't1', budget: 100000, initialBudget: 100000 } });
        }));
        renderSection();

        expect(await screen.findByText('1 of 8 teams')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Add team' }));
        await userEvent.click(screen.getByRole('button', { name: 'Create team' }));
        expect(screen.getByText('Enter a team name.')).toBeInTheDocument();
        expect(screen.getByText("Enter the owner's phone number.")).toBeInTheDocument();
        expect(body).toBeNull();

        await userEvent.type(screen.getByLabelText('Team name'), 'Smash Kings');
        await userEvent.type(screen.getByLabelText('Owner name'), 'Arjun Mehta');
        await userEvent.type(screen.getByLabelText('Owner phone'), '98450 12345');
        await userEvent.click(screen.getByRole('button', { name: 'Create team' }));

        expect(await screen.findByText('2 of 8 teams')).toBeInTheDocument();
        expect(body).toMatchObject({ name: 'Smash Kings', owner: { name: 'Arjun Mehta', phone: '98450 12345' }, initialBudget: 100000 });
        expect(body).not.toHaveProperty('logo');
        expect(body).not.toHaveProperty('whatsappGroupLink');
        expect(body!.owner).not.toHaveProperty('email');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the form open and shows the server error inside it', async () => {
        server.use(http.post(`${API}/tournaments/t1/teams`, () =>
            HttpResponse.json({ message: 'Maximum team limit (8) reached.' }, { status: 400 })));
        renderSection();

        await userEvent.click(await screen.findByRole('button', { name: 'Add team' }));
        await userEvent.type(screen.getByLabelText('Team name'), 'Smash Kings');
        await userEvent.type(screen.getByLabelText('Owner name'), 'Arjun Mehta');
        await userEvent.type(screen.getByLabelText('Owner phone'), '98450 12345');
        await userEvent.click(screen.getByRole('button', { name: 'Create team' }));

        expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't create the team. Maximum team limit (8) reached.");
        expect(screen.getByRole('dialog', { name: 'Add team' })).toBeInTheDocument();
    });

    it('hides Delete team from staff', async () => {
        renderSection('staff');
        await userEvent.click(await screen.findByRole('button', { name: /Net Ninjas/ }));
        await userEvent.click(screen.getByRole('button', { name: 'More team actions' }));
        expect(await screen.findByRole('menuitem', { name: 'Reset budget' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Delete team' })).not.toBeInTheDocument();
    });
});
