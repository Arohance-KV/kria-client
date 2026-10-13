import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import BadmintonMatchResultSection from './BadmintonMatchResultSection';

// Reopening deletes career-stat ledger rows and un-advances a bracket winner, so a
// silent regression in the correction door is expensive — hence the guards below.
const API = 'https://api.kria.club/sports/badminton/match/m1';
const REOPEN = `${API}/reopen`;

const baseMatch = (over: Record<string, unknown> = {}) => ({
    _id: 'm1',
    status: 'completed',
    matchNumber: 3,
    bracketRound: 'Quarter Final',
    matchConfig: { bestOf: 3 },
    teams: { team1Id: 't1', team1Name: 'Alpha', team2Id: 't2', team2Name: 'Bravo' },
    ...over,
});

const renderSection = (over: Record<string, unknown> = {}) => {
    const onRecorded = vi.fn();
    const view = render(
        <BadmintonMatchResultSection
            match={baseMatch(over)}
            competitorType="team"
            onRecorded={onRecorded}
        />,
    );
    return { onRecorded, ...view };
};

const correctBtn = () => screen.getByRole('button', { name: /correct result/i });
const askToReopen = async () => {
    await userEvent.click(correctBtn());
    await userEvent.click(screen.getByRole('button', { name: 'Reopen match' }));
};

describe('BadmintonMatchResultSection — correcting a result', () => {
    it('offers the correction on a completed match', () => {
        renderSection();
        expect(correctBtn()).toBeInTheDocument();
    });

    // The server accepts status 'completed' and nothing else. This component's own
    // `isCompleted` also counts a non-bye walkover, so gating on it would show a
    // button that always failed with "nothing to reopen".
    it('offers nothing on a walkover, which the server cannot reopen', () => {
        const { container } = renderSection({ status: 'walkover', winReason: 'retired' });
        expect(container).toBeEmptyDOMElement();
    });

    it('offers nothing on a bye, which has no result to correct', () => {
        const { container } = renderSection({ status: 'walkover', winReason: 'bye' });
        expect(container).toBeEmptyDOMElement();
    });

    it('leaves the normal scoring UI alone on a match not yet played', () => {
        renderSection({ status: 'scheduled' });
        expect(screen.getByRole('button', { name: /enter result/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /score live/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /correct result/i })).toBeNull();
    });

    it('reopens and refetches once confirmed', async () => {
        let hits = 0;
        server.use(http.post(REOPEN, () => {
            hits += 1;
            return HttpResponse.json({ data: { data: { match: {}, rowsDeleted: 2, bracketCleared: true } } });
        }));

        const { onRecorded } = renderSection();
        await userEvent.click(correctBtn());
        expect(hits).toBe(0); // the first click only asks
        await userEvent.click(screen.getByRole('button', { name: 'Reopen match' }));

        await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
        expect(hits).toBe(1);
    });

    it('sends nothing if the confirm is dismissed', async () => {
        // No handler is registered, and setup.ts sets onUnhandledRequest: 'error' —
        // so an accidental request would fail this test rather than pass silently.
        const { onRecorded } = renderSection();
        await userEvent.click(correctBtn());
        await userEvent.click(screen.getByRole('button', { name: 'Keep result' }));
        expect(screen.queryByRole('button', { name: 'Reopen match' })).toBeNull();
        expect(onRecorded).not.toHaveBeenCalled();
    });

    // The refusal names WHICH downstream match is blocking the correction, so the
    // organizer can go fix that one. A generic "something went wrong" would strand
    // them on a problem they could have solved themselves.
    it('shows a server refusal verbatim and does not refetch', async () => {
        const msg = 'Cannot reopen: Semi Final match 2 has already started. Correct that match first.';
        server.use(http.post(REOPEN, () => HttpResponse.json({ message: msg }, { status: 400 })));

        const { onRecorded } = renderSection();
        await askToReopen();

        expect(await screen.findByText(msg)).toBeInTheDocument();
        expect(onRecorded).not.toHaveBeenCalled();
    });

    // A warning means the reopen SUCCEEDED but the bracket could not be cleared,
    // leaving manual work. It must survive the refetch that follows.
    it('keeps a bracket warning on screen yet still refetches', async () => {
        const warn = 'Bracket not cleared: next match already has a recorded score.';
        server.use(http.post(REOPEN, () =>
            HttpResponse.json({ data: { data: { match: {}, rowsDeleted: 1, bracketWarning: warn } } }),
        ));

        const { onRecorded, rerender } = renderSection();
        await askToReopen();

        await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
        // The host refetches and the match comes back reopened.
        rerender(<BadmintonMatchResultSection match={baseMatch({ status: 'scheduled' })} competitorType="team" onRecorded={onRecorded} />);
        expect(screen.getByText(warn)).toBeInTheDocument();
    });
});

describe('BadmintonMatchResultSection — scoring', () => {
    it('sends only the games that were played', async () => {
        let body: { winnerId?: string; gameScores?: unknown[] } = {};
        server.use(http.post(`${API}/result`, async ({ request }) => {
            body = await request.json() as typeof body;
            return HttpResponse.json({ data: {} });
        }));

        const { onRecorded } = renderSection({ status: 'scheduled' });
        await userEvent.click(screen.getByRole('button', { name: 'Enter result' }));

        const save = screen.getByRole('button', { name: 'Save result' });
        expect(save).toBeDisabled(); // no winner yet

        await userEvent.type(screen.getByLabelText('Game 1, Alpha'), '21');
        await userEvent.type(screen.getByLabelText('Game 1, Bravo'), '15');
        await userEvent.type(screen.getByLabelText('Game 2, Alpha'), '21');
        await userEvent.type(screen.getByLabelText('Game 2, Bravo'), '18');
        expect(screen.getByText(/wins 2–0/)).toHaveTextContent('Alpha wins 2–0. Leave unplayed games empty.');

        await userEvent.click(save);
        await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
        expect(body.winnerId).toBe('t1');
        // Game 3 was left empty: it is omitted, not sent as 0–0.
        expect(body.gameScores).toEqual([
            { gameNumber: 1, team1Score: 21, team2Score: 15 },
            { gameNumber: 2, team1Score: 21, team2Score: 18 },
        ]);
    });

    it('asks before starting live scoring, then shows errors inside the console', async () => {
        let starts = 0;
        server.use(http.post(`${API}/live/start`, () => {
            starts += 1;
            return HttpResponse.json({ message: 'Court 2 is already in use.' }, { status: 409 });
        }));

        renderSection({ status: 'scheduled' });
        await userEvent.click(screen.getByRole('button', { name: /score live/i }));
        expect(screen.getByText(/The match shows as Live to players/)).toBeInTheDocument();
        expect(starts).toBe(0); // asking starts nothing

        await userEvent.click(screen.getByRole('button', { name: 'Start live scoring' }));
        const console = await screen.findByRole('dialog', { name: /Live scoring · Match 3/ });
        expect(await screen.findByText('Court 2 is already in use.')).toBeInTheDocument();
        expect(console).toContainElement(screen.getByText('Court 2 is already in use.'));
        expect(starts).toBe(1);
    });

    it('continues a live match without asking again', async () => {
        renderSection({ status: 'in_progress' });
        await userEvent.click(screen.getByRole('button', { name: /continue live/i }));
        expect(screen.getByRole('dialog', { name: /Live scoring/ })).toBeInTheDocument();
    });
});
