import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import teamReducer from '@/store/slices/teamSlice';
import TeamLeagueSection from './TeamLeagueSection';

/**
 * Standings used to be fetched once by this section's mount effect and handed
 * to GroupStandingsTable as a prop. Opening the Standings tab therefore showed
 * whatever was true when the page first loaded — '0/3 ties completed' on a
 * finished group — and because the Advance button is gated on that same data,
 * it stayed hidden. Overview never had the bug: it is conditionally mounted
 * and fetches on its own mount.
 */

const BASE = 'https://api.kria.club/sports/badminton/team-league/cat1';

const CATEGORIES = [{
    _id: 'cat1', name: 'Doubles League', status: 'ongoing',
    bracketType: 'team_league', teamLeagueConfig: { topNPerGroup: 1 },
}];

const GROUPS = [{
    _id: 'g1', groupName: 'Group A', groupNumber: 1, stageNumber: 1,
    teamIds: ['t1', 't2', 't3'], teams: [],
}];

/**
 * Three teams in the group, as in the reported case. A single group of two or
 * fewer is the final, and GroupStandingsTable rightly crowns a champion there
 * instead of offering an advance.
 */
const EMPTY_STANDINGS = [{
    group: { _id: 'g1', groupName: 'Group A', groupNumber: 1 },
    totalTies: 3, completedTies: 0,
    standings: [
        { teamId: 't1', teamName: 'Rally Rangers', played: 0, won: 0, lost: 0, drawn: 0, points: 0, subMatchesWon: 0, subMatchesLost: 0 },
        { teamId: 't2', teamName: 'Drop Shot Dragons', played: 0, won: 0, lost: 0, drawn: 0, points: 0, subMatchesWon: 0, subMatchesLost: 0 },
        { teamId: 't3', teamName: 'Baseline Blazers', played: 0, won: 0, lost: 0, drawn: 0, points: 0, subMatchesWon: 0, subMatchesLost: 0 },
    ],
}];

/** All three ties played since — what the server would return now. */
const FULL_STANDINGS = [{
    group: { _id: 'g1', groupName: 'Group A', groupNumber: 1 },
    totalTies: 3, completedTies: 3,
    standings: [
        { teamId: 't1', teamName: 'Rally Rangers', played: 2, won: 2, lost: 0, drawn: 0, points: 4, subMatchesWon: 4, subMatchesLost: 0 },
        { teamId: 't2', teamName: 'Baseline Blazers', played: 2, won: 1, lost: 1, drawn: 0, points: 2, subMatchesWon: 2, subMatchesLost: 2 },
        { teamId: 't3', teamName: 'Drop Shot Dragons', played: 2, won: 0, lost: 2, drawn: 0, points: 0, subMatchesWon: 0, subMatchesLost: 4 },
    ],
}];

const envelope = (data: unknown) => HttpResponse.json({ data: { data } });

/** Standings go stale after the first read, as they do when results land elsewhere. */
function mockApi() {
    let standingsCalls = 0;
    const counter = { get calls() { return standingsCalls; } };
    server.use(
        http.get(`${BASE}/standings`, () => {
            standingsCalls++;
            return envelope(standingsCalls === 1 ? EMPTY_STANDINGS : FULL_STANDINGS);
        }),
        http.get(`${BASE}/groups`, () => envelope(GROUPS)),
        http.get(`${BASE}/overview`, () => envelope({ stages: [{ stageNumber: 1 }] })),
        http.get('https://api.kria.club/teams/tournament/tour1', () => envelope([])),
    );
    return counter;
}

const renderSection = () => {
    const store = configureStore({ reducer: { team: teamReducer } });
    return render(
        <Provider store={store}>
            <TeamLeagueSection tournamentId="tour1" categories={CATEGORIES} />
        </Provider>,
    );
};

const openTab = async (name: RegExp) => {
    await userEvent.click(await screen.findByRole('button', { name }));
};

beforeEach(() => {
    server.resetHandlers();
});

describe('TeamLeagueSection — standings freshness', () => {
    it('refetches standings when the Standings tab is opened', async () => {
        const api = mockApi();
        renderSection();
        await waitFor(() => expect(api.calls).toBe(1));

        await openTab(/standings/i);

        await waitFor(() => expect(api.calls).toBeGreaterThan(1));
    });

    it('shows the completed tie count rather than the count from page load', async () => {
        mockApi();
        renderSection();
        await openTab(/standings/i);

        expect(await screen.findByText('3/3 ties completed')).toBeTruthy();
    });

    it('offers Advance to Stage 2 once the refetched standings are complete', async () => {
        // The button is gated on completedTies === totalTies, so a stale zero
        // hid it on a group that had actually finished.
        mockApi();
        renderSection();
        await openTab(/standings/i);

        expect(await screen.findByRole('button', { name: /advance teams to stage 2/i })).toBeTruthy();
    });
});
