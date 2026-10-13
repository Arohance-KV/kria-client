import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import cricketLiveStateReducer from '@/sports/cricket/store/cricketLiveStateSlice';
import BallEntryPanel from './BallEntryPanel';

const BALLS = 'https://api.kria.club/sports/cricket/match/m1/balls';

const match = {
    _id: 'm1',
    teams: { team1Id: 't1', team1Name: 'Knights', team2Id: 't2', team2Name: 'Titans' },
    cricketSetup: {
        setupComplete: true,
        team1Lineup: { teamId: 't1', startingXI: [
            { registrationId: 'k1', name: 'Nikhil Iyer' },
            { registrationId: 'k2', name: 'Meera Reddy' },
            { registrationId: 'k3', name: 'Aditya Nair' },
        ] },
        team2Lineup: { teamId: 't2', startingXI: [
            { registrationId: 't2a', name: 'Aditya Iyer' },
            { registrationId: 't2b', name: 'Varun Reddy' },
        ] },
    },
};

/** Innings 2 has just been opened: the server holds no batters yet. */
const innings2Fresh = {
    matchStatus: 'innings2',
    currentInnings: 2,
    runs: 0, wickets: 0, completedOvers: 0, ballsInCurrentOver: 0,
    battingTeamId: 't1', bowlingTeamId: 't2',
    strikerId: undefined, nonStrikerId: undefined, currentBowlerId: undefined,
    nextBatsmanNeeded: false, nextBowlerNeeded: false,
};

/** Mid-over, everyone in place. */
const midOver = { ...innings2Fresh, runs: 12, ballsInCurrentOver: 2, strikerId: 'k1', nonStrikerId: 'k2', currentBowlerId: 't2a' };

function renderPanel(live: Record<string, unknown>, props: Record<string, unknown> = {}) {
    const store = configureStore({ reducer: { cricketLiveState: cricketLiveStateReducer } });
    const view = render(
        <Provider store={store}>
            <BallEntryPanel matchId="m1" match={match} live={live} {...props} />
        </Provider>,
    );
    return { store, view };
}

/** Records every ball posted; replies with an empty success. */
function capturePosts() {
    const posted: Record<string, unknown>[] = [];
    server.use(http.post(BALLS, async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: { data: {} } });
    }));
    return posted;
}

describe('BallEntryPanel — openers chosen locally must survive a live-state refresh', () => {
    it('keeps the openers picked for innings 2 when the server has none yet', async () => {
        // Start Innings 2 collects the openers and hands them down as initial
        // ids. The server's live state legitimately has no batters until the
        // first ball posts, so a mirror that copies both ends unconditionally
        // erases the pick and the panel refuses to score.
        capturePosts();
        const { view } = renderPanel(innings2Fresh, {
            initialStrikerId: 'k1',
            initialNonStrikerId: 'k2',
            initialBowlerId: 't2a',
        });

        // A refreshed poll delivers a NEW object with the same empty ends.
        view.rerender(
            <Provider store={configureStore({ reducer: { cricketLiveState: cricketLiveStateReducer } })}>
                <BallEntryPanel
                    matchId="m1" match={match} live={{ ...innings2Fresh }}
                    initialStrikerId="k1" initialNonStrikerId="k2" initialBowlerId="t2a"
                />
            </Provider>,
        );

        await userEvent.click(screen.getByRole('button', { name: /^1 run$/ }));

        expect(screen.queryByText(/must all be set/i)).not.toBeInTheDocument();
    });

    it('still adopts both ends once the server names them', () => {
        renderPanel({ ...innings2Fresh, strikerId: 'k1', nonStrikerId: 'k2', currentBowlerId: 't2a' });
        expect(screen.queryByText(/must all be set/i)).not.toBeInTheDocument();
    });
});

