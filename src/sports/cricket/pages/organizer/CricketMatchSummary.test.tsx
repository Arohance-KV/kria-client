import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import cricketLiveStateReducer from '@/sports/cricket/store/cricketLiveStateSlice';
import CricketMatchSummary from './CricketMatchSummary';

// The correction door for a completed cricket match. Unlike badminton's reopen,
// this reuses the existing undo-last-ball endpoint, which already unwinds the
// whole completion server-side: ledger rows, player stats, career profiles and
// the advanced bracket winner.
const UNDO = 'https://api.kria.club/sports/cricket/match/m1/balls/last';

const completedMatch = {
    _id: 'm1',
    status: 'completed',
    teams: { team1Id: 't1', team1Name: 'Alpha', team2Id: 't2', team2Name: 'Bravo' },
    winnerId: 't1',
    result: { marginOfVictory: 'by 3 wickets' },
    inningsScores: [
        { inningsNumber: 1, runs: 80, wickets: 5, overs: 10, balls: 0 },
        { inningsNumber: 2, runs: 81, wickets: 3, overs: 9, balls: 4 },
    ],
};

// A store holding only the cricket slice: the real app assembles plugin
// reducers at module load, which a test should not depend on.
const renderSummary = () => {
    const store = configureStore({ reducer: { cricketLiveState: cricketLiveStateReducer } });
    render(
        <Provider store={store}>
            <CricketMatchSummary match={completedMatch} />
        </Provider>,
    );
    return { store };
};

const correctBtn = () => screen.getByRole('button', { name: /correct result/i });

beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

describe('CricketMatchSummary — correcting a completed match', () => {
    it('still shows the result it is offering to correct', () => {
        renderSummary();
        expect(screen.getByText(/Alpha won by 3 wickets/i)).toBeInTheDocument();
        expect(correctBtn()).toBeInTheDocument();
    });

    it('undoes the final delivery once confirmed', async () => {
        let hits = 0;
        server.use(http.delete(UNDO, () => {
            hits += 1;
            return HttpResponse.json({
                data: { data: { liveState: { matchStatus: 'in_progress', runs: 78 }, deletedBallId: 'b9' } },
            });
        }));

        renderSummary();
        await userEvent.click(correctBtn());

        await waitFor(() => expect(hits).toBe(1));
    });

    it('sends nothing if the confirm is dismissed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        // Counted rather than left unmocked: asserting only that confirm was
        // called would pass even if the guard were removed, since confirm is
        // called either way. The request count is the thing under test.
        let hits = 0;
        server.use(http.delete(UNDO, () => {
            hits += 1;
            return HttpResponse.json({ data: { data: {} } });
        }));

        renderSummary();
        await userEvent.click(correctBtn());

        expect(window.confirm).toHaveBeenCalled();
        expect(hits).toBe(0);
    });

    // The realistic refusal: a match completed through the manual result endpoint
    // has no deliveries, so there is nothing to undo. The organizer needs to be
    // told that specifically, not "something went wrong".
    it('shows a server refusal verbatim', async () => {
        server.use(http.delete(UNDO, () =>
            HttpResponse.json({ message: 'No balls to undo.' }, { status: 400 }),
        ));

        renderSummary();
        await userEvent.click(correctBtn());

        expect(await screen.findByText(/No balls to undo\./i)).toBeInTheDocument();
    });

    // The undo succeeded but the bracket still lists the undone winner, so the
    // organizer has manual work. The console swaps this phase out on success,
    // which would discard an inline message — hence a blocking alert.
    it('blocks on a bracket warning', async () => {
        const warn = 'Bracket unchanged: Final match 3 is already under way and still lists the undone winner.';
        server.use(http.delete(UNDO, () =>
            HttpResponse.json({ data: { data: { liveState: { matchStatus: 'in_progress' }, bracketWarning: warn } } }),
        ));

        renderSummary();
        await userEvent.click(correctBtn());

        await waitFor(() => expect(window.alert).toHaveBeenCalledWith(warn));
    });
});

// ── A tied knockout ─────────────────────────────────────────────────────────
// The engine records a tie as no winner at all, which is right. The card then
// read the winner name off a fallback string and announced "Winner won match
// tied.", under a line claiming a winner had advanced when nothing had.
const tiedMatch = {
    _id: 'm2',
    status: 'completed',
    teams: { team1Id: 't1', team1Name: 'Konkan Titans', team2Id: 't2', team2Name: 'Deccan Dynamos' },
    winnerId: undefined,
    result: { marginOfVictory: 'match tied' },
    inningsScores: [
        { inningsNumber: 1, runs: 69, wickets: 3, overs: 7, balls: 0 },
        { inningsNumber: 2, runs: 69, wickets: 1, overs: 7, balls: 0 },
    ],
};

const renderTied = (match = tiedMatch) => {
    const store = configureStore({ reducer: { cricketLiveState: cricketLiveStateReducer } });
    render(
        <Provider store={store}>
            <CricketMatchSummary match={match} />
        </Provider>,
    );
};

describe('CricketMatchSummary — a tied match', () => {
    it('calls it a tie instead of inventing a winner', () => {
        renderTied();
        expect(screen.getByText(/match tied/i)).toBeInTheDocument();
        expect(screen.queryByText(/Winner won/i)).not.toBeInTheDocument();
    });

    it('does not claim anyone advanced', () => {
        renderTied();
        expect(screen.queryByText(/advanced in the bracket automatically/i)).not.toBeInTheDocument();
    });

    it('offers both sides so the organizer can name who goes through', () => {
        renderTied();
        expect(screen.getByRole('button', { name: /Konkan Titans/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Deccan Dynamos/ })).toBeInTheDocument();
    });

    it('posts the chosen side to the tie-break endpoint', async () => {
        let body: Record<string, unknown> | null = null;
        server.use(http.post('https://api.kria.club/sports/cricket/match/m2/resolve-tie', async ({ request }) => {
            body = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({ data: { data: {} } });
        }));

        renderTied();
        await userEvent.click(screen.getByRole('button', { name: /Deccan Dynamos/ }));
        await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

        await waitFor(() => expect(body).toEqual({ winnerTeamId: 't2' }));
    });

    it('leaves a decided match exactly as it was', () => {
        renderTied(completedMatch);
        expect(screen.getByText(/Alpha won by 3 wickets/i)).toBeInTheDocument();
        expect(screen.getByText(/advanced in the bracket automatically/i)).toBeInTheDocument();
    });
});
