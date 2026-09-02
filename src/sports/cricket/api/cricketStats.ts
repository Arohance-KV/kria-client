import API from '@/api/axios';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

export type CricketSort = 'runs' | 'wickets' | 'sr' | 'economy' | 'fours' | 'sixes' | 'highest';

export const cricketStatsApi = {
    getLeaderboard: async (categoryId: string, sort: CricketSort = 'runs') => {
        const res = await API.get(`/cricket/categories/${categoryId}/leaderboard`, { params: { sort } });
        return extract(res); // { categoryId, sort, leaderboard: [...] }
    },
};
