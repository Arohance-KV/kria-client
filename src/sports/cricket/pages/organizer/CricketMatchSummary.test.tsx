import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import cricketLiveStateReducer from '@/sports/cricket/store/cricketLiveStateSlice';
import CricketMatchSummary from './CricketMatchSummary';

// The correction door for a completed cricket match. Unlike badminton's reopen,
// this reuses the existing undo-last-ball endpoint, which already unwinds the
// whole completion server-side: ledger rows, player stats, career profiles and
// the advanced bracket winner.
const API = 'https://api.kria.club/sports/cricket/match';
const UNDO = `${API}/m1/balls/last`;

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
// Fixtures are shaped ad hoc per case, and the component takes `match: any`.
const renderSummary = (match: any = completedMatch) => {
    const store = configureStore({ reducer: { cricketLiveState: cricketLiveStateReducer } });
    render(
        <Provider store={store}>
            <MemoryRouter>
                <CricketMatchSummary match={match} />
            </MemoryRouter>
        </Provider>,
    );
    return { store };
};

const correctBtn = () => screen.getByRole('button', { name: /correct result/i });

// Re-reading the match after a correction reopens scoring in the console.
let refetches = 0;
beforeEach(() => {
    refetches = 0;
    server.use(
        http.get(`${API}/m1`, () => { refetches += 1; return HttpResponse.json({ data: { data: { ...completedMatch, status: 'in_progress' } } }); }),
        http.get(`${API}/m1/live`, () => HttpResponse.json({ data: { data: { liveState: { matchStatus: 'innings2' } } } })),
    );
});

describe('CricketMatchSummary — correcting a completed match', () => {
    it('still shows the result it is offering to correct', () => {
        renderSummary();
        expect(screen.getByText(/Alpha won by 3 wickets/i)).toBeInTheDocument();
        expect(correctBtn()).toBeInTheDocument();
    });

    it('undoes the final delivery once confirmed, then reopens the match', async () => {
        let hits = 0;
        server.use(http.delete(UNDO, () => {
            hits += 1;
            return HttpResponse.json({
                data: { data: { liveState: { matchStatus: 'in_progress', runs: 78 }, deletedBallId: 'b9' } },
            });
        }));

        renderSummary();
        await userEvent.click(correctBtn());
        // Asks inline first, explaining what a correction undoes.
        expect(screen.getByText(/career stats it credited are removed/i)).toBeInTheDocument();
        await userEvent.click(correctBtn());

        await waitFor(() => expect(hits).toBe(1));
        await waitFor(() => expect(refetches).toBe(1));
    });

    it('sends nothing if the organizer keeps the result', async () => {
        let hits = 0;
        server.use(http.delete(UNDO, () => {
            hits += 1;
            return HttpResponse.json({ data: { data: {} } });
        }));

        renderSummary();
        await userEvent.click(correctBtn());
        await userEvent.click(screen.getByRole('button', { name: 'Keep result' }));

        expect(hits).toBe(0);
        expect(correctBtn()).toBeInTheDocument();
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
        await userEvent.click(correctBtn());

        expect(await screen.findByText(/No balls to undo\./i)).toBeInTheDocument();
    });

    // The undo succeeded but the bracket still lists the undone winner, so the
    // organizer has manual work. Reopening the match would swap this screen out
    // and take the message with it, so it waits until they have read it.
    it('shows a bracket warning inline and waits before reopening', async () => {
        const warn = 'Bracket unchanged: Final match 3 is already under way and still lists the undone winner.';
        server.use(http.delete(UNDO, () =>
            HttpResponse.json({ data: { data: { liveState: { matchStatus: 'in_progress' }, bracketWarning: warn } } }),
        ));

        renderSummary();
        await userEvent.click(correctBtn());
        await userEvent.click(correctBtn());

        expect(await screen.findByText(warn)).toBeInTheDocument();
        expect(refetches).toBe(0);

        await userEvent.click(screen.getByRole('button', { name: 'Continue scoring' }));
        await waitFor(() => expect(refetches).toBe(1));
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

describe('CricketMatchSummary — a tied match', () => {
    it('calls it a tie instead of inventing a winner', () => {
        renderSummary(tiedMatch);
        expect(screen.getByText(/match tied/i)).toBeInTheDocument();
        expect(screen.queryByText(/Winner won/i)).not.toBeInTheDocument();
    });

    it('does not claim anyone advanced', () => {
        renderSummary(tiedMatch);
        expect(screen.queryByText(/advanced in the bracket automatically/i)).not.toBeInTheDocument();
    });

    it('offers both sides so the organizer can name who goes through', () => {
        renderSummary(tiedMatch);
        expect(screen.getByRole('radio', { name: /Konkan Titans/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Deccan Dynamos/ })).toBeInTheDocument();
    });

    it('posts the chosen side to the tie-break endpoint and re-reads the match', async () => {
        let body: Record<string, unknown> | null = null;
        let reread = false;
        server.use(
            http.post(`${API}/m2/resolve-tie`, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ data: { data: {} } });
            }),
            http.get(`${API}/m2`, () => { reread = true; return HttpResponse.json({ data: { data: { ...tiedMatch, winnerId: 't2' } } }); }),
        );

        const { store } = renderSummary(tiedMatch);
        expect(screen.getByRole('button', { name: /record who advanced/i })).toBeDisabled();
        await userEvent.click(screen.getByRole('radio', { name: /Deccan Dynamos/ }));
        await userEvent.click(screen.getByRole('button', { name: /record who advanced/i }));

        await waitFor(() => expect(body).toEqual({ winnerTeamId: 't2' }));
        await waitFor(() => expect(reread).toBe(true));
        await waitFor(() => expect(store.getState().cricketLiveState.byMatchId.m2?.match?.winnerId).toBe('t2'));
    });

    it('leaves a decided match exactly as it was', () => {
        renderSummary(completedMatch);
        expect(screen.getByText(/Alpha won by 3 wickets/i)).toBeInTheDocument();
        expect(screen.getByText(/advanced in the bracket automatically/i)).toBeInTheDocument();
    });
});

// ── The final ───────────────────────────────────────────────────────────────
const wonFinal = {
    ...completedMatch,
    _id: 'm3',
    bracketRound: 'Final',
    nextMatchId: undefined,
};

describe('CricketMatchSummary — winning the final', () => {
    it('crowns the winner instead of saying they advanced', () => {
        renderSummary(wonFinal);
        expect(screen.getByText(/champions/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Alpha/ })).toBeInTheDocument();
        // There is no next round to advance into.
        expect(screen.queryByText(/advanced in the bracket automatically/i)).not.toBeInTheDocument();
    });

    it('still says "advanced" for a round that has one', () => {
        renderSummary({ ...completedMatch, bracketRound: 'Semi-Final', nextMatchId: 'f1' });
        expect(screen.getByText(/advanced in the bracket automatically/i)).toBeInTheDocument();
        expect(screen.queryByText(/champions/i)).not.toBeInTheDocument();
    });

    it('does not crown anyone when the final is still tied', () => {
        renderSummary({ ...tiedMatch, bracketRound: 'Final' });
        expect(screen.queryByText(/champions/i)).not.toBeInTheDocument();
        expect(screen.getByText(/match tied/i)).toBeInTheDocument();
    });
});
