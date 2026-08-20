import React, { useState, useMemo } from 'react';
import { Loader2, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TournamentHistoryEntry } from '../store/slices/registrationSlice';

// ─── Display helpers ──────────────────────────────────────────────────────────
export const sportEmoji = (sport?: string) => {
    const map: Record<string, string> = { badminton: '🏸', cricket: '🏏', football: '⚽', tennis: '🎾', table_tennis: '🏓', kabaddi: '🤼' };
    return sport ? (map[sport.toLowerCase()] ?? '🏅') : '🏅';
};

const skillColor = (level?: string) => {
    switch (level?.toLowerCase()) {
        case 'beginner':     return 'text-blue-400  border-blue-400/30  bg-blue-400/10';
        case 'intermediate': return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
        case 'advanced':     return 'text-primary   border-primary/30   bg-primary/10';
        case 'professional': return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
        default:             return 'text-gray-400  border-gray-400/30  bg-gray-400/10';
    }
};

const tournamentStatusColor = (status: string) => {
    switch (status) {
        case 'completed':   return 'text-green-400 border-green-400/20 bg-green-400/10';
        case 'ongoing':     return 'text-blue-400  border-blue-400/20  bg-blue-400/10';
        case 'cancelled':   return 'text-red-400   border-red-400/20   bg-red-400/10';
        default:            return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
    }
};

const regStatusColor = (status: string) => {
    if (status === 'approved' || status === 'assigned') return 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10';
    if (status === 'auctioned')                          return 'text-primary border-primary/20 bg-primary/10';
    if (status === 'rejected' || status === 'withdrawn') return 'text-red-400 border-red-400/20 bg-red-400/10';
    return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
};

export const MiniStat = ({ label, value, color, small }: { label: string; value: string | number; color: string; small?: boolean }) => (
    <div className={`flex flex-col items-center bg-white/5 border border-white/10 rounded-xl px-4 ${small ? 'py-2' : 'py-3'}`}>
        <span className={`${small ? 'text-lg' : 'text-2xl'} font-bold font-oswald ${color}`}>{value}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-oswald">{label}</span>
    </div>
);

// ─── History card ─────────────────────────────────────────────────────────────
const HistoryCard = ({ entry }: { entry: TournamentHistoryEntry }) => {
    const t     = entry.tournament;
    const cat   = entry.category;
    const team  = entry.team;
    const stats = entry.stats;

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xl">{sportEmoji(t?.sport)}</span>
                        <h4 className="text-lg font-bold font-oswald tracking-wide text-white truncate">
                            {t?.name || 'Tournament'}
                        </h4>
                        {t?.status && (
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0.5 ${tournamentStatusColor(t.status)}`}>
                                {t.status}
                            </Badge>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                        {cat?.name && <span>📂 {cat.name}</span>}
                        {t?.venue?.city && <><span className="text-gray-600">•</span><span>📍 {t.venue.city}</span></>}
                        {t?.startDate && (
                            <><span className="text-gray-600">•</span>
                            <span>🗓 {new Date(t.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span></>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0.5 ${regStatusColor(entry.status)}`}>
                            {entry.status}
                        </Badge>
                        {entry.profile?.skillLevel && (
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0.5 ${skillColor(entry.profile.skillLevel)}`}>
                                {entry.profile.skillLevel}
                            </Badge>
                        )}
                        {team && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-white/5 border-white/20 text-white flex items-center gap-1">
                                {team.primaryColor && (
                                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: team.primaryColor }} />
                                )}
                                {team.name}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2 items-end shrink-0">
                    {entry.auctionData?.soldPrice ? (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-oswald">{entry.status === 'auctioned' ? 'Auction Price' : 'Price'}</span>
                            <span className="text-2xl font-mono font-black text-primary">
                                ₹{entry.auctionData.soldPrice.toLocaleString()}
                            </span>
                        </div>
                    ) : entry.auctionData?.basePrice ? (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-oswald">Base Price</span>
                            <span className="text-lg font-mono font-bold text-gray-300">
                                ₹{entry.auctionData.basePrice.toLocaleString()}
                            </span>
                        </div>
                    ) : null}

                    {stats && (stats.matchesPlayed > 0 || stats.matchesWon > 0) && (
                        <div className="flex gap-3 mt-1">
                            <MiniStat label="Played" value={stats.matchesPlayed} color="text-white" small />
                            <MiniStat label="Won"    value={stats.matchesWon}    color="text-green-400" small />
                            {stats.pointsContributed > 0 && (
                                <MiniStat label="Pts" value={stats.pointsContributed} color="text-primary" small />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main view: sport selector + per-sport banner + history list ────────────────
interface Props {
    history: TournamentHistoryEntry[];
    loading?: boolean;
    emptyMessage?: string;
    onFindTournaments?: () => void;
}

const TournamentHistoryView = ({ history, loading, emptyMessage, onFindTournaments }: Props) => {
    const [sport, setSport] = useState<string>('all');

    const sports = useMemo(
        () => [...new Set(history.map(e => e.tournament?.sport).filter(Boolean) as string[])],
        [history]
    );
    const filtered = sport === 'all' ? history : history.filter(e => e.tournament?.sport === sport);
    // Aggregates recomputed from the filtered set so numbers reflect the chosen sport.
    const agg = useMemo(() => filtered.reduce((a, e) => ({
        tournaments: a.tournaments + 1,
        played:   a.played   + (e.stats?.matchesPlayed || 0),
        won:      a.won      + (e.stats?.matchesWon    || 0),
        earnings: a.earnings + (e.auctionData?.soldPrice || 0),
    }), { tournaments: 0, played: 0, won: 0, earnings: 0 }), [filtered]);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center flex flex-col items-center gap-4">
                <Award className="h-10 w-10 text-gray-500" />
                <p className="text-gray-400 max-w-xs">{emptyMessage || 'No tournament history yet.'}</p>
                {onFindTournaments && (
                    <button onClick={onFindTournaments} className="mt-2 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-full transition-colors font-medium">
                        Find Tournaments
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Sport selector */}
            {sports.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                    {['all', ...sports].map(sp => (
                        <button
                            key={sp}
                            onClick={() => setSport(sp)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all border ${
                                sport === sp
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {sp === 'all' ? '🏅 All Sports' : `${sportEmoji(sp)} ${sp.replace('_', ' ')}`}
                        </button>
                    ))}
                </div>
            )}

            {/* Aggregate banner — reflects the selected sport */}
            {agg.tournaments > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MiniStat label="Tournaments" value={agg.tournaments} color="text-white" />
                    <MiniStat label="Matches"     value={agg.played}      color="text-blue-400" />
                    <MiniStat label="Wins"        value={agg.won}         color="text-green-400" />
                    {agg.earnings > 0 && (
                        <MiniStat label="Total Earnings" value={`₹${agg.earnings.toLocaleString()}`} color="text-primary" />
                    )}
                </div>
            )}

            <div className="flex flex-col gap-4">
                {filtered.map(entry => <HistoryCard key={entry._id} entry={entry} />)}
            </div>
        </div>
    );
};

export default TournamentHistoryView;
