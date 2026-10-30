import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import registrationReducer from '@/store/slices/registrationSlice';
import { sportRegistry } from '@/sports/registry';
import { server } from '@/test/server';
import { ReadOnlyContext } from '../ui';
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

const renderBrackets = (categories: Cat[], readOnly = false) => {
    const store = configureStore({
        reducer: { registration: registrationReducer },
        preloadedState: { registration: { ...registrationReducer(undefined, { type: 'init' }), categories: categories as never } },
    });
    const tree = (cats: Cat[]) => (
        <Provider store={store}>
            <ReadOnlyContext.Provider value={readOnly}><BracketManagementSection tournamentId="t1" sports={['testsport']} categories={cats} /></ReadOnlyContext.Provider>
        </Provider>
    );
    const view = render(tree(categories));
    return { ...view, rerenderWith: (next: Cat[]) => view.rerender(tree(next)) };
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

    it('opens matches without draw or scoring actions when the tournament is locked', async () => {
        server.use(
            http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(draw()))),
            http.get(`${API}/matches/categories/c2`, () => HttpResponse.json(payload([]))),
        );
        renderBrackets([cat({ status: 'bracket_configured' }), cat({ _id: 'c2', name: 'Open Singles' })], true);

        await userEvent.click(await screen.findByRole('button', { name: /^Match 1: Karan Patel vs Rohit Iyer/ }));
        const dialog = screen.getByRole('dialog', { name: 'Match 1 · Semi Final' });
        expect(within(dialog).queryByRole('button', { name: /Score match/ })).toBeNull();
        expect(within(dialog).getByRole('link', { name: 'Open live scoreboard' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Swap players' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'More bracket actions' })).toBeNull();

        await userEvent.keyboard('{Escape}');
        await userEvent.click(screen.getByRole('tab', { name: /Open Singles/ }));
        expect(await screen.findByText('No bracket yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Generate bracket' })).toBeNull();
    });
});

// ── Doubles: the draw is built from pairs ──────────────────────────────────────
const pl = (registrationId: string, name: string, teamId: string, partnerRegistrationId: string | null = null) =>
    ({ registrationId, name, teamId, partnerRegistrationId });
const pairState = (over: Record<string, unknown> = {}) => ({
    players: [
        pl('a', 'Asha Rao', 't1', 'b'), pl('b', 'Priya Nair', 't1', 'a'),
        pl('d', 'Rohan Desai', 't2', 'e'), pl('e', 'Vikram Rao', 't2', 'd'),
        pl('g', 'Rahul Pillai', 't2'),
    ],
    teams: [{ _id: 't1', name: 'Smashers' }, { _id: 't2', name: 'Kings' }],
    drawn: false, locked: false, sideIds: [],
    ...over,
});
const doubles = (over: Partial<Cat> & { matchType?: string } = {}) => cat({ name: "Men's Doubles", status: 'registration', matchType: 'doubles', ...over } as Partial<Cat>);

describe('BracketManagementSection, doubles before the draw', () => {
    it('shows the pairing panel instead of the empty draw', async () => {
        server.use(
            http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload([]))),
            http.get(`${API}/registrations/categories/c1/pairs`, () => HttpResponse.json({ data: { data: pairState() } })),
        );
        renderBrackets([doubles()]);
        expect(await screen.findByRole('region', { name: 'Smashers' })).toBeInTheDocument();
        expect(screen.queryByText('No bracket yet')).toBeNull();
    });

    it('keeps Generate off with fewer than two pairs', async () => {
        server.use(
            http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload([]))),
            http.get(`${API}/registrations/categories/c1/pairs`, () => HttpResponse.json({ data: { data: pairState({
                players: [pl('a', 'Asha Rao', 't1', 'b'), pl('b', 'Priya Nair', 't1', 'a'), pl('g', 'Rahul Pillai', 't2')],
            }) } })),
        );
        renderBrackets([doubles()]);
        await screen.findByRole('region', { name: 'Smashers' });
        expect(screen.getByRole('button', { name: 'Generate bracket' })).toBeDisabled();
    });

    it('names the unpaired players when asking to generate', async () => {
        server.use(
            http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload([]))),
            http.get(`${API}/registrations/categories/c1/pairs`, () => HttpResponse.json({ data: { data: pairState() } })),
        );
        renderBrackets([doubles()]);
        await screen.findByRole('region', { name: 'Smashers' });
        await userEvent.click(screen.getByRole('button', { name: 'Generate bracket' }));
        expect(within(screen.getByRole('alertdialog', { name: 'Generate bracket' }))
            .getByText("Generate the draw for Men's Doubles? 2 pairs are placed at random. Unpaired, so not in the draw: Rahul Pillai (Kings).")).toBeInTheDocument();
    });
});

