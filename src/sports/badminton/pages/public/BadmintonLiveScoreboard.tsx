import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import API from '@/api/axios';
import { useBadmintonMatchSocket } from '@/sports/badminton/lib/useBadmintonMatchSocket';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

// Fixed per-side accents so the two teams always read as distinct.
const SIDE = [
    { accent: '#F97316', glow: 'rgba(249,115,22,0.55)', soft: 'rgba(249,115,22,0.12)' }, // team 1 — orange
    { accent: '#38BDF8', glow: 'rgba(56,189,248,0.55)', soft: 'rgba(56,189,248,0.12)' },  // team 2 — cyan
];

export default function BadmintonLiveScoreboard({ matchId }: { matchId: string }) {
    const [match, setMatch] = useState<any>(null);
    const [flash, setFlash] = useState<0 | 1 | 2>(0); // which side just scored (1 or 2)
    const prev = useRef<{ t1: number; t2: number } | null>(null);
    const flashTimer = useRef<any>(null);

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

    // Detect which side's score went up and flash that panel.
    useEffect(() => {
        if (!match) return;
        const games: any[] = match.gameScores || [];
        const cur = [...games].reverse().find(g => !g.winnerId) || games[games.length - 1] || { team1Score: 0, team2Score: 0 };
        const p = prev.current;
        if (p) {
            const side: 0 | 1 | 2 = cur.team1Score > p.t1 ? 1 : cur.team2Score > p.t2 ? 2 : 0;
            if (side) {
                setFlash(side);
                clearTimeout(flashTimer.current);
                flashTimer.current = setTimeout(() => setFlash(0), 600);
            }
        }
        prev.current = { t1: cur.team1Score, t2: cur.team2Score };
    }, [match]);

    useEffect(() => () => clearTimeout(flashTimer.current), []);

    if (!match) {
        return <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    const t1 = match.player1?.name || match.teams?.team1Name || 'Team 1';
    const t2 = match.player2?.name || match.teams?.team2Name || 'Team 2';
    // Per-game winnerId key matches what the backend stores: teamId for team-league
    // sub-matches (they carry a tieId) and team brackets; registrationId for player knockout.
    const isTeamKey = !!match.tieId || match.competitorType === 'team';
    const team1Id = isTeamKey ? (match.player1?.teamId || match.teams?.team1Id) : match.player1?.registrationId;
    const games: any[] = match.gameScores || [];
    const open = [...games].reverse().find(g => !g.winnerId) || games[games.length - 1] || { gameNumber: 1, team1Score: 0, team2Score: 0 };
    const gamesT1 = games.filter(g => (g.winnerId?.toString?.() || g.winnerId) === team1Id).length;
    const gamesT2 = games.filter(g => g.winnerId).length - gamesT1;
    const completed = match.status === 'completed';

    const pointsToWin = match.matchConfig?.pointsToWin ?? 21;
    const bestOf = match.matchConfig?.bestOf ?? 3;
    const gamesToWin = Math.ceil(bestOf / 2);

    const s1 = open.team1Score ?? 0;
    const s2 = open.team2Score ?? 0;
    const lead: 0 | 1 | 2 = completed
        ? (gamesT1 > gamesT2 ? 1 : gamesT2 > gamesT1 ? 2 : 0)
        : (s1 > s2 ? 1 : s2 > s1 ? 2 : 0);

    // Game / match point (simple badminton heuristic).
    const pointBadge = (score: number, opp: number, gw: number): string | null => {
        if (completed) return null;
        if (score >= pointsToWin - 1 && score > opp) return gw >= gamesToWin - 1 ? 'MATCH POINT' : 'GAME POINT';
        return null;
    };

    const sides = [
        { name: t1, score: s1, gw: gamesT1, badge: pointBadge(s1, s2, gamesT1), style: SIDE[0], n: 1 as const },
        { name: t2, score: s2, gw: gamesT2, badge: pointBadge(s2, s1, gamesT2), style: SIDE[1], n: 2 as const },
    ];

    return (
        <div className="min-h-screen bg-[#0B0B0B] text-white flex flex-col items-center justify-center gap-10 p-6 relative overflow-hidden">
            <style>{`
                @keyframes scorePop { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
                @keyframes badgePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
                .score-pop { animation: scorePop 0.5s cubic-bezier(0.34,1.56,0.64,1); }
            `}</style>

            {/* Ambient glow from whoever's leading */}
            {lead !== 0 && (
                <div
                    className="pointer-events-none absolute inset-0 transition-opacity duration-700"
                    style={{ background: `radial-gradient(circle at ${lead === 1 ? '25%' : '75%'} 45%, ${sides[lead - 1].style.glow}, transparent 60%)`, opacity: 0.35 }}
                />
            )}

            {/* Status pill */}
            <div className={`z-10 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold ${completed ? 'text-emerald-400' : 'text-red-400'}`}>
                {completed
                    ? <><Trophy className="h-3.5 w-3.5" /> Final</>
                    : <><span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Live · Game {open.gameNumber}</>}
            </div>

            {/* Team panels */}
            <div className="z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8 w-full max-w-4xl">
                {sides.map((s, idx) => {
                    const isLead = lead === s.n;
                    const isFlash = flash === s.n;
                    return (
                        <React.Fragment key={s.n}>
                            {idx === 1 && (
                                <div className="flex flex-col items-center gap-2 text-gray-600">
                                    <span className="font-oswald font-black text-xl md:text-2xl tracking-widest">VS</span>
                                    <span className="text-[9px] uppercase tracking-widest text-gray-700">Best of {bestOf}</span>
                                </div>
                            )}
                            <div
                                className="flex flex-col items-center gap-4 rounded-3xl px-4 py-8 md:px-8 transition-all duration-500 border"
                                style={{
                                    background: isLead ? s.style.soft : 'rgba(255,255,255,0.02)',
                                    borderColor: isLead ? s.style.accent : 'rgba(255,255,255,0.06)',
                                    boxShadow: isLead ? `0 0 40px ${s.style.glow}` : 'none',
                                }}
                            >
                                {/* Games-won pips */}
                                <div className="flex items-center gap-1.5 h-3">
                                    {Array.from({ length: gamesToWin }).map((_, i) => (
                                        <span key={i} className="h-2.5 w-2.5 rounded-full transition-colors duration-300"
                                            style={{ background: i < s.gw ? s.style.accent : 'rgba(255,255,255,0.12)' }} />
                                    ))}
                                </div>

                                <div className="text-base md:text-xl font-oswald font-bold uppercase tracking-wide text-center text-gray-200 max-w-[15ch] truncate">
                                    {s.name}
                                </div>

                                <div
                                    key={`${s.n}-${s.score}`}
                                    className={`text-8xl md:text-[10rem] leading-none font-black tabular-nums ${isFlash ? 'score-pop' : ''}`}
                                    style={{ color: isLead ? s.style.accent : '#fff', textShadow: isFlash ? `0 0 30px ${s.style.glow}` : 'none' }}
                                >
                                    {s.score}
                                </div>

                                {/* Point badge or games label */}
                                <div className="h-6 flex items-center">
                                    {s.badge ? (
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-black"
                                            style={{ background: s.style.accent, animation: 'badgePulse 1s infinite' }}>
                                            {s.badge}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] uppercase tracking-widest text-gray-500">Games {s.gw}</span>
                                    )}
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Completed games history */}
            {games.some(g => g.winnerId) && (
                <div className="z-10 flex flex-wrap justify-center gap-2 text-sm text-gray-400">
                    {games.filter(g => g.winnerId).map((g, i) => {
                        const won1 = (g.winnerId?.toString?.() || g.winnerId) === team1Id;
                        return (
                            <span key={i} className="px-3 py-1 rounded-lg bg-white/5 border border-white/5 tabular-nums">
                                <span className="text-[9px] text-gray-600 mr-1.5">G{g.gameNumber}</span>
                                <span style={{ color: won1 ? SIDE[0].accent : '#9ca3af', fontWeight: won1 ? 700 : 400 }}>{g.team1Score}</span>
                                <span className="text-gray-600 mx-0.5">–</span>
                                <span style={{ color: !won1 ? SIDE[1].accent : '#9ca3af', fontWeight: !won1 ? 700 : 400 }}>{g.team2Score}</span>
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Winner banner */}
            {completed && lead !== 0 && (
                <div className="z-10 flex items-center gap-2 text-lg font-oswald font-bold uppercase tracking-wide" style={{ color: sides[lead - 1].style.accent }}>
                    <Trophy className="h-5 w-5" /> {sides[lead - 1].name} wins
                </div>
            )}
        </div>
    );
}
