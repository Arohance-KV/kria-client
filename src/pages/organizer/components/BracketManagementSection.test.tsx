import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import registrationReducer from '@/store/slices/registrationSlice';
import { sportRegistry } from '@/sports/registry';
import { server } from '@/test/server';
import BracketManagementSection from './BracketManagementSection';

const API = 'https://api.kria.club';

// A stand-in sport, so these tests pin the host and not one sport's scoring UI.
sportRegistry.register({
    sportKey: 'testsport',
    displayName: 'Test sport',
    matchResultSection: ({ match }) => <button type="button">Score match {match.matchNumber}</button>,
});

type Cat = { _id: string; name: string; status: string; bracketType?: string; sport?: string };
const cat = (over: Partial<Cat> = {}): Cat => ({ _id: 'c1', name: "Men's Singles", status: 'auction', bracketType: 'knockout', sport: 'testsport', ...over });

const p = (id: string, name: string) => ({ registrationId: id, name, teamId: 'tm1', teamName: 'Smashers' });
const TBD = { registrationId: 'TBD', name: 'TBD', teamId: '', teamName: '' };
const draw = (status = 'scheduled') => [
    { _id: 'm1', bracketRound: 'Semi Final', roundNumber: 1, positionInRound: 0, matchNumber: 1, status, competitorType: 'player', player1: p('r1', 'Karan Patel'), player2: p('r2', 'Rohit Iyer'), nextMatchId: 'm3', nextMatchSlot: 'player1', ...(status === 'completed' ? { winnerId: 'r1' } : {}) },
    { _id: 'm2', bracketRound: 'Semi Final', roundNumber: 1, positionInRound: 1, matchNumber: 2, status: 'scheduled', competitorType: 'player', player1: p('r3', 'Manish Gowda'), player2: p('r4', 'Akash Nair'), nextMatchId: 'm3', nextMatchSlot: 'player2' },
    { _id: 'm3', bracketRound: 'Final', roundNumber: 2, positionInRound: 0, matchNumber: 3, status: 'scheduled', competitorType: 'player', player1: TBD, player2: TBD },
];
const payload = (matches: { bracketRound: string }[]) => ({
    data: {
        matches,
        rounds: matches.reduce<Record<string, unknown[]>>((r, m) => ({ ...r, [m.bracketRound]: [...(r[m.bracketRound] || []), m] }), {}),
        competitorType: 'player',
    },
});

const renderBrackets = (categories: Cat[]) => {
    const store = configureStore({
        reducer: { registration: registrationReducer },
        preloadedState: { registration: { ...registrationReducer(undefined, { type: 'init' }), categories: categories as never } },
    });
    const view = render(<Provider store={store}><BracketManagementSection tournamentId="t1" sports={['testsport']} categories={categories} /></Provider>);
    return { ...view, rerenderWith: (next: Cat[]) => view.rerender(<Provider store={store}><BracketManagementSection tournamentId="t1" sports={['testsport']} categories={next} /></Provider>) };
};

/** Matches start empty and fill in once a generate endpoint is hit. Counts each endpoint. */
const mockGeneration = () => {
    const hits = { configure: 0, generate: 0 };
    server.use(
        http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(hits.configure + hits.generate ? draw() : []))),
        http.post(`${API}/categories/c1/configure-bracket`, () => { hits.configure += 1; return HttpResponse.json({ data: {} }); }),
        http.post(`${API}/matches/generate/c1`, () => { hits.generate += 1; return HttpResponse.json({ data: {} }); }),
        http.get(`${API}/tournaments/t1/categories`, () => HttpResponse.json({ data: [] })),
    );
    return hits;
};

