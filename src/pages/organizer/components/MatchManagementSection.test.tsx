import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import registrationReducer from '@/store/slices/registrationSlice';
import { sportRegistry } from '@/sports/registry';
import { server } from '@/test/server';
import { SectionNavContext } from '../ui';
import MatchManagementSection from './MatchManagementSection';

const API = 'https://api.kria.club';

sportRegistry.register({
    sportKey: 'matchsport',
    displayName: 'Match sport',
    matchResultSection: ({ match }) => <button type="button">Score match {match.matchNumber}</button>,
});

type Cat = { _id: string; name: string; status: string; bracketType?: string; sport?: string };
const cat = (over: Partial<Cat> = {}): Cat => ({ _id: 'c1', name: "Men's Singles", status: 'ongoing', bracketType: 'knockout', sport: 'matchsport', ...over });

const p = (id: string, name: string) => ({ registrationId: id, name, teamId: 'tm1', teamName: 'Smashers' });
const TBD = { registrationId: 'TBD', name: 'TBD', teamId: '', teamName: '' };
const matches = [
    { _id: 'm1', bracketRound: 'Semi Final', roundNumber: 1, matchNumber: 1, status: 'completed', winnerId: 'r1', player1: p('r1', 'Karan Patel'), player2: p('r2', 'Rohit Iyer'), result: { team1Total: 2, team2Total: 0 }, gameScores: [{ gameNumber: 1, team1Score: 21, team2Score: 15 }, { gameNumber: 2, team1Score: 21, team2Score: 12 }] },
    { _id: 'm2', bracketRound: 'Semi Final', roundNumber: 1, matchNumber: 2, status: 'in_progress', player1: p('r3', 'Manish Gowda'), player2: p('r4', 'Akash Nair') },
    { _id: 'bye', bracketRound: 'Semi Final', roundNumber: 1, matchNumber: 9, status: 'walkover', winReason: 'bye', player1: p('r5', 'Bye Holder'), player2: TBD },
    { _id: 'm3', bracketRound: 'Final', roundNumber: 2, matchNumber: 3, status: 'scheduled', player1: p('r1', 'Karan Patel'), player2: TBD },
];
const payload = (ms: { bracketRound: string }[], competitorType = 'player') => ({
    data: { matches: ms, rounds: ms.reduce<Record<string, unknown[]>>((r, m) => ({ ...r, [m.bracketRound]: [...(r[m.bracketRound] || []), m] }), {}), competitorType },
});

const renderMatches = (categories: Cat[], goTo = vi.fn()) => {
    const store = configureStore({
        reducer: { registration: registrationReducer },
        preloadedState: { registration: { ...registrationReducer(undefined, { type: 'init' }), categories: categories as never } },
    });
    render(
        <Provider store={store}>
            <SectionNavContext.Provider value={goTo}>
                <MatchManagementSection tournamentId="t1" sports={['matchsport']} categories={categories} />
            </SectionNavContext.Provider>
        </Provider>,
    );
    return { goTo };
};

const rows = () => screen.getAllByRole('listitem');

describe('MatchManagementSection', () => {
    it('filters matches by status and hides byes', async () => {
        server.use(http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(matches))));
        renderMatches([cat()]);

        expect(await screen.findAllByRole('listitem')).toHaveLength(3); // the bye is not a match
        expect(screen.getByRole('button', { name: /^All/ })).toHaveTextContent('All3');
        expect(screen.getByRole('button', { name: /^Upcoming/ })).toHaveTextContent('Upcoming1');

        await userEvent.click(screen.getByRole('button', { name: /^Live/ }));
        expect(rows()).toHaveLength(1);
        expect(rows()[0]).toHaveTextContent('Manish Gowda');
        expect(within(rows()[0]).getByRole('button', { name: 'Score match 2' })).toBeInTheDocument();
        expect(within(rows()[0]).getByRole('link', { name: 'Open live scoreboard' })).toHaveAttribute('href', '/live/m2');

        await userEvent.click(screen.getByRole('button', { name: /^Completed/ }));
        expect(rows()).toHaveLength(1);
        expect(rows()[0]).toHaveTextContent('21–15, 21–12');

        await userEvent.click(screen.getByRole('button', { name: /^Upcoming/ }));
        expect(rows()[0]).toHaveTextContent('To be decided');
        expect(rows()[0]).toHaveTextContent('Waiting for players');
        expect(within(rows()[0]).queryByRole('button', { name: /Score match/ })).toBeNull();
    });

    it('leaves team league out and sends bracket generation to Brackets', async () => {
        server.use(http.get(`${API}/matches/categories/c2`, () => HttpResponse.json(payload([]))));
        const { goTo } = renderMatches([cat({ _id: 'c1', name: 'Team League', bracketType: 'team_league' }), cat({ _id: 'c2', name: 'Open Singles' })]);

        expect(await screen.findByText('Generate the bracket in Brackets.')).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /Team League/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Generate bracket/i })).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Open Brackets' }));
        expect(goTo).toHaveBeenCalledWith('brackets');
    });

    it('shows a cricket result margin instead of a bare dash', async () => {
        const cricket = [{
            _id: 'k1', bracketRound: 'Final', roundNumber: 1, matchNumber: 1, status: 'completed', winnerId: 'tA',
            teams: { team1Id: 'tA', team1Name: 'Royal Strikers', team2Id: 'tB', team2Name: 'Coastal Kings' },
            result: { marginOfVictory: 'Won by 23 runs' },
        }];
        server.use(http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(cricket, 'team'))));
        renderMatches([cat()]);

        const [row] = await screen.findAllByRole('listitem');
        expect(row).toHaveTextContent('Won by 23 runs');
        expect(row.textContent).not.toMatch(/\s-\s/);
    });

    it('shows a load failure as an error', async () => {
        server.use(http.get(`${API}/matches/categories/c1`, () => HttpResponse.json({ message: 'Database unavailable' }, { status: 500 })));
        renderMatches([cat()]);
        expect(await screen.findByText(/Couldn't load matches\. Database unavailable/)).toBeInTheDocument();
        expect(screen.queryByText('No fixtures yet')).toBeNull();
    });
});
