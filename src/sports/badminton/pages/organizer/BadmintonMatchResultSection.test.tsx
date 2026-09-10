import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import BadmintonMatchResultSection from './BadmintonMatchResultSection';

// Covers the result-correction door only. Reopening deletes career-stat ledger
// rows and un-advances a bracket winner, so a silent regression here is
// expensive — hence the two guards below are each proven by removal.
const REOPEN = 'https://api.kria.club/sports/badminton/match/m1/reopen';

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
    render(
        <BadmintonMatchResultSection
            match={baseMatch(over)}
            competitorType="team"
            onRecorded={onRecorded}
        />,
    );
    return { onRecorded };
};

const correctBtn = () => screen.getByRole('button', { name: /correct result/i });

beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

describe('BadmintonMatchResultSection — correcting a result', () => {
    it('offers the correction on a completed match', () => {
        renderSection();
        expect(correctBtn()).toBeInTheDocument();
    });

    // The server accepts status 'completed' and nothing else. This component's own
    // `isCompleted` also counts a non-bye walkover, so gating on it would show a
    // button that always failed with "nothing to reopen".
    it('offers nothing on a walkover, which the server cannot reopen', () => {
        const { container } = render(
            <BadmintonMatchResultSection
                match={baseMatch({ status: 'walkover', winReason: 'retired' })}
                competitorType="team"
                onRecorded={vi.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('offers nothing on a bye, which has no result to correct', () => {
        const { container } = render(
            <BadmintonMatchResultSection
                match={baseMatch({ status: 'walkover', winReason: 'bye' })}
                competitorType="team"
                onRecorded={vi.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('leaves the normal scoring UI alone on a match not yet played', () => {
        renderSection({ status: 'scheduled' });
        expect(screen.getByRole('button', { name: /record result/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /live score/i })).toBeInTheDocument();
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

        await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
        expect(hits).toBe(1);
    });

    it('sends nothing if the confirm is dismissed', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        // No handler is registered, and setup.ts sets onUnhandledRequest: 'error' —
        // so an accidental request would fail this test rather than pass silently.
        const { onRecorded } = renderSection();
        await userEvent.click(correctBtn());
        expect(onRecorded).not.toHaveBeenCalled();
    });

    // The refusal names WHICH downstream match is blocking the correction, so the
    // organizer can go fix that one. A generic "something went wrong" would strand
    // them on a problem they could have solved themselves.
    it('shows a server refusal verbatim and does not refetch', async () => {
        const msg = 'Cannot reopen: Semi Final match 2 has already started. Correct that match first.';
        server.use(http.post(REOPEN, () => HttpResponse.json({ message: msg }, { status: 400 })));

        const { onRecorded } = renderSection();
        await userEvent.click(correctBtn());

        expect(await screen.findByText(msg)).toBeInTheDocument();
        expect(onRecorded).not.toHaveBeenCalled();
    });

    // A warning means the reopen SUCCEEDED but the bracket could not be cleared,
    // leaving manual work. onRecorded() refetches and unmounts this branch, which
    // would discard an inline message — so it has to block until acknowledged.
    it('blocks on a bracket warning yet still refetches', async () => {
        const warn = 'Bracket not cleared: next match already has a recorded score.';
        server.use(http.post(REOPEN, () =>
            HttpResponse.json({ data: { data: { match: {}, rowsDeleted: 1, bracketWarning: warn } } }),
        ));

        const { onRecorded } = renderSection();
        await userEvent.click(correctBtn());

        await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
        expect(window.alert).toHaveBeenCalledWith(warn);
    });
});