describe('BallEntryPanel — replacing a dismissed batter', () => {
    it('fills the end the server vacated and never posts the batter who is out', async () => {
        // Meera (k2) was the non-striker and is out, so the engine cleared that
        // end. Sending the replacement in as STRIKER would evict Nikhil, who is
        // not out, and post Meera straight back as non-striker.
        const posted = capturePosts();

        renderPanel({
            ...innings2Fresh,
            strikerId: 'k1',
            nonStrikerId: undefined,
            currentBowlerId: 't2a',
            nextBatsmanNeeded: true,
        });

        expect(screen.getByText(/who comes in\?/i)).toBeInTheDocument();
        // Nothing can be scored until the new batter is named.
        expect(screen.getByRole('button', { name: /^1 run$/ })).toBeDisabled();
        await userEvent.click(screen.getByRole('radio', { name: /Aditya Nair/i }));
        await userEvent.click(screen.getByRole('button', { name: /^1 run$/ }));

        await waitFor(() => expect(posted).toHaveLength(1));
        expect(posted[0]).toMatchObject({ batsmanOnStrikeId: 'k1', nonStrikerId: 'k3' });
    });
});

describe('BallEntryPanel — a wicket on the last ball of an over', () => {
    it('asks for the new batter and the new bowler together', async () => {
        // Both flags stay set on the server until the next ball posts, so asking
        // one at a time would leave the bowler prompt unreachable and the pad locked.
        const posted = capturePosts();
        renderPanel({ ...midOver, completedOvers: 1, ballsInCurrentOver: 0, wickets: 1, nonStrikerId: undefined, nextBatsmanNeeded: true, nextBowlerNeeded: true });

        await userEvent.click(screen.getByRole('radio', { name: /Aditya Nair/ }));
        expect(screen.getByRole('button', { name: /^1 run$/ })).toBeDisabled();
        await userEvent.click(screen.getByRole('radio', { name: /Varun Reddy/ }));
        await userEvent.click(screen.getByRole('button', { name: /^1 run$/ }));

        await waitFor(() => expect(posted).toHaveLength(1));
        expect(posted[0]).toMatchObject({ batsmanOnStrikeId: 'k1', nonStrikerId: 'k3', bowlerId: 't2b' });
    });
});

describe('BallEntryPanel — extras', () => {
    it.each([
        ['Wide', '0 runs with Wide', { runs: 0, extrasType: 'wide', extrasRuns: 1 }],
        ['No-ball', '4 runs with No-ball', { runs: 4, extrasType: 'no_ball', extrasRuns: 1 }],
        ['Bye', '2 runs with Bye', { runs: 0, extrasType: 'bye', extrasRuns: 2 }],
    ])('%s then "%s" posts the server contract', async (extra, run, expected) => {
        const posted = capturePosts();
        renderPanel(midOver);

        await userEvent.click(screen.getByRole('button', { name: extra }));
        await userEvent.click(screen.getByRole('button', { name: run }));

        await waitFor(() => expect(posted).toHaveLength(1));
        expect(posted[0]).toMatchObject(expected);
        // The modifier applies to one ball only.
        expect(screen.getByRole('button', { name: extra })).toHaveAttribute('aria-pressed', 'false');
    });

    it('cannot record zero byes', async () => {
        renderPanel(midOver);
        await userEvent.click(screen.getByRole('button', { name: 'Leg-bye' }));
        expect(screen.getByRole('button', { name: '0 runs with Leg-bye' })).toBeDisabled();
    });
});

describe('BallEntryPanel — undo', () => {
    it('asks first, naming the ball, and only then deletes it', async () => {
        let hits = 0;
        server.use(http.delete(`${BALLS}/last`, () => {
            hits += 1;
            return HttpResponse.json({ data: { data: {} } });
        }));
        renderPanel(midOver, { lastBall: '12.3 · 4' });

        await userEvent.click(screen.getByRole('button', { name: /^undo$/i }));
        expect(screen.getByText('Undo 12.3 · 4?')).toBeInTheDocument();
        expect(hits).toBe(0);

        await userEvent.click(screen.getByRole('button', { name: 'Undo ball' }));
        await waitFor(() => expect(hits).toBe(1));
    });

    it('stays available while the next bowler is being picked', () => {
        renderPanel({ ...midOver, completedOvers: 1, ballsInCurrentOver: 0, nextBowlerNeeded: true });
        expect(screen.getByRole('button', { name: /^undo$/i })).toBeEnabled();
    });
});

