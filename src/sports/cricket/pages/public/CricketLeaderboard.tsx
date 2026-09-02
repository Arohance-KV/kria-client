import React, { useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { cricketStatsApi, CricketSort } from '@/sports/cricket/api/cricketStats';

// Sort tabs the backend supports (see cricketStats.service SORT_FIELD_MAP).
const SORTS: { key: CricketSort; label: string }[] = [
    { key: 'runs', label: 'Runs' },
    { key: 'wickets', label: 'Wickets' },
    { key: 'sr', label: 'Strike Rate' },
    { key: 'economy', label: 'Economy' },
    { key: 'fours', label: '4s' },
    { key: 'sixes', label: '6s' },
    { key: 'highest', label: 'Highest' },
];

interface Entry {
    _id: string;
    registrationId: string;
    playerName: string;
    teamName: string;
    batting: { runs: number; balls: number; fours: number; sixes: number; highest: number; innings: number };
    bowling: { wickets: number; legalBalls: number; runsConceded: number };
    computed: { strikeRate: number | null; average: number | null; overs: string; economy: number | null; bestFigures: string | null };
}

const num = (v: number | null | undefined, dash = '-') => (v === null || v === undefined ? dash : v);

export default function CricketLeaderboard({ categoryId }: { categoryId: string }) {
    const [sort, setSort] = useState<CricketSort>('runs');
    const [rows, setRows] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let active = true;
        if (!categoryId) return;
        setIsLoading(true);
        cricketStatsApi.getLeaderboard(categoryId, sort)
            .then(data => { if (active) setRows(data?.leaderboard || []); })
            .catch(() => { if (active) setRows([]); })
            .finally(() => { if (active) setIsLoading(false); });
        return () => { active = false; };
    }, [categoryId, sort]);

    // Which column to emphasise for the active sort.
    const hot = (key: CricketSort): string =>
        key === sort ? 'text-primary font-bold' : '';

    return (
        <div className="flex flex-col gap-4">
            {/* Sort tabs */}
            <div className="flex flex-wrap gap-2">
                {SORTS.map(s => (
                    <button
                        key={s.key}
                        onClick={() => setSort(s.key)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                            s.key === sort
                                ? 'bg-primary text-black border-primary'
                                : 'bg-white/5 text-gray-300 border-white/10 hover:border-primary/40'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center text-gray-400 flex flex-col items-center gap-3">
                    <Trophy className="h-10 w-10 opacity-30" />
                    <p>No stats yet. The leaderboard fills in as cricket matches are scored.</p>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                        <thead>
                            <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                                <th className="text-left px-4 py-3">#</th>
                                <th className="text-left px-4 py-3">Player</th>
                                <th className="text-left px-4 py-3">Team</th>
                                <th className={`text-center px-3 py-3 ${hot('runs')}`}>Runs</th>
                                <th className={`text-center px-3 py-3 ${hot('highest')}`}>HS</th>
                                <th className={`text-center px-3 py-3 ${hot('sr')}`}>SR</th>
                                <th className="text-center px-3 py-3">Avg</th>
                                <th className={`text-center px-3 py-3 ${hot('fours')}`}>4s</th>
                                <th className={`text-center px-3 py-3 ${hot('sixes')}`}>6s</th>
                                <th className={`text-center px-3 py-3 ${hot('wickets')}`}>Wkts</th>
                                <th className="text-center px-3 py-3">Overs</th>
                                <th className={`text-center px-3 py-3 ${hot('economy')}`}>Econ</th>
                                <th className="text-center px-3 py-3">Best</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((e, idx) => (
                                <tr key={e._id || e.registrationId} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                    <td className="px-4 py-3">
                                        <span className={`font-bold ${idx < 3 ? 'text-primary' : 'text-gray-500'}`}>{idx + 1}</span>
                                    </td>
                                    <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{e.playerName}</td>
                                    <td className="px-4 py-3 text-primary/70 text-xs font-medium whitespace-nowrap">{e.teamName || '-'}</td>
                                    <td className={`text-center px-3 py-3 tabular-nums ${sort === 'runs' ? 'text-white font-bold' : 'text-gray-300'}`}>{e.batting?.runs ?? 0}</td>
                                    <td className="text-center px-3 py-3 tabular-nums text-gray-400">{e.batting?.highest ?? 0}</td>
                                    <td className="text-center px-3 py-3 tabular-nums text-gray-400">{num(e.computed?.strikeRate)}</td>
                                    <td className="text-center px-3 py-3 tabular-nums text-gray-400">{num(e.computed?.average)}</td>
                                    <td className="text-center px-3 py-3 tabular-nums text-gray-400">{e.batting?.fours ?? 0}</td>
                                    <td className="text-center px-3 py-3 tabular-nums text-gray-400">{e.batting?.sixes ?? 0}</td>
                                    <td className={`text-center px-3 py-3 tabular-nums ${sort === 'wickets' ? 'text-emerald-400 font-bold' : 'text-gray-300'}`}>{e.bowling?.wickets ?? 0}</td>
                                    <td className="text-center px-3 py-3 tabular-nums text-gray-400">{e.computed?.overs ?? '0.0'}</td>
                                    <td className="text-center px-3 py-3 tabular-nums text-gray-400">{num(e.computed?.economy)}</td>
                                    <td className="text-center px-3 py-3 tabular-nums text-gray-400">{e.computed?.bestFigures ?? '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
