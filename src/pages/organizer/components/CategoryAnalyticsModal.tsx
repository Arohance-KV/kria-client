import React, { useEffect, useState } from 'react';
import { X, Trophy, Loader2, Award, Star, Medal } from 'lucide-react';
import API from '../../../api/axios';
import { useAppDispatch } from '../../../store/hooks';
import { fetchTournament } from '../../../store/slices/tournamentSlice';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    category: any;
    tournamentId: string;
}

export default function CategoryAnalyticsModal({ isOpen, onClose, category, tournamentId }: Props) {
    const dispatch = useAppDispatch();
    const [analytics, setAnalytics] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Award State
    const [grantingToId, setGrantingToId] = useState<string | null>(null);
    const [awardTitle, setAwardTitle] = useState('MVP');
    const [isGranting, setIsGranting] = useState(false);

    useEffect(() => {
        if (isOpen && category) {
            fetchAnalytics();
        }
    }, [isOpen, category]);

    // Lock the page behind the modal so the mouse wheel scrolls the report, not the
    // page underneath. The organizer page's scroll container is <main overflow-y-auto>
    // (not <body>), so freeze both. Restores prior overflow on close.
    useEffect(() => {
        if (!isOpen) return;
        const main = document.querySelector('main') as HTMLElement | null;
        const prevBody = document.body.style.overflow;
        const prevMain = main?.style.overflow ?? '';
        document.body.style.overflow = 'hidden';
        if (main) main.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevBody;
            if (main) main.style.overflow = prevMain;
        };
    }, [isOpen]);

    const fetchAnalytics = async () => {
        try {
            setIsLoading(true);
            const res = await API.get(`/categories/${category._id}/analytics`);
            // The analytics endpoint now wraps the list as { category, analytics, teamMap }
            // (post sport-modularization). Older shape returned the array directly, so
            // fall back to that for safety.
            const payload = res.data?.data?.data ?? res.data?.data ?? [];
            const list = Array.isArray(payload) ? payload : (payload?.analytics ?? []);
            setAnalytics(Array.isArray(list) ? list : []);
        } catch (error) {
            console.error('Failed to fetch analytics', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGrantAward = async (entry: any) => {
        try {
            setIsGranting(true);
            const payload = {
                title: awardTitle || 'Special Award',
                playerId: entry.playerId || null,
                teamId: entry.teamId || null,
                categoryId: category._id,
                description: `Awarded during ${category.name}`
            };
            await API.post(`/tournament/${tournamentId}/awards`, payload);
            alert(`Award '${payload.title}' granted successfully!`);
            setGrantingToId(null);
            
            // Refresh main tournament payload so awards tab is instantly updated
            dispatch(fetchTournament(tournamentId));
        } catch (e: any) {
            alert(e.response?.data?.message || 'Failed to grant award');
        } finally {
            setIsGranting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                            <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-oswald font-bold text-white tracking-wide">
                                Analytical Report
                            </h2>
                            <p className="text-sm text-gray-400 mt-1">
                                {category?.name} • Official Statistics
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors relative z-10">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
                            <p>Crunching the numbers...</p>
                        </div>
                    ) : analytics.length === 0 ? (
                        <div className="text-center p-12">
                            <Star className="h-12 w-12 text-gray-600 mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-white mb-2">No Data Available</h3>
                            <p className="text-gray-400">There are no match statistics recorded for this category yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Champion banner — the top-ranked competitor once the category is done. */}
                            {category?.status === 'completed' && analytics[0] && (() => {
                                const c = analytics[0];
                                const name = c.profile
                                    ? `${c.profile.firstName || ''} ${c.profile.lastName || ''}`.trim() || c.profile.name
                                    : c.team?.name;
                                return (
                                    <div className="flex items-center gap-4 p-5 rounded-xl bg-gradient-to-r from-yellow-500/20 to-amber-500/5 border border-yellow-500/30">
                                        <div className="p-3 bg-yellow-500/20 rounded-xl text-yellow-400 shrink-0">
                                            <Trophy className="h-7 w-7" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.2em] text-yellow-500/80 font-bold">Category Champion</p>
                                            <h3 className="text-2xl font-oswald font-bold text-white leading-tight">{name}</h3>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {c.stats?.matchesWon || 0} wins · {c.stats?.pointsContributed || 0} pts
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}
                            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/40 border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                                            <th className="p-4 font-medium pl-6">Rank</th>
                                            <th className="p-4 font-medium">Competitor</th>
                                            <th className="p-4 font-medium text-center">Matches Played</th>
                                            <th className="p-4 font-medium text-center">Matches Won</th>
                                            <th className="p-4 font-medium text-right text-purple-400 pr-6">Total Points</th>
                                            <th className="p-4 font-medium text-center border-l border-white/10">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {analytics.map((entry, idx) => (
                                            <tr key={entry._id} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-4 pl-6">
                                                    {idx === 0 ? (
                                                        <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center font-bold font-oswald text-lg">
                                                            1
                                                        </div>
                                                    ) : idx === 1 ? (
                                                        <div className="w-8 h-8 rounded-full bg-gray-300/20 text-gray-300 flex items-center justify-center font-bold font-oswald text-lg">
                                                            2
                                                        </div>
                                                    ) : idx === 2 ? (
                                                        <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold font-oswald text-lg">
                                                            3
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 flex items-center justify-center font-medium text-gray-500">
                                                            {idx + 1}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden">
                                                            {entry.profile?.avatar ? (
                                                                <img src={entry.profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                                            ) : entry.team?.logo && !entry.profile ? (
                                                                <img src={entry.team.logo} alt="Team Logo" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-gray-400 font-bold uppercase text-xs">
                                                                    {(entry.profile?.firstName || entry.profile?.name || entry.team?.name || '?').charAt(0)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-white leading-none truncate max-w-[150px]" title={entry.profile ? `${entry.profile.firstName || ''} ${entry.profile.lastName || ''}`.trim() || entry.profile.name : entry.team?.name}>
                                                                {entry.profile 
                                                                    ? `${entry.profile.firstName || ''} ${entry.profile.lastName || ''}`.trim() || entry.profile.name 
                                                                    : entry.team?.name}
                                                            </h4>
                                                            <p className="text-xs text-gray-400 mt-1 truncate max-w-[150px]">
                                                                {entry.profile ? (entry.team ? `Player • ${entry.team.name}` : 'Player') : 'Team'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center font-medium text-gray-300">{entry.stats?.matchesPlayed || 0}</td>
                                                <td className="p-4 text-center font-bold text-emerald-400 bg-emerald-500/5">{entry.stats?.matchesWon || 0}</td>
                                                <td className="p-4 text-right font-oswald text-xl text-purple-400 pr-6">
                                                    {entry.stats?.pointsContributed || 0}
                                                </td>
                                                <td className="p-4 border-l border-white/10">
                                                    {grantingToId === entry._id ? (
                                                        <div className="flex flex-col gap-2 animate-in slide-in-from-right-2">
                                                            {/* Free-text award name (type any title) with the common ones as suggestions. */}
                                                            <input
                                                                list="award-title-presets"
                                                                value={awardTitle}
                                                                onChange={(e) => setAwardTitle(e.target.value)}
                                                                placeholder="Award name…"
                                                                className="h-8 rounded bg-black/50 border border-purple-500/50 text-xs text-white px-2 outline-none focus:border-purple-400"
                                                            />
                                                            <datalist id="award-title-presets">
                                                                <option value="MVP" />
                                                                <option value="Player of the Tournament" />
                                                                <option value="Best Batsman" />
                                                                <option value="Best Bowler" />
                                                                <option value="Best Attacker" />
                                                                <option value="Best Defender" />
                                                                <option value="Emerging Talent" />
                                                            </datalist>
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    onClick={() => handleGrantAward(entry)}
                                                                    disabled={isGranting}
                                                                    className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded transition-colors flex items-center justify-center"
                                                                >
                                                                    {isGranting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                                                                </button>
                                                                <button 
                                                                    onClick={() => setGrantingToId(null)}
                                                                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => setGrantingToId(entry._id)}
                                                            className="flex items-center gap-2 w-full justify-center px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg text-sm font-medium transition-all group-hover:border-purple-500/40"
                                                        >
                                                            <Medal className="h-4 w-4" /> Grant Award
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
