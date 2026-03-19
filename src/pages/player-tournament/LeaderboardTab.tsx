import React, { useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { Category } from '../../store/slices/registrationSlice';
import API from '../../api/axios';

interface LeaderboardEntry {
    _id: string;
    rank: number;
    playerName: string;
    teamName: string;
    teamId: string;
    matchesPlayed: number;
    matchesWon: number;
    totalPointsScored?: number;
    totalPointsConceded?: number;
    pointDiff?: number;
    winPercentage: number;
}

interface Props {
    categories: Category[];
    tournamentId: string;
    sport: string;
}

// ─── Column config per sport ─────────────────────────────────────────────────

interface Column {
    key: string;
    label: string;
    align: 'left' | 'center';
    render?: (entry: LeaderboardEntry) => React.ReactNode;
}

function getColumns(sportType: string): Column[] {
    const base: Column[] = [
        { key: 'rank', label: '#', align: 'left' },
        { key: 'playerName', label: 'Player', align: 'left' },
        { key: 'teamName', label: 'Team', align: 'left' },
        { key: 'matchesPlayed', label: 'MP', align: 'center' },
        { key: 'matchesWon', label: 'MW', align: 'center' },
    ];

    switch (sportType) {
        case 'badminton':
        case 'table_tennis':
            return [
                ...base,
                { key: 'totalPointsScored', label: 'Pts For', align: 'center' },
                { key: 'totalPointsConceded', label: 'Pts Agn', align: 'center' },
                {
                    key: 'pointDiff', label: '+/-', align: 'center',
                    render: (e) => {
                        const diff = e.pointDiff ?? 0;
                        const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-gray-500';
                        return <span className={color}>{diff > 0 ? `+${diff}` : diff}</span>;
                    },
                },
                {
                    key: 'winPercentage', label: 'Win%', align: 'center',
                    render: (e) => <span>{e.winPercentage}%</span>,
                },
            ];
        default:
            return [
                ...base,
                {
                    key: 'winPercentage', label: 'Win%', align: 'center',
                    render: (e) => <span>{e.winPercentage}%</span>,
                },
            ];
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════

const LeaderboardTab: React.FC<Props> = ({ categories, sport }) => {
    const [selectedCat, setSelectedCat] = useState<string>(categories[0]?._id || '');
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [sportType, setSportType] = useState<string>(sport);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!selectedCat) return;
        const fetchLeaderboard = async () => {
            setIsLoading(true);
            try {
                const res = await API.get(`/matches/leaderboard/${selectedCat}`);
                const payload = res.data?.data?.data || res.data?.data || {};
                setLeaderboard(payload.leaderboard || []);
                setSportType(payload.sportType || sport);
            } catch {
                setLeaderboard([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLeaderboard();
    }, [selectedCat, sport]);

    const columns = getColumns(sportType);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="text-2xl font-oswald font-bold tracking-wide">Leaderboard</h3>
                {categories.length > 1 && (
                    <select
                        value={selectedCat}
                        onChange={(e) => setSelectedCat(e.target.value)}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-primary/30 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                        {categories.map(c => (
                            <option key={c._id} value={c._id} className="bg-[#111]">{c.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : leaderboard.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center text-gray-400 flex flex-col items-center gap-3">
                    <Trophy className="h-10 w-10 opacity-30" />
                    <p>No completed matches yet. Leaderboard will update as matches are played.</p>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                {columns.map(col => (
                                    <th
                                        key={col.key}
                                        className={`${col.align === 'left' ? 'text-left' : 'text-center'} px-5 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold`}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((entry) => (
                                <tr
                                    key={entry._id}
                                    className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                                >
                                    {columns.map(col => (
                                        <td
                                            key={col.key}
                                            className={`${col.align === 'left' ? '' : 'text-center'} px-5 py-3`}
                                        >
                                            {col.render
                                                ? col.render(entry)
                                                : renderCell(col.key, entry)
                                            }
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── Cell renderer ───────────────────────────────────────────────────────────

function renderCell(key: string, entry: LeaderboardEntry): React.ReactNode {
    switch (key) {
        case 'rank':
            return (
                <span className={`font-bold ${entry.rank <= 3 ? 'text-primary' : 'text-gray-500'}`}>
                    {entry.rank}
                </span>
            );
        case 'playerName':
            return <span className="text-white font-semibold">{entry.playerName}</span>;
        case 'teamName':
            return <span className="text-primary/70 text-xs font-medium">{entry.teamName}</span>;
        case 'matchesPlayed':
            return <span className="text-gray-400">{entry.matchesPlayed}</span>;
        case 'matchesWon':
            return <span className="text-emerald-400 font-bold">{entry.matchesWon}</span>;
        case 'totalPointsScored':
            return <span className="text-white font-semibold">{entry.totalPointsScored ?? 0}</span>;
        case 'totalPointsConceded':
            return <span className="text-gray-400">{entry.totalPointsConceded ?? 0}</span>;
        default:
            return <span className="text-gray-400">{(entry as any)[key] ?? '-'}</span>;
    }
}

export default LeaderboardTab;