describe('BracketManagementSection, doubles after the draw', () => {
    /** A doubles draw with no results; counts bracket loads, pair writes and redraws. */
    const mockDrawn = (pairs = pairState({ drawn: true, sideIds: ['a', 'd'] }), matches = draw()) => {
        const hits = { loads: 0, generate: 0, writes: 0, categories: 0 };
        server.use(
            http.get(`${API}/matches/categories/c1`, () => { hits.loads += 1; return HttpResponse.json(payload(matches)); }),
            http.get(`${API}/registrations/categories/c1/pairs`, () => HttpResponse.json({ data: { data: pairs } })),
            http.put(`${API}/registrations/:id/partner`, () => { hits.writes += 1; return HttpResponse.json({ data: { data: pairs } }); }),
            http.post(`${API}/matches/generate/c1`, () => { hits.generate += 1; return HttpResponse.json({ data: {} }); }),
            http.get(`${API}/tournaments/t1/categories`, () => { hits.categories += 1; return HttpResponse.json({ data: [] }); }),
        );
        return hits;
    };

    it('Edit pairs opens the pairing panel above the draw', async () => {
        mockDrawn();
        renderBrackets([doubles({ status: 'bracket_configured' })]);
        await userEvent.click(await screen.findByRole('button', { name: 'Edit pairs' }));
        expect(await screen.findByRole('region', { name: 'Smashers' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Knockout draw' })).toBeInTheDocument();
    });

    it('calls the swap toggle Swap pairs', async () => {
        mockDrawn();
        renderBrackets([doubles({ status: 'bracket_configured' })]);
        expect(await screen.findByRole('button', { name: 'Swap pairs' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Swap players' })).toBeNull();
    });

    it('redoes the draw from the More menu after asking, then reloads it', async () => {
        const hits = mockDrawn();
        renderBrackets([doubles({ status: 'bracket_configured' })]);
        await userEvent.click(await screen.findByRole('button', { name: 'More bracket actions' }));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Redo draw' }));
        const bar = screen.getByRole('alertdialog', { name: 'Redo draw' });
        expect(within(bar).getByText("Redo the draw for Men's Doubles? It's rebuilt from the current pairs and placed at random.")).toBeInTheDocument();
        expect(hits.generate).toBe(0);
        const before = hits.loads;
        await userEvent.click(within(bar).getByRole('button', { name: 'Redo draw' }));
        await waitFor(() => expect(hits.generate).toBe(1));
        await waitFor(() => expect(hits.loads).toBeGreaterThan(before));
        // The category's status is the server's call; the tabs must re-read it.
        await waitFor(() => expect(hits.categories).toBe(1));
    });

    it('says so when the pairs no longer match the draw, with its own Redo draw', async () => {
        mockDrawn(pairState({ drawn: true, sideIds: ['a', 'd', 'g'] }));
        renderBrackets([doubles({ status: 'bracket_configured' })]);
        const notice = await screen.findByText("The draw doesn't match the pairs any more, so its matches can't be scored. Redo draw to rebuild it.");
        await userEvent.click(within(notice.parentElement!).getByRole('button', { name: 'Redo draw' }));
        expect(screen.getByRole('alertdialog', { name: 'Redo draw' })).toBeInTheDocument();
    });

    it('reloads the draw after a partner change, since its names change', async () => {
        const hits = mockDrawn();
        renderBrackets([doubles({ status: 'bracket_configured' })]);
        await userEvent.click(await screen.findByRole('button', { name: 'Edit pairs' }));
        await screen.findByRole('region', { name: 'Kings' });
        const before = hits.loads;
        await userEvent.click(screen.getByRole('button', { name: 'Rohan Desai' }));
        await userEvent.click(screen.getByRole('button', { name: 'Rahul Pillai' }));
        await waitFor(() => expect(hits.writes).toBe(1));
        await waitFor(() => expect(hits.loads).toBeGreaterThan(before));
    });

    it('offers neither Edit pairs nor Redo draw once a result is in', async () => {
        mockDrawn(pairState({ drawn: true, locked: true, sideIds: ['a', 'd'] }), draw('completed'));
        renderBrackets([doubles({ status: 'ongoing' })]);
        await screen.findByRole('region', { name: 'Knockout draw' });
        expect(screen.queryByRole('button', { name: 'Edit pairs' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'More bracket actions' })).toBeNull();
    });

    it('leaves singles as it was', async () => {
        server.use(http.get(`${API}/matches/categories/c1`, () => HttpResponse.json(payload(draw()))));
        renderBrackets([cat({ status: 'bracket_configured' })]);
        expect(await screen.findByRole('button', { name: 'Swap players' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit pairs' })).toBeNull();
    });
});
