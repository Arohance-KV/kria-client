import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import API from '@/api/axios';
import { useBadmintonMatchSocket } from '@/sports/badminton/lib/useBadmintonMatchSocket';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

export default function BadmintonLiveScoreboard({ matchId }: { matchId: string }) {
    const [match, setMatch] = useState<any>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const m = extract(await API.get(`/matches/${matchId}`));
                if (active) setMatch(m);
            } catch { /* keep spinner */ }
        })();
        return () => { active = false; };
    }, [matchId]);

    const onUpdate = useCallback((m: any) => setMatch(m), []);
    useBadmintonMatchSocket(matchId, onUpdate);

    if (!match) {
        return <div className="min-h-screen bg-[#111] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    const t1 = match.player1?.name || match.teams?.team1Name || 'Team 1';
    const t2 = match.player2?.name || match.teams?.team2Name || 'Team 2';
    const team1Id = match.player1?.teamId || match.teams?.team1Id;
    const games: any[] = match.gameScores || [];
    const open = [...games].reverse().find(g => !g.winnerId) || games[games.length - 1] || { gameNumber: 1, team1Score: 0, team2Score: 0 };
    const gamesT1 = games.filter(g => (g.winnerId?.toString?.() || g.winnerId) === team1Id).length;
    const gamesT2 = games.length - gamesT1 - games.filter(g => !g.winnerId).length;
    const completed = match.status === 'completed';

    return (
        <div className="min-h-screen bg-[#111] text-white flex flex-col items-center justify-center gap-8 p-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-red-400 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                {completed ? 'Final' : `Live · Game ${open.gameNumber}`}
            </div>
            <div className="grid grid-cols-2 gap-10 items-center">
                {[{ name: t1, score: open.team1Score, gw: gamesT1 }, { name: t2, score: open.team2Score, gw: gamesT2 }].map((s, i) => (
                    <div key={i} className="flex flex-col items-center gap-3">
                        <div className="text-lg font-semibold text-gray-300 text-center">{s.name}</div>
                        <div className="text-7xl md:text-8xl font-extrabold tabular-nums">{s.score}</div>
                        <div className="text-xs uppercase tracking-widest text-gray-500">Games {s.gw}</div>
                    </div>
                ))}
            </div>
            {games.some(g => g.winnerId) && (
                <div className="flex gap-2 text-sm text-gray-400">
                    {games.filter(g => g.winnerId).map((g, i) => (
                        <span key={i} className="px-2 py-1 rounded bg-white/5 tabular-nums">{g.team1Score}–{g.team2Score}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
