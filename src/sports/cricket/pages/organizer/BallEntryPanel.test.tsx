import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import cricketLiveStateReducer from '@/sports/cricket/store/cricketLiveStateSlice';
import BallEntryPanel from './BallEntryPanel';

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

/** Innings 2 has just been opened: the server holds no batsmen yet. */
const innings2Fresh = {
    matchStatus: 'innings2',
    currentInnings: 2,
    runs: 0, wickets: 0, completedOvers: 0, ballsInCurrentOver: 0,
    battingTeamId: 't1', bowlingTeamId: 't2',
    strikerId: undefined, nonStrikerId: undefined, currentBowlerId: undefined,
    nextBatsmanNeeded: false, nextBowlerNeeded: false,
};

function renderPanel(live: Record<string, unknown>, initial: Record<string, string> = {}) {
    const store = configureStore({ reducer: { cricketLiveState: cricketLiveStateReducer } });
    const view = render(
        <Provider store={store}>
            <BallEntryPanel matchId="m1" match={match} live={live} {...initial} />
        </Provider>,
    );
    return { store, view };
}

describe('BallEntryPanel — openers chosen locally must survive a live-state refresh', () => {
    it('keeps the openers picked for innings 2 when the server has none yet', async () => {
        // Start Innings 2 collects the openers and hands them down as initial
        // ids. The server's live state legitimately has no batsmen until the
        // first ball posts, so a mirror effect that copies both ends
        // unconditionally erases the pick and the panel refuses to score.
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

        await userEvent.click(screen.getByRole('button', { name: /^1 runs$/ }));

        expect(screen.queryByText(/must all be set/i)).not.toBeInTheDocument();
    });

    it('still adopts both ends once the server names them', () => {
        renderPanel({ ...innings2Fresh, strikerId: 'k1', nonStrikerId: 'k2', currentBowlerId: 't2a' });
        expect(screen.queryByText(/must all be set/i)).not.toBeInTheDocument();
    });
});

describe('BallEntryPanel — replacing a dismissed batsman', () => {
    it('fills the end the server vacated and never posts the batsman who is out', async () => {
        // Meera (k2) was the non-striker and is out, so the engine cleared that
        // end. Sending the replacement in as STRIKER would evict Nikhil, who is
        // not out, and post Meera straight back as non-striker.
        let posted: Record<string, unknown> | null = null;
        server.use(http.post('https://api.kria.club/sports/cricket/match/m1/balls', async ({ request }) => {
            posted = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({ data: { data: {} } });
        }));

        renderPanel({
            ...innings2Fresh,
            strikerId: 'k1',
            nonStrikerId: undefined,
            currentBowlerId: 't2a',
            nextBatsmanNeeded: true,
        });

        expect(screen.getByText(/select next batsman/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Aditya Nair/i }));
        await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
        await userEvent.click(screen.getByRole('button', { name: /^1 runs$/ }));

        await waitFor(() => expect(posted).not.toBeNull());
        expect(posted).toMatchObject({ batsmanOnStrikeId: 'k1', nonStrikerId: 'k3' });
    });
});
