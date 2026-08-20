import { useEffect } from 'react';
import { socket } from '@/lib/socket';
import API from '@/api/axios';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

export function useBadmintonMatchSocket(matchId: string | undefined, onUpdate: (match: any) => void) {
    useEffect(() => {
        if (!matchId) return;

        const onScore = (payload: any) => { if (payload?.match) onUpdate(payload.match); };
        const join = () => socket.emit('join:match', { matchId });
        const refetch = async () => {
            try { onUpdate(extract(await API.get(`/matches/${matchId}`))); } catch { /* ignore */ }
        };
        const onReconnect = () => { join(); refetch(); };

        if (!socket.connected) socket.connect();
        join();
        socket.on('score:update', onScore);
        socket.on('connect', onReconnect);

        return () => {
            socket.emit('leave:match', { matchId });
            socket.off('score:update', onScore);
            socket.off('connect', onReconnect);
        };
    }, [matchId, onUpdate]);
}