const confirmGenerate = async () => {
    await userEvent.click((await screen.findAllByRole('button', { name: 'Generate bracket' }))[0]);
    const bar = screen.getByRole('alertdialog', { name: 'Generate bracket' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Generate bracket' }));
};

describe('BracketManagementSection', () => {
    // configure-bracket builds the draw itself; calling generate first (as Matches did)
    // built it twice and left the status depending on which page you used.
    it('generates out of auction with configure-bracket alone, once, after asking', async () => {
        const hits = mockGeneration();
        renderBrackets([cat({ status: 'auction' })]);

        await userEvent.click((await screen.findAllByRole('button', { name: 'Generate bracket' }))[0]);
        expect(hits).toEqual({ configure: 0, generate: 0 }); // the first click only asks
        expect(screen.getByText(/The category moves to Bracket ready/)).toBeInTheDocument();
        await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Generate bracket' }));

        expect(await screen.findByRole('region', { name: 'Knockout draw' })).toBeInTheDocument();
        expect(hits).toEqual({ configure: 1, generate: 0 });
    });

    it('generates with the generate endpoint outside auction', async () => {
        const hits = mockGeneration();
        renderBrackets([cat({ status: 'registration' })]);
        await confirmGenerate();

        expect(await screen.findByRole('region', { name: 'Knockout draw' })).toBeInTheDocument();
        expect(hits).toEqual({ configure: 0, generate: 1 });
    });

    it('reshuffles round 1 only after confirming', async () => {
        let reshuffles = 0;
        server.use(
            http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(draw()))),
            http.post(`${API}/matches/reshuffle/c1`, () => { reshuffles += 1; return HttpResponse.json({ data: {} }); }),
        );
        renderBrackets([cat({ status: 'bracket_configured' })]);

        await userEvent.click(await screen.findByRole('button', { name: 'More bracket actions' }));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Reshuffle round 1' }));
        expect(reshuffles).toBe(0);
        await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reshuffle' }));

        await waitFor(() => expect(reshuffles).toBe(1));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    });

    it('locks the draw once a result is in', async () => {
        server.use(http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(draw('completed')))));
        renderBrackets([cat({ status: 'ongoing' })]);

        expect(await screen.findByText('Draw locked: results are in')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Swap players' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'More bracket actions' })).toBeNull();
    });

    it('opens a match dialog with the sport\'s scoring slot', async () => {
        server.use(http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(draw()))));
        renderBrackets([cat({ status: 'ongoing' })]);

        await userEvent.click(await screen.findByRole('button', { name: /^Match 1: Karan Patel vs Rohit Iyer/ }));
        const dialog = screen.getByRole('dialog', { name: 'Match 1 · Semi Final' });
        expect(within(dialog).getByRole('button', { name: 'Score match 1' })).toBeInTheDocument();
        expect(within(dialog).getByRole('link', { name: 'Open live scoreboard' })).toHaveAttribute('href', '/live/m1');
    });

    it('says when a match is still waiting for players', async () => {
        server.use(http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(draw()))));
        renderBrackets([cat({ status: 'ongoing' })]);

        await userEvent.click(await screen.findByRole('button', { name: /^Match 3: to be decided vs to be decided, Waiting/ }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Waiting for players/)).toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: /Score match/ })).toBeNull();
    });

    it('swaps two first-round players', async () => {
        let swapped: unknown = null;
        server.use(
            http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(draw()))),
            http.put(`${API}/matches/swap`, async ({ request }) => { swapped = await request.json(); return HttpResponse.json({ data: {} }); }),
        );
        renderBrackets([cat({ status: 'bracket_configured' })]);

        await userEvent.click(await screen.findByRole('button', { name: 'Swap players' }));
        await userEvent.click(screen.getByRole('button', { name: 'Swap Rohit Iyer' }));
        expect(screen.getByText(/Now click the player to swap with/)).toHaveTextContent('Picked Rohit Iyer.');
        await userEvent.click(screen.getByRole('button', { name: 'Swap Manish Gowda' }));

        await waitFor(() => expect(swapped).toEqual({ matchId1: 'm1', slot1: 'player2', matchId2: 'm2', slot2: 'player1' }));
    });

    it('shows a load failure as an error, not as an empty draw', async () => {
        server.use(http.get(`${API}/matches/categories/c1`, () => HttpResponse.json({ message: 'Database unavailable' }, { status: 500 })));
        renderBrackets([cat()]);

        expect(await screen.findByText(/Couldn't load the bracket\. Database unavailable/)).toBeInTheDocument();
        expect(screen.queryByText('No bracket yet')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Generate bracket' })).toBeNull();
    });

    it('selects the first non-team-league category when categories arrive late', async () => {
        server.use(http.get(`${API}/matches/categories/c2`, () => HttpResponse.json(payload([]))));
        const { rerenderWith } = renderBrackets([]);
        expect(screen.getByText('No categories yet')).toBeInTheDocument();

        rerenderWith([cat({ _id: 'c1', name: 'Team League', bracketType: 'team_league' }), cat({ _id: 'c2', name: 'Open Singles' })]);
        expect(await screen.findByText('No bracket yet')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Open Singles/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('sends team league categories to Team league', async () => {
        renderBrackets([cat({ bracketType: 'team_league', status: 'groups_configured' })]);
        expect(screen.getByText(/Team league categories are run from/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Generate bracket' })).toBeNull();
    });
});
