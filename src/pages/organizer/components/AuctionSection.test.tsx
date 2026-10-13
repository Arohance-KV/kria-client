import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import registrationReducer from '@/store/slices/registrationSlice';
import { server } from '@/test/server';
import AuctionSection from './AuctionSection';

// The section talks to the shared socket.io client; record what it sends and let tests push updates.
const sock = vi.hoisted(() => {
    const handlers: Record<string, (d: unknown) => void> = {};
    return {
        handlers, connected: false,
        connect: vi.fn(() => handlers.connect?.(undefined)), disconnect: vi.fn(), emit: vi.fn(),
        on: vi.fn((e: string, f: (d: unknown) => void) => { handlers[e] = f; }),
        off: vi.fn(),
    };
});
vi.mock('@/lib/socket', () => ({ socket: sock }));

const API = 'https://api.kria.club';
const ok = (data: unknown) => HttpResponse.json({ data: { data } });
const fail = (message: string) => HttpResponse.json({ message }, { status: 400 });

const team = (_id: string, name: string, budget: number) =>
    ({ _id, name, primaryColor: '#38BDF8', budget, initialBudget: 100000, playersCount: 7, totalSpent: 100000 - budget });
const TEAMS = [
    team('t1', 'Koramangala Kings', 62000), team('t2', 'Indiranagar Smashers', 54000),
    team('t3', 'HSR Hawks', 71000), team('t4', 'Whitefield Warriors', 8000),
];
const LIVE_BID = {
    currentPrice: 9000, highestBidderId: 't1', highestBidderName: 'Koramangala Kings', tiedTeams: [] as string[],
    bidHistory: [{ teamId: 't1', teamName: 'Koramangala Kings', amount: 9000, timestamp: '2026-10-13T14:12:50Z' }],
    tieBreakerActive: false, spinWinnerId: null as string | null, spinStartedAt: null,
};
type Patch = Record<string, unknown> & { liveBid?: Partial<typeof LIVE_BID> };
const status = ({ liveBid, ...patch }: Patch = {}) => ({
    auction: {
        _id: 'a1', status: 'in_progress', currentPlayerIndex: 12, totalPlayers: 48, logsCount: 1,
        unsoldCount: 3, rotationCount: 0, remainingCount: 35,
        settings: { minBidIncrement: 1000, hardLimit: 20000, bidDurationSeconds: 30 },
        liveBid: { ...LIVE_BID, ...liveBid }, ...patch,
    },
    currentPlayer: {
        _id: 'r13', profile: { firstName: 'Ananya', lastName: 'Rao', age: 24, gender: 'female', skillLevel: 'advanced' },
        auctionData: { basePrice: 2000 }, careerStats: { matchesPlayed: 34, matchesWon: 21, pointsContributed: 0, tournamentsPlayed: 6 },
    },
    upcoming: [{ registrationId: 'r14', playerName: 'Rahul Menon', basePrice: 1500, skillLevel: 'intermediate', queueIndex: 13 }],
    teams: TEAMS,
});
const SOLD_LOG = {
    logs: [{ _id: 'l1', registrationId: 'r9', playerName: 'Karan Malhotra', teamId: 't3', teamName: 'HSR Hawks', finalPrice: 14000 }],
    preAssigned: [{ registrationId: 'r1', playerName: 'Gopal Krishnan', teamId: 't1', teamName: 'Koramangala Kings', role: 'captain' }],
};

const CATS = [
    { _id: 'c3', name: 'Mixed doubles', status: 'setup' },
    { _id: 'c2', name: "Women's singles", status: 'registration' },
    { _id: 'c1', name: "Men's doubles", status: 'auction' },
];

