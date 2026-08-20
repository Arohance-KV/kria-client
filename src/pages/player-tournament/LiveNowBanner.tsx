import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '@/api/axios';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

interface LiveMatch {
    _id: string;
    teams?: { team1Name?: string; team2Name?: string };
    cricketLiveState?: {
        runs?: number;
        wickets?: number;
        completedOvers?: number;
        ballsInCurrentOver?: number;
        battingTeamId?: string;
        target?: number;
        currentInnings?: number;
    };
    matchConfig?: { maxOvers?: number };
    // Badminton team-league sub-match fields (client strict mode is off, so these are loosely typed)
    player1?: { name?: string; teamId?: string };
    player2?: { name?: string; teamId?: string };
    gameScores?: any[];
    status?: string;
}

interface Props { tournamentId: string; sport?: string }

export default function LiveNowBanner({ tournamentId, sport }: Props) {
    const [matches, setMatches] = useState<LiveMatch[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                let list: LiveMatch[] = [];
                if (sport === 'cricket' || !sport) {
                    const res = await API.get(`/sports/cricket/match/by-tournament/${tournamentId}`);
                    list = (extract(res) || []).filter((m: any) => m.status === 'in_progress');
                } else if (sport === 'badminton') {
                    const res = await teamLeagueApi.getLiveSubMatches(tournamentId);
                    list = (res || []).filter((m: any) => m.status === 'in_progress');
                }
                if (active) setMatches(list);
            } catch {
                if (active) setMatches([]);
            } finally {
                if (active) setLoaded(true);
            }
        };
        load();
        const interval = setInterval(load, 30_000); // refresh every 30s for score updates
        return () => { active = false; clearInterval(interval); };
    }, [tournamentId, sport]);

    if (!loaded || matches.length === 0) return null;

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-400 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Live now
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matches.map(m => <LiveMatchCard key={m._id} match={m} />)}
            </div>
        </section>
    );
}

function LiveMatchCard({ match }: { match: LiveMatch }) {
    if (match.gameScores) {
        const games = match.gameScores as any[];
        const open = [...games].reverse().find(g => !g.winnerId) || games[games.length - 1] || { team1Score: 0, team2Score: 0 };
        const n1 = match.player1?.name || match.teams?.team1Name || 'Team 1';
        const n2 = match.player2?.name || match.teams?.team2Name || 'Team 2';
        return (
            <Link
                to={`/live/${match._id}`}
                className="group relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent p-5 flex flex-col gap-3 hover:border-red-500/60 transition-colors"
            >
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[9px] font-bold uppercase tracking-widest">
                    <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse" /> Live
                </div>
                <div className="text-base font-bold text-white">{n1} vs {n2}</div>
                <div className="text-3xl font-extrabold text-white tabular-nums">{open.team1Score} – {open.team2Score}</div>
                <div className="text-[10px] uppercase tracking-widest text-red-400 font-bold group-hover:text-red-300">Watch live →</div>
            </Link>
        );
    }

    const live = match.cricketLiveState;
    const t1 = match.teams?.team1Name || 'Team 1';
    const t2 = match.teams?.team2Name || 'Team 2';
    const runs = live?.runs ?? 0;
    const wkts = live?.wickets ?? 0;
    const overs = `${live?.completedOvers ?? 0}.${live?.ballsInCurrentOver ?? 0}`;
    const target = live?.target;
    const needLine = target != null
        ? `Target ${target} · Need ${Math.max(0, target - runs)}`
        : null;
    return (
        <Link
            to={`/live/${match._id}`}
            className="group relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent p-5 flex flex-col gap-3 hover:border-red-500/60 transition-colors"
        >
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[9px] font-bold uppercase tracking-widest">
                <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse" /> Live
            </div>
            <div className="text-base font-bold text-white">{t1} vs {t2}</div>
            <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-white tabular-nums">{runs}/{wkts}</span>
                <span className="text-sm text-gray-400">({overs} ov)</span>
            </div>
            {needLine && <div className="text-xs text-gray-400">{needLine}</div>}
            <div className="text-[10px] uppercase tracking-widest text-red-400 font-bold group-hover:text-red-300">
                Watch live →
            </div>
        </Link>
    );
}
