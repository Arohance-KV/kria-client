import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { server } from '@/test/server';
import AuctionDisplay from './AuctionDisplay';

// The page talks to the shared socket.io client; record what it sends and let tests push events.
const sock = vi.hoisted(() => {
    const handlers: Record<string, (d?: unknown) => void> = {};
    return {
        handlers, connected: false,
        connect: vi.fn(() => handlers.connect?.()), disconnect: vi.fn(), emit: vi.fn(),
        on: vi.fn((e: string, f: (d?: unknown) => void) => { handlers[e] = f; }),
        off: vi.fn(),
    };
});
vi.mock('@/lib/socket', () => ({ socket: sock }));

const API = 'https://api.kria.club';
const ok = (data: unknown) => HttpResponse.json({ data: { data } });
const LOGO = 'https://cdn.kria.club/kings.png';

const team = (_id: string, name: string, budget: number, logo?: string) =>
    ({ _id, name, logo, primaryColor: '#38BDF8', budget, initialBudget: 100000, playersCount: 7, totalSpent: 100000 - budget });
const TEAMS = [
    team('t1', 'Koramangala Kings', 62000, LOGO), team('t2', 'Indiranagar Smashers', 54000),
    team('t3', 'HSR Hawks', 71000), team('t4', 'Whitefield Warriors', 8000),
];
const LIVE_BID = {
    currentPrice: 9000, highestBidderId: 't1', highestBidderName: 'Koramangala Kings', tiedTeams: [] as string[],
    bidHistory: [
        { teamId: 't3', teamName: 'HSR Hawks', amount: 8000, timestamp: '' },
        { teamId: 't1', teamName: 'Koramangala Kings', amount: 9000, timestamp: '' },
    ],
    tieBreakerActive: false, spinWinnerId: null as string | null, spinStartedAt: null as string | null,
};
type Patch = Record<string, unknown> & { liveBid?: Partial<typeof LIVE_BID> };
const status = ({ liveBid, ...patch }: Patch = {}) => ({
    auction: {
        _id: 'a1', status: 'in_progress', currentPlayerIndex: 12, totalPlayers: 48, logsCount: 1,
        unsoldCount: 1, rotationCount: 0, remainingCount: 35,
        settings: { minBidIncrement: 1000, hardLimit: 20000, bidDurationSeconds: 30 },
        liveBid: { ...LIVE_BID, ...liveBid }, ...patch,
    },
    currentPlayer: {
        _id: 'r13', profile: { firstName: 'Ananya', lastName: 'Rao', age: 24, gender: 'female', skillLevel: 'advanced' },
        auctionData: { basePrice: 2000 }, careerStats: { matchesPlayed: 34, matchesWon: 21, pointsContributed: 412, tournamentsPlayed: 6 },
    },
    upcoming: [{ registrationId: 'r14', playerName: 'Rahul Menon', basePrice: 1500, skillLevel: 'intermediate', queueIndex: 13 }],
    unsold: [{ registrationId: 'r5', playerName: 'Vikram Shah', basePrice: 1000, skillLevel: 'beginner' }],
    teams: TEAMS,
    category: { _id: 'c1', name: "Men's doubles" },
    tournament: { _id: 't1', name: 'Bengaluru Shuttle League 2026' },
});
const SOLD_LOG = {
    logs: [{ _id: 'l1', registrationId: 'r9', playerName: 'Karan Malhotra', teamId: 't3', teamName: 'HSR Hawks', finalPrice: 14000 }],
    preAssigned: [{ registrationId: 'r1', playerName: 'Gopal Krishnan', teamId: 't1', teamName: 'Koramangala Kings', role: 'captain' }],
};

/** Serves /status from a mutable value (null = 404) and counts requests. */
let current: ReturnType<typeof status> | null;
const hits = { status: 0, log: 0 };
const mockApi = () => {
    hits.status = 0; hits.log = 0;
    server.use(
        http.get(`${API}/auction/t1/c1/status`, () => {
            hits.status++;
            return current ? ok(current) : HttpResponse.json({ message: 'Auction not found.' }, { status: 404 });
        }),
        http.get(`${API}/auction/t1/c1/sold-log`, () => { hits.log++; return ok(SOLD_LOG); }),
    );
};

const renderPage = () => render(
    <MemoryRouter initialEntries={['/auction/t1/c1']}>
        <Routes><Route path="/auction/:tournamentId/:categoryId" element={<AuctionDisplay />} /></Routes>
    </MemoryRouter>,
);
const purseRow = (name: string) => within(screen.getByRole('region', { name: 'Team purses' })).getByText(name).closest('li')!;
const push = (d: unknown) => act(() => sock.handlers['auction:update'](d));