describe('BallEntryPanel — next bowler', () => {
    it('will not let the last over\'s bowler bowl the next one', async () => {
        renderPanel({ ...midOver, completedOvers: 1, ballsInCurrentOver: 0, nextBowlerNeeded: true });

        const last = screen.getByRole('radio', { name: /Aditya Iyer/ });
        expect(last).toBeDisabled();
        expect(last).toHaveTextContent('Bowled the last over');

        expect(screen.getByRole('button', { name: /^1 run$/ })).toBeDisabled();
        await userEvent.click(screen.getByRole('radio', { name: /Varun Reddy/ }));
        expect(screen.getByRole('button', { name: /^1 run$/ })).toBeEnabled();
    });
});

describe('BallEntryPanel — wicket', () => {
    it('drops run-out runs when the mode of dismissal changes', async () => {
        const posted = capturePosts();
        renderPanel(midOver);

        await userEvent.click(screen.getByRole('button', { name: 'Wicket' }));
        await userEvent.click(screen.getByRole('radio', { name: 'Run out' }));
        await userEvent.click(screen.getByRole('radio', { name: '2' }));
        await userEvent.click(screen.getByRole('radio', { name: 'Bowled' }));
        await userEvent.click(screen.getByRole('radio', { name: 'Run out' }));
        expect(screen.getByRole('radio', { name: '0' })).toBeChecked();

        // Fielders come from the bowling XI, bowler first and marked.
        await userEvent.click(screen.getByRole('radio', { name: /Varun Reddy/ }));
        expect(screen.getByText(/Scorecard reads:/)).toHaveTextContent('Nikhil Iyer run out (Varun Reddy)');
        await userEvent.click(screen.getByRole('button', { name: 'Record wicket' }));

        await waitFor(() => expect(posted).toHaveLength(1));
        expect(posted[0]).toMatchObject({ runs: 0, wicketType: 'run_out', dismissedPlayerId: 'k1', fielderId: 't2b' });
    });

    it('offers fielders on ball one, before the server names the bowling side', async () => {
        // No live state yet: the fielding side comes from the toss.
        const tossed = { ...match, cricketSetup: { ...match.cricketSetup, toss: { recorded: true, winnerTeamId: 't1', decision: 'bat' } } };
        const store = configureStore({ reducer: { cricketLiveState: cricketLiveStateReducer } });
        render(
            <Provider store={store}>
                <BallEntryPanel matchId="m1" match={tossed} live={null} initialStrikerId="k1" initialNonStrikerId="k2" initialBowlerId="t2a" />
            </Provider>,
        );
        await userEvent.click(screen.getByRole('button', { name: 'Wicket' }));
        expect(screen.getByRole('radio', { name: /Aditya Iyer.*Bowler/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Varun Reddy/ })).toBeInTheDocument();
    });
});

describe('BallEntryPanel — failures and connection', () => {
    it('shows the server\'s reason a ball was refused', async () => {
        server.use(http.post(BALLS, () =>
            HttpResponse.json({ message: 'Bowler has already bowled their maximum 4 overs. Pick another bowler.' }, { status: 400 }),
        ));
        renderPanel(midOver);

        await userEvent.click(screen.getByRole('button', { name: /^4 runs$/ }));

        expect(await screen.findByText('Bowler has already bowled their maximum 4 overs. Pick another bowler.')).toBeInTheDocument();
    });

    it('locks the pad while the connection is down', () => {
        renderPanel(midOver, { offline: true });
        expect(screen.getByRole('button', { name: /^1 run$/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Wicket' })).toBeDisabled();
        expect(screen.getByRole('button', { name: /^undo$/i })).toBeDisabled();
    });
});
