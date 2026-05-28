import API from '@/api/axios';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

export const cricketCategoryApi = {
    create: async (data: Record<string, unknown>) => {
        const res = await API.post('/sports/cricket/category/', data);
        return extract(res);
    },
    update: async (id: string, data: Record<string, unknown>) => {
        const res = await API.put(`/sports/cricket/category/${id}`, data);
        return extract(res);
    },
    getById: async (id: string) => {
        const res = await API.get(`/sports/cricket/category/${id}`);
        return extract(res);
    },
    getByTournament: async (tournamentId: string) => {
        const res = await API.get(`/sports/cricket/category/by-tournament/${tournamentId}`);
        return extract(res);
    },
};