describe('AuctionDisplay', () => {
    it('shows the player, the bid, the leader and every purse', async () => {
        current = status();
        mockApi();
        const { unmount } = renderPage();

        expect(await screen.findByRole('heading', { name: 'Ananya Rao' })).toBeInTheDocument();
        expect(sock.emit).toHaveBeenCalledWith('join:auction', { tournamentId: 't1', categoryId: 'c1' });
        expect(screen.getByText('Bengaluru Shuttle League 2026')).toBeInTheDocument();
        expect(screen.getByText("Men's doubles · player auction")).toBeInTheDocument();
        expect(screen.getByText(/Round 1 ·/)).toHaveTextContent('Round 1 · 13 of 48 · 35 left');
        expect(screen.getByText('Live')).toBeInTheDocument();
        expect(screen.getByText('24 · Female · Advanced')).toBeInTheDocument();
        expect(screen.getByText('Points').nextSibling).toHaveTextContent('412');

        expect(screen.getByText('Current bid')).toBeInTheDocument();
        const amount = screen.getByText('₹9,000', { selector: '[aria-live]' });
        expect(amount).toBeInTheDocument();
        expect(screen.getByText('Highest bid').nextSibling).toHaveTextContent('Koramangala Kings');
        expect(screen.getByText('Next bid').parentElement).toHaveTextContent('Next bid ₹10,000');
        expect(screen.getByText('Limit ₹20,000')).toBeInTheDocument();
        expect(within(screen.getByRole('list', { name: 'Recent bids' })).getAllByRole('listitem')[0]).toHaveTextContent('Koramangala Kings ₹9,000');

        // Purses: a logo image or initials on the team colour; the tag says who leads and who can't keep up.
        const kings = purseRow('Koramangala Kings');
        expect(kings.querySelector('img')).toHaveAttribute('src', LOGO);
        expect(kings).toHaveTextContent('Leading');
        expect(kings).toHaveTextContent('₹62,000');
        const smashers = purseRow('Indiranagar Smashers');
        expect(smashers.querySelector('img')).toBeNull();
        expect(smashers).toHaveTextContent('IS');
        expect(smashers).toHaveTextContent('7 players');
        expect(purseRow('Whitefield Warriors')).toHaveTextContent('Can’t reach ₹10,000');

        // A broken logo falls back to the initials.
        fireEvent.error(kings.querySelector('img')!);
        expect(purseRow('Koramangala Kings').querySelector('img')).toBeNull();
        expect(purseRow('Koramangala Kings')).toHaveTextContent('KK');

        // The band: last sales, the queue and the unsold.
        expect(await within(screen.getByRole('region', { name: 'Recently sold' })).findByText('Karan Malhotra')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Recently sold' })).toHaveTextContent('₹14,000· HSR Hawks');
        expect(screen.getByRole('region', { name: 'Up next' })).toHaveTextContent('base ₹1,500 · Intermediate');
        expect(screen.getByRole('region', { name: 'Unsold' })).toHaveTextContent('Vikram Shah. Back in round 2.');

        unmount();
        expect(sock.emit).toHaveBeenLastCalledWith('leave:auction', { tournamentId: 't1', categoryId: 'c1' });
        expect(sock.off).toHaveBeenCalledWith('auction:update', expect.any(Function));
        expect(sock.disconnect).toHaveBeenCalled();
    });

    it('follows a raised bid from the socket', async () => {
        current = status();
        mockApi();
        renderPage();
        await screen.findByText('₹9,000', { selector: '[aria-live]' });

        push(status({ liveBid: {
            currentPrice: 10000, highestBidderId: 't2', highestBidderName: 'Indiranagar Smashers',
            bidHistory: [...LIVE_BID.bidHistory, { teamId: 't2', teamName: 'Indiranagar Smashers', amount: 10000, timestamp: '' }],
        } }));
        expect(screen.getByText('₹10,000', { selector: '[aria-live]' })).toBeInTheDocument();
        expect(screen.getByText('Highest bid').nextSibling).toHaveTextContent('Indiranagar Smashers');
        expect(purseRow('Indiranagar Smashers')).toHaveTextContent('Leading');
        expect(purseRow('Koramangala Kings')).toHaveTextContent('7 players');
        expect(purseRow('Whitefield Warriors')).toHaveTextContent('Can’t reach ₹11,000');
    });

    it('shows base price before the first bid', async () => {
        current = status({ settings: { minBidIncrement: 500, hardLimit: 0, bidDurationSeconds: 30 }, liveBid: { currentPrice: 2000, highestBidderId: '', highestBidderName: '', bidHistory: [] } });
        mockApi();
        renderPage();

        expect(await screen.findByText('Base price')).toBeInTheDocument();
        expect(screen.getByText('₹2,000', { selector: '[aria-live]' })).toBeInTheDocument();
        expect(screen.getByText('Waiting for the first bid')).toBeInTheDocument();
        expect(screen.getByText('No limit')).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Recent bids' })).toBeNull();
    });

    it('stamps a sale over the stage and keeps the purses on screen', async () => {
        current = status({
            status: 'sold', logsCount: 2,
            lastSoldResult: { playerName: 'Ananya Rao', teamId: 't1', teamName: 'Koramangala Kings', teamColor: '#FACC15', soldPrice: 9000, timestamp: '' },
        });
        current.teams = TEAMS.map(t => (t._id === 't1' ? { ...t, budget: 53000, playersCount: 8 } : t));
        mockApi();
        renderPage();

        const stamp = (await screen.findByText('Sold')).closest('[role=status]')!;
        expect(stamp).toHaveTextContent('Sold');
        expect(stamp).toHaveTextContent('Koramangala Kings');
        expect(stamp).toHaveTextContent('₹9,000');
        expect(stamp).toHaveTextContent('Ananya Rao');
        expect(stamp.querySelector('img')).toHaveAttribute('src', LOGO);
        expect(screen.getByRole('heading', { name: 'Ananya Rao' })).toBeInTheDocument(); // the stage stays underneath

        expect(within(screen.getByRole('region', { name: 'Team purses' })).getAllByRole('listitem')).toHaveLength(4);
        expect(purseRow('Koramangala Kings')).toHaveTextContent('Bought');
        expect(purseRow('Koramangala Kings')).toHaveTextContent('₹53,000');
        expect(purseRow('Whitefield Warriors')).toHaveTextContent('7 players');
    });

    it('veils the stage while paused', async () => {
        current = status({ status: 'paused' });
        mockApi();
        renderPage();

        expect((await screen.findByText('Bidding paused')).closest('[role=status]')).toHaveTextContent('Back shortly. This screen updates by itself.');
        expect(screen.getByText('Paused')).toBeInTheDocument();
        expect(screen.queryByText('Live')).toBeNull();
    });

    it('spins the wheel for teams tied at the limit', async () => {
        current = status({ liveBid: { currentPrice: 20000, highestBidderId: 't1', tiedTeams: ['t1', 't3'], tieBreakerActive: true } });
        mockApi();
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Koramangala Kings or HSR Hawks' })).toBeInTheDocument();
        expect(screen.getByText('Both teams bid the ₹20,000 limit. The wheel decides who gets Ananya.')).toBeInTheDocument();
        expect(screen.getByText('Tie-Breaker!')).toBeInTheDocument();
        expect(purseRow('HSR Hawks')).toHaveTextContent('Matched');
    });

    it('opens with the line-up before bidding starts', async () => {
        current = status({ status: 'not_started' });
        mockApi();
        renderPage();

        expect(await screen.findByRole('heading', { name: "Men's doubles" })).toBeInTheDocument();
        expect(screen.getByText('Auction starts soon')).toBeInTheDocument();
        expect(screen.getByText('Starts soon')).toBeInTheDocument();
        expect(screen.getByText('Purse per team').nextSibling).toHaveTextContent('₹1,00,000');
        expect(screen.getByText('Bid limit').nextSibling).toHaveTextContent('₹20,000');
        expect(within(screen.getByRole('list', { name: 'Teams' })).getAllByRole('listitem')).toHaveLength(4);
    });

    it('lists the final squads by team', async () => {
        current = status({ status: 'completed' });
        mockApi();
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Auction complete' })).toBeInTheDocument();
        expect(screen.getByText('Finished')).toBeInTheDocument();
        const kings = screen.getByRole('region', { name: 'Koramangala Kings' });
        await waitFor(() => expect(kings).toHaveTextContent('Gopal Krishnan'));
        expect(within(kings).getByText('Captain')).toBeInTheDocument();
        expect(kings).toHaveTextContent('Free');
        expect(kings).toHaveTextContent('1 player');
        const hawks = screen.getByRole('region', { name: 'HSR Hawks' });
        expect(hawks).toHaveTextContent('Karan Malhotra₹14,000');
        expect(hawks).toHaveTextContent('₹71,000 left');
        expect(screen.getByText('Total spent').nextSibling).toHaveTextContent('₹14,000');
        expect(screen.getByText('Top buy').nextSibling).toHaveTextContent('Karan Malhotra · ₹14,000');
        expect(screen.getByText('Unsold: Vikram Shah.')).toBeInTheDocument();
    });

    it('rejoins the room and catches up after a reconnect', async () => {
        current = status();
        mockApi();
        renderPage();
        await screen.findByText('₹9,000', { selector: '[aria-live]' });
        await waitFor(() => expect(hits.log).toBe(1));
        expect(hits.status).toBe(1);
        sock.emit.mockClear();

        act(() => sock.handlers.disconnect());
        expect(screen.getByText('Reconnecting…')).toBeInTheDocument();

        current = status({ liveBid: { currentPrice: 12000, highestBidderId: 't3', highestBidderName: 'HSR Hawks' } });
        act(() => sock.handlers.connect());
        expect(sock.emit).toHaveBeenCalledWith('join:auction', { tournamentId: 't1', categoryId: 'c1' });
        expect(await screen.findByText('₹12,000', { selector: '[aria-live]' })).toBeInTheDocument();
        expect(hits.status).toBe(2);
        await waitFor(() => expect(hits.log).toBe(2));
        expect(screen.queryByText('Reconnecting…')).toBeNull();
    });

    it('offers a retry when the auction is missing', async () => {
        current = null;
        mockApi();
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Auction not found' })).toBeInTheDocument();
        current = status();
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByRole('heading', { name: 'Ananya Rao' })).toBeInTheDocument();
    });
});
