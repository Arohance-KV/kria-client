import API from './axios';
import { AuctionPreAssigned, AuctionSoldLog, AuctionStatus, Player, Team } from '../types';

/** GET /status payload. The socket's `auction:update` event carries the same shape. */
export interface AuctionState {
    auction: AuctionStatus & {
        /** Players after the current one in this round's queue. Unsold players wait for the next round. */
        remainingCount: number;
        lastSoldResult?: AuctionStatus['lastSoldResult'] & { teamId?: string };
    };
    currentPlayer: Player | null;
    /** The next 10 players in queue order. */
    upcoming?: { registrationId: string; playerName: string; playerPhoto?: string | null; basePrice: number; skillLevel?: string | null; queueIndex: number }[];
    /** Passed over this round, in the order they return next round. */
    unsold?: Omit<NonNullable<AuctionState['upcoming']>[number], 'queueIndex'>[];
    teams: Team[];
    category?: { _id: string; name: string } | null;
    tournament?: { _id: string; name: string } | null;
}

export interface SoldLog {
    logs: (AuctionSoldLog & { playerPhoto?: string | null })[];
    preAssigned: AuctionPreAssigned[];
}

export const auctionApi = {
    // Public polling endpoints
    getStatus: async (tournamentId: string, categoryId: string) => {
        const res = await API.get(`/auction/${tournamentId}/${categoryId}/status`);
        return res.data?.data?.data as AuctionState;
    },

    getSoldLog: async (tournamentId: string, categoryId: string) => {
        const res = await API.get(`/auction/${tournamentId}/${categoryId}/sold-log`);
        return res.data?.data?.data as SoldLog;
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

    /** The server picks the winner; resolves to their team ID. */
    triggerSpinWheel: async (tournamentId: string, categoryId: string) => {
        const res = await API.post('/auction/trigger-spin', { tournamentId, categoryId });
        return res.data?.data?.data?.winnerId as string;
    },

    resolveHardLimit: (tournamentId: string, categoryId: string, winnerTeamId: string) =>
        API.post('/auction/resolve-hard-limit', { tournamentId, categoryId, winnerTeamId }),

    next: (tournamentId: string, categoryId: string) =>
        API.post('/auction/next', { tournamentId, categoryId }),

    distribute: async (tournamentId: string, categoryId: string) => {
        const res = await API.post('/auction/distribute', { tournamentId, categoryId });
        return res.data?.data?.data as { assigned: number; teams: number };
    },

    skip: (tournamentId: string, categoryId: string) =>
        API.post('/auction/skip', { tournamentId, categoryId }),

    undo: (tournamentId: string, categoryId: string) =>
        API.post('/auction/undo', { tournamentId, categoryId }),

    pause: (tournamentId: string, categoryId: string) =>
        API.post('/auction/pause', { tournamentId, categoryId }),

    end: (tournamentId: string, categoryId: string) =>
        API.post('/auction/end', { tournamentId, categoryId }),
};
