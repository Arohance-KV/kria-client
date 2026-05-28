import API from '@/api/axios';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

export interface CricketLineupPayload {
    teamId: string;
    startingXI: string[];      // registration IDs
    reserves?: string[];       // registration IDs
}

export interface BallPayload {
    batsmanOnStrikeId: string;
    nonStrikerId: string;
    bowlerId: string;
    runs: number;
    extrasType?: 'wide' | 'no_ball' | 'bye' | 'leg_bye';
    extrasRuns?: number;
    wicketType?: 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket' | 'retired_hurt';
    dismissedPlayerId?: string;
    fielderId?: string;
    commentary?: string;
}

export const cricketMatchApi = {
    getById: async (matchId: string) => {
        const res = await API.get(`/sports/cricket/match/${matchId}`);
        return extract(res);
    },
    getLiveState: async (matchId: string) => {
        const res = await API.get(`/sports/cricket/match/${matchId}/live`);
        return extract(res);
    },
    recordToss: async (matchId: string, winnerTeamId: string, decision: 'bat' | 'bowl') => {
        const res = await API.post(`/sports/cricket/match/${matchId}/toss`, { winnerTeamId, decision });
        return extract(res);
    },
    recordLineup: async (matchId: string, payload: CricketLineupPayload) => {
        const res = await API.post(`/sports/cricket/match/${matchId}/lineup`, payload);
        return extract(res);
    },
    // Sport-agnostic team roster (registration endpoint) — used to populate lineups.
    getTeamRoster: async (teamId: string) => {
        const res = await API.get(`/registrations/teams/${teamId}/roster`);
        return extract(res);
    },
    recordBall: async (matchId: string, payload: BallPayload) => {
        const res = await API.post(`/sports/cricket/match/${matchId}/balls`, payload);
        return extract(res); // { ball, liveState, events, matchEnded, winnerId, winMargin }
    },
    undoLastBall: async (matchId: string) => {
        const res = await API.delete(`/sports/cricket/match/${matchId}/balls/last`);
        return extract(res); // { liveState, ... }
    },
    getScorecard: async (matchId: string) => {
        const res = await API.get(`/sports/cricket/match/${matchId}/scorecard`);
        return extract(res); // { innings1, innings2 }
    },
};
