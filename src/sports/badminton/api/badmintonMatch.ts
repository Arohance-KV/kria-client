import API from '@/api/axios';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

export interface BadmintonGameScore {
    gameNumber: number;
    team1Score: number;
    team2Score: number;
}

export const badmintonMatchApi = {
    recordResult: async (
        matchId: string,
        winnerId: string,
        gameScores: BadmintonGameScore[],
    ) => {
        const gamesWon1 = gameScores.filter(g => g.team1Score > g.team2Score).length;
        const gamesWon2 = gameScores.filter(g => g.team2Score > g.team1Score).length;
        const res = await API.post(`/sports/badminton/match/${matchId}/result`, {
            winnerId,
            gameScores,
            winReason: 'by_score',
            result: {
                team1Total: gamesWon1,
                team2Total: gamesWon2,
                marginOfVictory: `${Math.max(gamesWon1, gamesWon2)}-${Math.min(gamesWon1, gamesWon2)}`,
            },
        });
        return extract(res);
    },
};