/** Serves /status from a mutable value; POST handlers swap it to the state after the action. */
let current: ReturnType<typeof status> | null;
const posts: { path: string; body: Record<string, unknown> }[] = [];
const mockApi = () => server.use(
    http.get(`${API}/auction/t1/:cat/status`, () => current ? ok(current) : HttpResponse.json({ message: 'Auction not found.' }, { status: 404 })),
    http.get(`${API}/auction/t1/:cat/sold-log`, () => ok(SOLD_LOG)),
    http.get(`${API}/tournaments/t1/categories`, () => HttpResponse.json({ data: CATS })),
    http.post(`${API}/*`, async ({ request }) => {
        posts.push({ path: new URL(request.url).pathname, body: await request.json().catch(() => ({})) as Record<string, unknown> });
        return ok({});
    }),
);
const posted = (path: string) => posts.filter(p => p.path === path);

const renderSection = (categories = CATS) => {
    const store = configureStore({ reducer: { registration: registrationReducer } });
    return render(<Provider store={store}><AuctionSection tournamentId="t1" categories={categories} /></Provider>);
};

const confirmSpy = vi.fn(() => true);
beforeEach(() => {
    posts.length = 0;
    current = status();
    confirmSpy.mockClear();
    vi.stubGlobal('confirm', confirmSpy); // happy-dom has no window.confirm
    expect(window.confirm).toBe(confirmSpy);
});
afterEach(() => {
    expect(confirmSpy).not.toHaveBeenCalled(); // every confirmation is an inline bar
    vi.unstubAllGlobals();
});

