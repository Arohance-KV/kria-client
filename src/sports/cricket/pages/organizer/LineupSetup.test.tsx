import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import cricketLiveStateReducer from '@/sports/cricket/store/cricketLiveStateSlice';
import LineupSetup from './LineupSetup';

const roster = [
    { _id: 'r1', status: 'auctioned', profile: { firstName: 'Nikhil', lastName: 'Iyer' } },
    { _id: 'r2', status: 'assigned', profile: { firstName: 'Meera', lastName: 'Reddy' } },
    { _id: 'r3', status: 'auctioned', profile: { firstName: 'Aditya', lastName: 'Nair' } },
    { _id: 'r4', status: 'approved', profile: { firstName: 'Rakesh', lastName: 'Jain' } },
];

const play = (name: string, as: 'Playing' | 'Reserve' | 'Out') =>
    userEvent.click(within(screen.getByRole('radiogroup', { name })).getByRole('radio', { name: as }));

describe('LineupSetup — the server wants exactly N players', () => {
    it('saves only an exact XI and never offers an ineligible player', async () => {
        let body: Record<string, unknown> | null = null;
        server.use(
            http.get('https://api.kria.club/registrations/teams/t1/roster', () => HttpResponse.json({ data: { data: { players: roster } } })),
            http.post('https://api.kria.club/sports/cricket/match/m1/lineup', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ data: { data: {} } });
            }),
            http.get('https://api.kria.club/sports/cricket/match/m1', () => HttpResponse.json({ data: { data: { _id: 'm1' } } })),
        );
        const store = configureStore({ reducer: { cricketLiveState: cricketLiveStateReducer } });
        render(
            <Provider store={store}>
                <LineupSetup matchId="m1" team={{ id: 't1', name: 'Knights' }} playersPerTeam={2} />
            </Provider>,
        );

        const save = await screen.findByRole('button', { name: 'Save Knights lineup' });
        expect(screen.getByText('Playing 0 / 2')).toBeInTheDocument();
        expect(save).toBeDisabled();

        // Not auctioned or assigned: shown with the reason, with nothing to pick.
        expect(screen.getByText('Not assigned to this team yet')).toBeInTheDocument();
        expect(screen.queryByRole('radiogroup', { name: 'Rakesh Jain' })).not.toBeInTheDocument();

        await play('Nikhil Iyer', 'Playing');
        await play('Meera Reddy', 'Playing');
        await play('Aditya Nair', 'Playing');
        expect(screen.getByText('Remove 1 from playing.')).toBeInTheDocument();
        expect(save).toBeDisabled();

        await play('Aditya Nair', 'Reserve');
        expect(screen.getByText('Playing 2 / 2')).toBeInTheDocument();
        expect(save).toBeEnabled();

        await userEvent.click(save);
        await waitFor(() => expect(body).toEqual({ teamId: 't1', startingXI: ['r1', 'r2'], reserves: ['r3'] }));
    });
});
