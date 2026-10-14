import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import cricketLiveStateReducer from '@/sports/cricket/store/cricketLiveStateSlice';
import teamReducer from '@/store/slices/teamSlice';
import { useMatchSocket } from '@/sports/cricket/lib/useMatchSocket';
import CricketScoringConsole from './CricketScoringConsole';

vi.mock('@/sports/cricket/lib/useMatchSocket', () => ({ useMatchSocket: vi.fn(() => 'connected') }));

const API = 'https://api.kria.club/sports/cricket';
const ok = (data: unknown) => HttpResponse.json({ data: { data } });

const xi = (team: string) => [1, 2, 3].map(i => ({ registrationId: `${team}${i}`, name: `${team.toUpperCase()} Player ${i}` }));
const inPlay = {
    _id: 'm1', tournamentId: 'tn1', categoryId: 'c1', status: 'in_progress',
    teams: { team1Id: 't1', team1Name: 'Alpha', team2Id: 't2', team2Name: 'Bravo' },
    cricketSetup: {
        setupComplete: true,
        toss: { recorded: true, winnerTeamId: 't1', decision: 'bat' },
        team1Lineup: { teamId: 't1', lineupSet: true, startingXI: xi('a') },
        team2Lineup: { teamId: 't2', lineupSet: true, startingXI: xi('b') },
    },
};
const chasing = {
    matchStatus: 'innings2', currentInnings: 2, runs: 79, wickets: 1, completedOvers: 9, ballsInCurrentOver: 3,
    battingTeamId: 't2', bowlingTeamId: 't1', strikerId: 'b1', nonStrikerId: 'b2', currentBowlerId: 'a1', target: 81,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
};
const won = {
    ...inPlay, status: 'completed', winnerId: 't2', result: { marginOfVictory: 'by 2 wickets' },
    inningsScores: [{ inningsNumber: 1, runs: 80, wickets: 3, overs: 10, balls: 0 }, { inningsNumber: 2, runs: 83, wickets: 1, overs: 9, balls: 4 }],
};

function serve(matchDocs: unknown[], live: unknown) {
    let n = 0;
    server.use(
        http.get(`${API}/match/m1`, () => ok(matchDocs[Math.min(n++, matchDocs.length - 1)])),
        http.get(`${API}/match/m1/live`, () => ok({ liveState: live })),
        http.get(`${API}/match/m1/scorecard`, () => ok({ innings1: null, innings2: null })),
        http.get(`${API}/category/c1`, () => ok({ name: "Men's T10", cricketConfig: { maxOvers: 10 } })),
        http.get('https://api.kria.club/tournaments/tn1/teams', () => ok([{ _id: 't2', name: 'Bravo', primaryColor: 'rgb(18, 52, 86)' }])),
    );
    return () => n;
}

function renderConsole() {
    const store = configureStore({ reducer: { cricketLiveState: cricketLiveStateReducer, team: teamReducer } });
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={['/organizer/cricket/match/m1/score']}>
                <Routes><Route path="/organizer/cricket/match/:matchId/score" element={<CricketScoringConsole />} /></Routes>
            </MemoryRouter>
        </Provider>,
    );
}

beforeEach(() => vi.mocked(useMatchSocket).mockReturnValue('connected'));

describe('CricketScoringConsole', () => {
    it('opens a match completed by hand on its result, whatever the live state says', async () => {
        serve([{ ...won, cricketSetup: {} }], null);
        renderConsole();
        expect(await screen.findByRole('heading', { name: 'Bravo won by 2 wickets' })).toBeInTheDocument();
    });

    it('locks the pad and says so while the socket reconnects', async () => {
        vi.mocked(useMatchSocket).mockReturnValue('reconnecting');
        serve([inPlay], chasing);
        renderConsole();
        expect(await screen.findByText(/Scoring is locked until the connection is back/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^1 run$/ })).toBeDisabled();
    });

    // Cricket match docs carry no team colours; the tournament's teams do.
    it('paints team badges in the team colour', async () => {
        serve([inPlay], chasing);
        renderConsole();
        await waitFor(() => expect(screen.getAllByText('B').map(el => el.style.background)).toContain('rgb(18, 52, 86)'));
    });

    it('shows the result straight after the final ball, re-reading the match', async () => {
        const reads = serve([inPlay, won], chasing);
        server.use(http.post(`${API}/match/m1/balls`, () => ok({ liveState: { ...chasing, runs: 83, ballsInCurrentOver: 4, matchStatus: 'completed' }, matchEnded: true, winnerId: 't2' })));
        renderConsole();

        await userEvent.click(await screen.findByRole('button', { name: /^4 runs$/ }));

        expect(await screen.findByRole('heading', { name: 'Bravo won by 2 wickets' })).toBeInTheDocument();
        expect(reads()).toBe(2);
    });
});
