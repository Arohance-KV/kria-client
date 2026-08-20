import API from '@/api/axios';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

export const teamLeagueApi = {
    // Groups
    configureGroups: async (categoryId: string, groups: { name: string; teamIds: string[] }[]) => {
        const res = await API.post(`/sports/badminton/team-league/${categoryId}/groups`, { groups });
        return extract(res);
    },

    randomizeGroups: async (categoryId: string, numberOfGroups: number) => {
        const res = await API.post(`/sports/badminton/team-league/${categoryId}/groups/randomize`, { numberOfGroups });
        return extract(res);
    },

    getGroups: async (categoryId: string, stageNumber?: number) => {
        const params = stageNumber ? { stageNumber } : {};
        const res = await API.get(`/sports/badminton/team-league/${categoryId}/groups`, { params });
        return extract(res);
    },

    updateGroup: async (groupId: string, teamIds: string[]) => {
        const res = await API.put(`/sports/badminton/team-league/groups/${groupId}`, { teamIds });
        return extract(res);
    },

    // Ties
    createTie: async (groupId: string, categoryId: string, team1Id: string, team2Id: string) => {
        const res = await API.post(`/sports/badminton/team-league/groups/${groupId}/ties`, { categoryId, team1Id, team2Id });
        return extract(res);
    },

    deleteTie: async (tieId: string) => {
        const res = await API.delete(`/sports/badminton/team-league/ties/${tieId}`);
        return extract(res);
    },

    getTiesByGroup: async (groupId: string) => {
        const res = await API.get(`/sports/badminton/team-league/groups/${groupId}/ties`);
        return extract(res);
    },

    getTieDetails: async (tieId: string) => {
        const res = await API.get(`/sports/badminton/team-league/ties/${tieId}`);
        return extract(res);
    },

    // Lineups
    submitLineup: async (tieId: string, teamId: string, assignments: { slotNumber: number; playerIds: string[]; playerNames: string[] }[]) => {
        const res = await API.post(`/sports/badminton/team-league/ties/${tieId}/lineup`, { teamId, assignments });
        return extract(res);
    },

    getLineup: async (tieId: string, teamId?: string) => {
        const params = teamId ? { teamId } : {};
        const res = await API.get(`/sports/badminton/team-league/ties/${tieId}/lineup`, { params });
        return extract(res);
    },

    // Sub-match results
    recordSubMatchResult: async (matchId: string, data: any) => {
        const res = await API.post(`/sports/badminton/team-league/sub-matches/${matchId}/result`, data);
        return extract(res);
    },

    // Standings
    getGroupStandings: async (categoryId: string, stageNumber?: number) => {
        const params = stageNumber ? { stageNumber } : {};
        const res = await API.get(`/sports/badminton/team-league/${categoryId}/standings`, { params });
        return extract(res);
    },

    // Advancement
    advanceTeams: async (categoryId: string, stageNumber: number, config: { format: string; numberOfGroups?: number; teamAdvancement: { teamId: string; groupNumber?: number }[] }) => {
        const res = await API.post(`/sports/badminton/team-league/${categoryId}/advance`, { stageNumber, ...config });
        return extract(res);
    },

    // Overview
    getOverview: async (categoryId: string) => {
        const res = await API.get(`/sports/badminton/team-league/${categoryId}/overview`);
        return extract(res);
    },

    // Live scoring
    startLiveScoring: async (matchId: string) => {
        const res = await API.post(`/sports/badminton/team-league/sub-matches/${matchId}/live/start`);
        return extract(res);
    },

    recordLivePoint: async (matchId: string, body: { team: 1 | 2; delta: 1 | -1 }) => {
        const res = await API.post(`/sports/badminton/team-league/sub-matches/${matchId}/live/point`, body);
        return extract(res);
    },

    getLiveSubMatches: async (tournamentId: string) => {
        const res = await API.get(`/sports/badminton/team-league/live/${tournamentId}`);
        return extract(res);
    },
};