describe('AuctionSection', () => {
    it('opens the live category, records a bid and follows socket updates', async () => {
        mockApi();
        renderSection();

        expect(await screen.findByText('Ananya Rao')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Men's doubles/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: /Women's singles/ })).toHaveTextContent('Ready to start');
        expect(screen.getByRole('tab', { name: /Mixed doubles/ })).toHaveTextContent('Registration not open');
        expect(sock.emit).toHaveBeenCalledWith('join:auction', { tournamentId: 't1', categoryId: 'c1' });
        expect(screen.getByText('₹9,000', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Public display/ })).toHaveAttribute('href', '/auction/t1/c1');
        expect(screen.getByText('Matches').nextSibling).toHaveTextContent('34');

        current = status({ liveBid: { currentPrice: 10000, highestBidderId: 't2', highestBidderName: 'Indiranagar Smashers' } });
        await userEvent.click(screen.getByRole('button', { name: /Indiranagar Smashers.*Bid ₹10,000/ }));
        expect(posted('/auction/bid')[0].body).toMatchObject({ tournamentId: 't1', categoryId: 'c1', teamId: 't2' });
        expect(await screen.findByRole('button', { name: /Indiranagar Smashers.*Leading/ })).toBeDisabled();

        act(() => sock.handlers['auction:update'](status({ liveBid: { currentPrice: 11000, highestBidderId: 't3', highestBidderName: 'HSR Hawks' } })));
        expect(screen.getByRole('button', { name: 'Sell to HSR Hawks · ₹11,000' })).toBeEnabled();
    });

    it('says why each team cannot bid', async () => {
        mockApi();
        current = status({ settings: { minBidIncrement: 1000, hardLimit: 9500, bidDurationSeconds: 30 } });
        renderSection();

        expect(await screen.findByRole('button', { name: /Koramangala Kings.*Leading/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Indiranagar Smashers.*Over limit/ })).toBeDisabled(); // ₹10,000 > ₹9,500
        expect(screen.getByRole('button', { name: /Whitefield Warriors.*Can't afford/ })).toBeDisabled();

        current = status({ status: 'paused' });
        act(() => sock.handlers['auction:update'](current));
        expect(screen.getByText(/Bidding is paused/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /HSR Hawks.*Paused/ })).toBeDisabled();
        expect(screen.getByRole('tab', { name: /Men's doubles/ })).toHaveTextContent('Paused');

        current = status({ liveBid: { currentPrice: 20000, highestBidderId: 't1', tiedTeams: ['t1', 't3'] } });
        act(() => sock.handlers['auction:update'](current));
        expect(screen.getByRole('button', { name: /HSR Hawks.*Matched/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Indiranagar Smashers.*Match ₹20,000/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Break the tie · 2 teams' })).toBeEnabled();
    });

    it('sells to the leading team, then undoes the sale after asking', async () => {
        mockApi();
        renderSection();

        const sell = await screen.findByRole('button', { name: 'Sell to Koramangala Kings · ₹9,000' });
        current = status({ status: 'sold', logsCount: 2, lastSoldResult: { playerName: 'Ananya Rao', teamId: 't1', teamName: 'Koramangala Kings', teamColor: '#FACC15', soldPrice: 9000, timestamp: '' } });
        await userEvent.click(sell);
        expect(posted('/auction/sell')[0].body).toMatchObject({ teamId: 't1', soldPrice: 9000 });

        // Sold: the result, Undo and Next, with purses and the sold list still on screen.
        expect(await screen.findByText('Sold', { selector: 'span' })).toBeInTheDocument();
        expect(screen.getByText('Next up:', { exact: false })).toHaveTextContent('Rahul Menon');
        expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument();
        expect(screen.getByText('Karan Malhotra')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Next player/ })).toBeEnabled();

        await userEvent.click(screen.getByRole('button', { name: 'Undo sale' }));
        expect(posted('/auction/undo')).toHaveLength(0); // first click only asks
        const bar = screen.getByRole('alertdialog', { name: 'Undo sale' });
        expect(bar).toHaveTextContent('Ananya Rao goes back on the block and Koramangala Kings gets ₹9,000 back.');
        current = status();
        await userEvent.click(within(bar).getByRole('button', { name: 'Undo sale' }));
        expect(posted('/auction/undo')).toHaveLength(1);
        expect(await screen.findByText('On the block')).toBeInTheDocument();
    });

    it('sells to the only team at the limit when nobody matches', async () => {
        mockApi();
        current = status({ liveBid: { currentPrice: 20000, highestBidderId: 't3', highestBidderName: 'HSR Hawks', tiedTeams: ['t3'] } });
        renderSection();

        await userEvent.click(await screen.findByRole('button', { name: 'Sell to HSR Hawks · ₹20,000' }));
        expect(posted('/auction/resolve-hard-limit')[0].body).toMatchObject({ winnerTeamId: 't3' });
        expect(posted('/auction/sell')).toHaveLength(0);
    });

    it('reopens a tie-break with the spin winner still picked', async () => {
        mockApi();
        current = status({ liveBid: { currentPrice: 20000, highestBidderId: 't1', tiedTeams: ['t1', 't3'], tieBreakerActive: true, spinWinnerId: 't3' } });
        renderSection();

        const dialog = await screen.findByRole('dialog', { name: 'Break the tie' });
        expect(within(dialog).getByText('HSR Hawks wins the spin.')).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: /Sell to HSR Hawks · ₹20,000/ }));
        expect(posted('/auction/resolve-hard-limit')[0].body).toMatchObject({ winnerTeamId: 't3' });
        expect(posted('/auction/start-tie-breaker')).toHaveLength(0); // restarting would clear the winner
    });

    it("shows the server's reason when an action fails, inside Sell manually too", async () => {
        mockApi();
        server.use(
            http.post(`${API}/auction/bid`, () => fail('Team budget insufficient. Available: ₹54000, Bid would be: ₹60000')),
            http.post(`${API}/auction/sell`, () => fail('Auction is not in progress.')),
        );
        renderSection();

        await userEvent.click(await screen.findByRole('button', { name: /Indiranagar Smashers.*Bid ₹10,000/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Team budget insufficient. Available: ₹54000, Bid would be: ₹60000');

        await userEvent.click(screen.getByRole('button', { name: 'Sell manually…' }));
        const dialog = screen.getByRole('dialog', { name: 'Sell manually' });
        await userEvent.click(within(dialog).getByRole('radio', { name: /HSR Hawks/ }));
        await userEvent.click(within(dialog).getByRole('button', { name: 'Sell for ₹9,000' }));
        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Auction is not in progress.');
        expect(screen.getByRole('dialog', { name: 'Sell manually' })).toBeInTheDocument();
    });

    it('ends the auction only after the inline confirmation', async () => {
        mockApi();
        renderSection();

        await userEvent.click(await screen.findByRole('button', { name: 'More actions' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'End auction' }));
        const bar = screen.getByRole('alertdialog', { name: 'End auction' });
        expect(bar).toHaveTextContent("39 players haven't been sold"); // 35 left + 3 unsold + the one on the block
        expect(posted('/auction/end')).toHaveLength(0);

        await userEvent.click(within(bar).getByRole('button', { name: 'End auction' }));
        expect(posted('/auction/end')).toHaveLength(1);
    });

    it('starts from registration: opens the category first, then the auction', async () => {
        mockApi();
        current = null;
        renderSection([{ _id: 'c2', name: "Women's singles", status: 'registration' }]);

        expect(await screen.findByText("Start the auction for Women's singles")).toBeInTheDocument();
        await userEvent.clear(screen.getByLabelText('Price limit'));
        await userEvent.type(screen.getByLabelText('Price limit'), '500');
        expect(screen.getByText('Leave blank for no limit, or use a whole number above the increment.')).toBeInTheDocument();
        await userEvent.clear(screen.getByLabelText('Price limit'));
        await userEvent.type(screen.getByLabelText('Price limit'), '20000');

        current = status();
        await userEvent.click(screen.getByRole('button', { name: 'Start auction' }));
        expect(posts.map(p => p.path)).toEqual(['/categories/c2/start-auction', '/auction/start']);
        expect(posted('/auction/start')[0].body).toMatchObject({ categoryId: 'c2', bidIncrement: 1000, hardLimit: 20000 });
        expect(await screen.findByText('On the block')).toBeInTheDocument();
    });

    it('starts a category already moved to Auction without the category step', async () => {
        mockApi();
        current = null;
        renderSection([{ _id: 'c1', name: "Men's doubles", status: 'auction' }]);

        const start = await screen.findByRole('button', { name: 'Start auction' });
        expect(screen.getByRole('tab', { name: /Men's doubles/ })).toHaveTextContent('Ready to start');
        current = status();
        await userEvent.click(start);
        expect(posts.map(p => p.path)).toEqual(['/auction/start']);
        expect(await screen.findByText('On the block')).toBeInTheDocument();
    });

    it('asks before assigning players evenly', async () => {
        mockApi();
        current = null;
        server.use(http.post(`${API}/auction/distribute`, () => ok({ assigned: 24, teams: 6 })));
        renderSection([{ _id: 'c2', name: "Women's singles", status: 'registration' }]);

        await userEvent.click(await screen.findByRole('button', { name: 'Assign evenly' }));
        await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Assign players' }));
        expect(await screen.findByText(/Assigned 24 players across 6 teams/)).toBeInTheDocument();
    });

    it("points a category that isn't open yet to Categories", async () => {
        mockApi();
        current = null;
        renderSection([{ _id: 'c3', name: 'Mixed doubles', status: 'setup' }]);
        expect(await screen.findByText("Mixed doubles isn't ready for an auction")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go to Categories' })).toBeInTheDocument();
    });

    it('summarises a finished auction', async () => {
        mockApi();
        current = status({ status: 'completed' });
        server.use(http.get(`${API}/registrations/tournaments/t1`, () => HttpResponse.json({
            data: [
                { _id: 'r20', categoryId: 'c1', status: 'approved' },
                { _id: 'r21', categoryId: 'c1', status: 'approved', teamId: 't1' },
                { _id: 'r22', categoryId: 'c2', status: 'approved' },
            ],
        })));
        renderSection();

        expect(await screen.findByText(/The auction ended with 1 player unsold/)).toBeInTheDocument();
        expect(screen.getByText('Top sale').nextSibling).toHaveTextContent('₹14,000');
        const hawks = within(screen.getByRole('region', { name: 'Team spending' })).getByText('HSR Hawks').closest('li');
        expect(hawks).toHaveTextContent('₹29,000'); // spent
        expect(hawks).toHaveTextContent('₹71,000'); // purse left
    });
});
