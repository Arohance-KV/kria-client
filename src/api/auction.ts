import API from './axios';
import { AuctionStatus, Player, Team } from '../types';

export const auctionApi = {
    // Public polling endpoints
    getStatus: async (tournamentId: string, categoryId: string) => {
        const res = await API.get(`/auction/${tournamentId}/${categoryId}/status`);
        return res.data?.data?.data as {
            auction: AuctionStatus;
            currentPlayer: Player | null;
            teams: Team[];
            category?: { _id: string; name: string } | null;
            tournament?: { _id: string; name: string } | null;
        };
    },

    getSoldLog: async (tournamentId: string, categoryId: string) => {
        const res = await API.get(`/auction/${tournamentId}/${categoryId}/sold-log`);
        return res.data?.data?.data;
    },

    // Protected organizer actions
    start: (tournamentId: string, categoryId: string, opts?: { bidIncrement?: number; hardLimit?: number }) =>
        API.post('/auction/start', { tournamentId, categoryId, ...opts }),

    sell: (tournamentId: string, categoryId: string, teamId: string, soldPrice: number) =>
        API.post('/auction/sell', { tournamentId, categoryId, teamId, soldPrice }),

    bid: (tournamentId: string, categoryId: string, teamId: string) =>
        API.post('/auction/bid', { tournamentId, categoryId, teamId }),

    startTieBreaker: (tournamentId: string, categoryId: string) =>
        API.post('/auction/start-tie-breaker', { tournamentId, categoryId }),

    triggerSpinWheel: (tournamentId: string, categoryId: string) =>
        API.post('/auction/trigger-spin', { tournamentId, categoryId }),

    resolveHardLimit: (tournamentId: string, categoryId: string, winnerTeamId: string) =>
        API.post('/auction/resolve-hard-limit', { tournamentId, categoryId, winnerTeamId }),

    next: (tournamentId: string, categoryId: string) =>
        API.post('/auction/next', { tournamentId, categoryId }),

    distribute: (tournamentId: string, categoryId: string) =>
        API.post('/auction/distribute', { tournamentId, categoryId }),

    skip: (tournamentId: string, categoryId: string) =>
        API.post('/auction/skip', { tournamentId, categoryId }),

    undo: (tournamentId: string, categoryId: string) =>
        API.post('/auction/undo', { tournamentId, categoryId }),

    pause: (tournamentId: string, categoryId: string) =>
        API.post('/auction/pause', { tournamentId, categoryId }),

    end: (tournamentId: string, categoryId: string) =>
        API.post('/auction/end', { tournamentId, categoryId }),
};
