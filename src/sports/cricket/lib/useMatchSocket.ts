import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';
import { useAppDispatch } from '@/store/hooks';
import { liveStateReceived, fetchMatchAndLive } from '@/sports/cricket/store/cricketLiveStateSlice';

/** 'reconnecting' means the connection dropped after it had been up. */
export type MatchSocketStatus = 'connecting' | 'connected' | 'reconnecting';

/**
 * Subscribe to a match's realtime updates. On each `ball:recorded` the live state
 * is pushed into the cricketLiveState slice. Used by the public scoreboard and the
 * organizer console. Server is the source of truth; this only mirrors pushes.
 *
 * Returns the connection status (callers that don't need it ignore it).
 */
export function useMatchSocket(matchId: string | undefined): MatchSocketStatus {
    const dispatch = useAppDispatch();
    const [status, setStatus] = useState<MatchSocketStatus>(socket.connected ? 'connected' : 'connecting');

    useEffect(() => {
        if (!matchId) return;

        // The page fetches on mount, so the FIRST connect needs no refetch; only
        // a reconnect does, to catch up on balls pushed while we were away.
        let wasConnected = socket.connected;
        const onBall = (payload: any) => {
            if (payload?.liveState) {
                dispatch(liveStateReceived({ matchId, liveState: payload.liveState }));
            }
        };
        const join = () => socket.emit('join:match', { matchId });
        const onConnect = () => {
            join();
            setStatus('connected');
            if (wasConnected) dispatch(fetchMatchAndLive(matchId));
            wasConnected = true;
        };
        const onDisconnect = () => setStatus(wasConnected ? 'reconnecting' : 'connecting');

        if (!socket.connected) socket.connect();
        join();
        socket.on('ball:recorded', onBall);
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.emit('leave:match', { matchId });
            socket.off('ball:recorded', onBall);
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, [matchId, dispatch]);

    return status;
}
