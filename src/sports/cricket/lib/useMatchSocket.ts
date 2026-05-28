import { useEffect } from 'react';
import { socket } from '@/lib/socket';
import { useAppDispatch } from '@/store/hooks';
import { liveStateReceived, fetchMatchAndLive } from '@/sports/cricket/store/cricketLiveStateSlice';

/**
 * Subscribe to a match's realtime updates. On each `ball:recorded` the live state
 * is pushed into the cricketLiveState slice. Used by the public scoreboard and the
 * organizer console. Server is the source of truth; this only mirrors pushes.
 */
export function useMatchSocket(matchId: string | undefined) {
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (!matchId) return;

        const onBall = (payload: any) => {
            if (payload?.liveState) {
                dispatch(liveStateReceived({ matchId, liveState: payload.liveState }));
            }
        };
        const join = () => socket.emit('join:match', { matchId });
        const onReconnect = () => { join(); dispatch(fetchMatchAndLive(matchId)); };

        if (!socket.connected) socket.connect();
        join();
        socket.on('ball:recorded', onBall);
        socket.on('connect', onReconnect);

        return () => {
            socket.emit('leave:match', { matchId });
            socket.off('ball:recorded', onBall);
            socket.off('connect', onReconnect);
        };
    }, [matchId, dispatch]);
}
