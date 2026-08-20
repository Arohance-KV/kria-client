import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Users, Swords, BarChart3, Trophy, ChevronRight, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Category } from '@/store/slices/registrationSlice';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';

interface Props {
    categories: Category[];
    tournamentId: string;
}

export default function TeamLeagueTab({ categories, tournamentId }: Props) {
    const teamLeagueCategories = categories.filter(c => c.bracketType === 'team_league');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [stageNumber, setStageNumber] = useState(1);
    const [activeView, setActiveView] = useState<'overall' | 'standings' | 'ties'>('overall');

    const [groups, setGroups] = useState<any[]>([]);
    const [standings, setStandings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Tie detail
    const [selectedGroup, setSelectedGroup] = useState<any>(null);
    const [ties, setTies] = useState<any[]>([]);
    const [tiesLoading, setTiesLoading] = useState(false);
    const [selectedTie, setSelectedTie] = useState<any>(null);
    const [tieDetail, setTieDetail] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Overall aggregated standings
    const [overallStandings, setOverallStandings] = useState<any[]>([]);
    const [overallLoading, setOverallLoading] = useState(false);
    const [overallChampion, setOverallChampion] = useState<any>(null);

    const selectedCategory = teamLeagueCategories.find(c => c._id === selectedCategoryId);

    useEffect(() => {
        if (teamLeagueCategories.length > 0 && !selectedCategoryId) {
            setSelectedCategoryId(teamLeagueCategories[0]._id);
        }
    }, [teamLeagueCategories, selectedCategoryId]);

    const loadData = useCallback(async () => {
        if (!selectedCategoryId) return;
        setLoading(true);
        try {
            const [g, s] = await Promise.all([
                teamLeagueApi.getGroups(selectedCategoryId, stageNumber).catch(() => []),
                teamLeagueApi.getGroupStandings(selectedCategoryId, stageNumber).catch(() => []),
            ]);
            setGroups(Array.isArray(g) ? g : []);
            setStandings(Array.isArray(s) ? s : []);
        } catch {
            setGroups([]);
            setStandings([]);
        } finally {
            setLoading(false);
        }
    }, [selectedCategoryId, stageNumber]);

    useEffect(() => {
        loadData();
        setSelectedGroup(null);
        setSelectedTie(null);
        setTieDetail(null);
    }, [loadData]);

    const loadTies = async (group: any) => {
        setSelectedGroup(group);
        setSelectedTie(null);
        setTieDetail(null);
        setTiesLoading(true);
        try {
            const data = await teamLeagueApi.getTiesByGroup(group._id);
            setTies(Array.isArray(data) ? data : []);
        } catch {
            setTies([]);
        } finally {
            setTiesLoading(false);
        }
    };

    const loadTieDetail = async (tie: any) => {
        setSelectedTie(tie);
        setDetailLoading(true);
        try {
            const detail = await teamLeagueApi.getTieDetails(tie._id);
            setTieDetail(detail);
        } catch {
            setTieDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    // Determine max stage
    const [maxStage, setMaxStage] = useState(1);
    useEffect(() => {
        if (!selectedCategoryId) return;
        (async () => {
            for (let s = 1; s <= 5; s++) {
                const g = await teamLeagueApi.getGroups(selectedCategoryId, s).catch(() => []);
                if (!Array.isArray(g) || g.length === 0) {
                    setMaxStage(Math.max(1, s - 1));
                    return;
                }
            }
            setMaxStage(5);
        })();
    }, [selectedCategoryId]);

    // Load overall aggregated standings across all stages
    const loadOverallStandings = useCallback(async () => {
        if (!selectedCategoryId) return;
        setOverallLoading(true);
        try {
            const teamMap: Record<string, { teamId: string; teamName: string; played: number; won: number; lost: number; drawn: number; points: number; subMatchesWon: number; subMatchesLost: number }> = {};
            let detectedChampion: any = null;

            for (let s = 1; s <= maxStage; s++) {
                const stageStandings = await teamLeagueApi.getGroupStandings(selectedCategoryId, s).catch(() => []);
                const arr = Array.isArray(stageStandings) ? stageStandings : [];

                // Detect champion from the last stage
                const allComp = arr.length > 0 && arr.every((gs: any) => gs.completedTies > 0 && gs.completedTies === gs.totalTies);
                const isFin = arr.length === 1 && (arr[0]?.standings?.length || 0) <= 2;
                if (s === maxStage && isFin && allComp && arr[0]?.standings?.[0]) {
                    detectedChampion = arr[0].standings[0];
                }

                for (const gs of arr) {
                    for (const entry of (gs.standings || [])) {
                        if (!teamMap[entry.teamId]) {
                            teamMap[entry.teamId] = {
                                teamId: entry.teamId,
                                teamName: entry.teamName,
                                played: 0, won: 0, lost: 0, drawn: 0, points: 0,
                                subMatchesWon: 0, subMatchesLost: 0,
                            };
                        }
                        const t = teamMap[entry.teamId];
                        t.played += entry.played || 0;
                        t.won += entry.won || 0;
                        t.lost += entry.lost || 0;
                        t.drawn += entry.drawn || 0;
                        t.points += entry.points || 0;
                        t.subMatchesWon += entry.subMatchesWon || 0;
                        t.subMatchesLost += entry.subMatchesLost || 0;
                    }
                }
            }

            const sorted = Object.values(teamMap).sort((a, b) => b.points - a.points || (b.subMatchesWon - b.subMatchesLost) - (a.subMatchesWon - a.subMatchesLost));
            setOverallStandings(sorted);
            setOverallChampion(detectedChampion);
        } catch {
            setOverallStandings([]);
        } finally {
            setOverallLoading(false);
        }
    }, [selectedCategoryId, maxStage]);

    useEffect(() => {
        if (activeView === 'overall') {
            loadOverallStandings();
        }
    }, [activeView, loadOverallStandings]);

    // Detect champion
    const allComplete = standings.length > 0 && standings.every((gs: any) => gs.completedTies > 0 && gs.completedTies === gs.totalTies);
    const isFinal = standings.length === 1 && (standings[0]?.standings?.length || 0) <= 2;
    const champion = isFinal && allComplete ? standings[0]?.standings?.[0] : null;

    if (teamLeagueCategories.length === 0) {
        return (
            <div className="text-center py-12">
                <Trophy className="h-10 w-10 text-gray-500 mx-auto mb-3 opacity-50" />
                <p className="text-gray-400">No team league categories in this tournament.</p>
            </div>
        );
    }

    const categoryConfig = selectedCategory?.teamLeagueConfig;

    return (
        <div className="space-y-5">
            {/* Category selector */}
            {teamLeagueCategories.length > 1 && (
                <select
                    value={selectedCategoryId}
                    onChange={(e) => { setSelectedCategoryId(e.target.value); setStageNumber(1); }}
                    className="h-10 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white"
                >
                    {teamLeagueCategories.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                </select>
            )}

            {/* Stage selector */}
            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Stage:</span>
                {Array.from({ length: maxStage }, (_, i) => i + 1).map(s => (
                    <button
                        key={s}
                        onClick={() => setStageNumber(s)}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                            stageNumber === s ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        Stage {s}
                    </button>
                ))}
            </div>

            {/* View tabs */}
            <div className="flex gap-1 bg-black/30 rounded-xl p-1">
                <button
                    onClick={() => setActiveView('overall')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg flex-1 justify-center transition-colors ${
                        activeView === 'overall' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <LayoutDashboard className="h-4 w-4" /> Overall
                </button>
                <button
                    onClick={() => { setActiveView('standings'); setSelectedGroup(null); setSelectedTie(null); }}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg flex-1 justify-center transition-colors ${
                        activeView === 'standings' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <BarChart3 className="h-4 w-4" /> Standings
                </button>
                <button
                    onClick={() => setActiveView('ties')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg flex-1 justify-center transition-colors ${
                        activeView === 'ties' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Swords className="h-4 w-4" /> Ties & Results
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <>
                    {/* Champion banner */}
                    {champion && (
                        <div className="bg-gradient-to-r from-yellow-500/10 to-primary/10 border border-yellow-500/30 rounded-xl p-5 text-center space-y-2">
                            <Trophy className="h-9 w-9 text-yellow-400 mx-auto" />
                            <h3 className="text-xl font-oswald font-bold text-white">{champion.teamName}</h3>
                            <p className="text-yellow-400 font-semibold uppercase tracking-wider text-xs">Champion</p>
                        </div>
                    )}

                    {/* Overall combined standings */}
                    {activeView === 'overall' && (
                        <div className="space-y-4">
                            {overallLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                            ) : overallStandings.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No standings data yet.</p>
                            ) : (
                                <>
                                    {overallChampion && (
                                        <div className="bg-gradient-to-r from-yellow-500/10 to-primary/10 border border-yellow-500/30 rounded-xl p-5 text-center space-y-2">
                                            <Trophy className="h-9 w-9 text-yellow-400 mx-auto" />
                                            <h3 className="text-xl font-oswald font-bold text-white">{overallChampion.teamName}</h3>
                                            <p className="text-yellow-400 font-semibold uppercase tracking-wider text-xs">Champion</p>
                                        </div>
                                    )}
                                    <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                                        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
                                            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                                <LayoutDashboard className="h-4 w-4 text-primary" />
                                                Overall Standings (All Stages Combined)
                                            </h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-white/5">
                                                        <th className="text-left px-4 py-2 text-gray-500 font-medium">#</th>
                                                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Team</th>
                                                        <th className="text-center px-3 py-2 text-gray-500 font-medium">P</th>
                                                        <th className="text-center px-3 py-2 text-gray-500 font-medium">W</th>
                                                        <th className="text-center px-3 py-2 text-gray-500 font-medium">L</th>
                                                        <th className="text-center px-3 py-2 text-gray-500 font-medium">D</th>
                                                        <th className="text-center px-3 py-2 text-gray-500 font-medium">SM+</th>
                                                        <th className="text-center px-3 py-2 text-gray-500 font-medium">SM-</th>
                                                        <th className="text-center px-3 py-2 text-primary font-bold">Pts</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {overallStandings.map((entry: any, idx: number) => (
                                                        <tr key={entry.teamId} className="border-b border-white/5 hover:bg-white/5">
                                                            <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                                                            <td className="px-4 py-2.5 text-white font-medium">
                                                                {entry.teamName}
                                                                {overallChampion && entry.teamId === overallChampion.teamId && (
                                                                    <Trophy className="inline h-3 w-3 text-yellow-400 ml-1" />
                                                                )}
                                                            </td>
                                                            <td className="text-center px-3 py-2.5 text-gray-300">{entry.played}</td>
                                                            <td className="text-center px-3 py-2.5 text-emerald-400">{entry.won}</td>
                                                            <td className="text-center px-3 py-2.5 text-red-400">{entry.lost}</td>
                                                            <td className="text-center px-3 py-2.5 text-yellow-400">{entry.drawn}</td>
                                                            <td className="text-center px-3 py-2.5 text-gray-300">{entry.subMatchesWon}</td>
                                                            <td className="text-center px-3 py-2.5 text-gray-300">{entry.subMatchesLost}</td>
                                                            <td className="text-center px-3 py-2.5 text-primary font-bold">{entry.points}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Standings view */}
                    {activeView === 'standings' && (
                        <div className="space-y-4">
                            {standings.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No standings data yet.</p>
                            ) : standings.map((gs: any) => (
                                <div key={gs.group._id} className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                                    <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">{gs.group.groupName}</h4>
                                        <span className="text-xs text-gray-500">{gs.completedTies}/{gs.totalTies} ties</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-white/5">
                                                    <th className="text-left px-4 py-2 text-gray-500 font-medium">#</th>
                                                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Team</th>
                                                    <th className="text-center px-3 py-2 text-gray-500 font-medium">P</th>
                                                    <th className="text-center px-3 py-2 text-gray-500 font-medium">W</th>
                                                    <th className="text-center px-3 py-2 text-gray-500 font-medium">L</th>
                                                    <th className="text-center px-3 py-2 text-gray-500 font-medium">D</th>
                                                    <th className="text-center px-3 py-2 text-gray-500 font-medium">SM+</th>
                                                    <th className="text-center px-3 py-2 text-gray-500 font-medium">SM-</th>
                                                    <th className="text-center px-3 py-2 text-primary font-bold">Pts</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(gs.standings || []).map((entry: any, idx: number) => (
                                                    <tr key={entry.teamId} className="border-b border-white/5 hover:bg-white/5">
                                                        <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                                                        <td className="px-4 py-2.5 text-white font-medium">{entry.teamName}</td>
                                                        <td className="text-center px-3 py-2.5 text-gray-300">{entry.played}</td>
                                                        <td className="text-center px-3 py-2.5 text-emerald-400">{entry.won}</td>
                                                        <td className="text-center px-3 py-2.5 text-red-400">{entry.lost}</td>
                                                        <td className="text-center px-3 py-2.5 text-yellow-400">{entry.drawn}</td>
                                                        <td className="text-center px-3 py-2.5 text-gray-300">{entry.subMatchesWon}</td>
                                                        <td className="text-center px-3 py-2.5 text-gray-300">{entry.subMatchesLost}</td>
                                                        <td className="text-center px-3 py-2.5 text-primary font-bold">{entry.points}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Ties & Results view */}
                    {activeView === 'ties' && (
                        <div className="space-y-4">
                            {selectedTie && tieDetail ? (
                                <TieDetailPublic
                                    tie={tieDetail.tie || selectedTie}
                                    subMatches={tieDetail.subMatches || []}
                                    lineups={tieDetail.lineups || []}
                                    categoryConfig={categoryConfig}
                                    onBack={() => { setSelectedTie(null); setTieDetail(null); }}
                                />
                            ) : selectedGroup ? (
                                /* ── Ties list for a group ───────────────── */
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setSelectedGroup(null)}
                                            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                                        >
                                            <ArrowLeft className="h-3.5 w-3.5" /> Groups
                                        </button>
                                        <span className="text-gray-700">/</span>
                                        <span className="text-white font-bold text-sm">{selectedGroup.groupName}</span>
                                    </div>

                                    {tiesLoading ? (
                                        <div className="flex justify-center py-10">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    ) : ties.length === 0 ? (
                                        <div className="text-center py-10 text-gray-500 text-sm">
                                            No ties scheduled yet.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {ties.map((tie: any) => {
                                                const isCompleted = tie.status === 'completed';
                                                const isWin1 = tie.winnerId === tie.teams?.team1Id;
                                                const isWin2 = tie.winnerId === tie.teams?.team2Id;
                                                return (
                                                    <button
                                                        key={tie._id}
                                                        onClick={() => loadTieDetail(tie)}
                                                        className="group w-full bg-black/40 border border-white/10 rounded-2xl hover:border-primary/30 transition-all overflow-hidden text-left"
                                                    >
                                                        <div className="flex items-stretch">
                                                            {/* Team 1 */}
                                                            <div className={`flex-1 flex items-center justify-end gap-2 px-5 py-4 ${isWin1 ? 'bg-emerald-500/5' : ''}`}>
                                                                {isWin1 && <Trophy className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                                                                <span className={`font-semibold text-sm text-right leading-tight ${isWin1 ? 'text-emerald-300 font-bold' : isCompleted ? 'text-white/50' : 'text-white'}`}>
                                                                    {tie.teams?.team1Name}
                                                                </span>
                                                            </div>

                                                            {/* Centre */}
                                                            <div className="shrink-0 flex flex-col items-center justify-center px-4 py-3 border-x border-white/5 min-w-[72px]">
                                                                {isCompleted ? (
                                                                    <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${
                                                                        isWin1 ? 'bg-emerald-500/15 text-emerald-400' : isWin2 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/8 text-gray-400'
                                                                    }`}>
                                                                        Done
                                                                    </span>
                                                                ) : tie.completedCount !== undefined && tie.subMatchCount > 0 ? (
                                                                    <>
                                                                        <span className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">vs</span>
                                                                        <span className="text-[9px] text-gray-600 mt-0.5">{tie.completedCount}/{tie.subMatchCount}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">vs</span>
                                                                )}
                                                            </div>

                                                            {/* Team 2 */}
                                                            <div className={`flex-1 flex items-center gap-2 px-5 py-4 ${isWin2 ? 'bg-emerald-500/5' : ''}`}>
                                                                <span className={`font-semibold text-sm leading-tight ${isWin2 ? 'text-emerald-300 font-bold' : isCompleted ? 'text-white/50' : 'text-white'}`}>
                                                                    {tie.teams?.team2Name}
                                                                </span>
                                                                {isWin2 && <Trophy className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                                                            </div>

                                                            {/* Arrow */}
                                                            <div className="flex items-center px-3 border-l border-white/5">
                                                                <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-primary transition-colors" />
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── Group list ──────────────────────────── */
                                <div>
                                    {groups.length === 0 ? (
                                        <p className="text-center text-gray-500 py-10">No groups configured yet.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {groups.map((group: any) => {
                                                const gs = standings.find((s: any) => s.group._id === group._id);
                                                const done = gs?.completedTies ?? 0;
                                                const total = gs?.totalTies ?? 0;
                                                const pct = total > 0 ? (done / total) * 100 : 0;
                                                const allDone = total > 0 && done === total;

                                                return (
                                                    <button
                                                        key={group._id}
                                                        onClick={() => loadTies(group)}
                                                        className="group flex flex-col gap-3 p-5 bg-black/40 border border-white/10 rounded-2xl hover:border-primary/30 transition-all text-left"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                                                <span className="font-oswald font-bold text-white text-base tracking-wide uppercase">
                                                                    {group.groupName}
                                                                </span>
                                                            </div>
                                                            <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                                        </div>

                                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                                            <span>{group.teamIds?.length ?? 0} teams</span>
                                                            <span className={allDone ? 'text-emerald-400 font-semibold' : ''}>
                                                                {total > 0 ? `${done} / ${total} ties` : 'No ties yet'}
                                                            </span>
                                                        </div>

                                                        {total > 0 && (
                                                            <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500/70' : 'bg-primary/60'}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Tie Detail (read-only) ──────────────────────────────────────────────────

function TieDetailPublic({
    tie,
    subMatches,
    lineups,
    categoryConfig,
    onBack,
}: {
    tie: any;
    subMatches: any[];
    lineups: any[];
    categoryConfig: any;
    onBack: () => void;
}) {
    const team1Id = tie.teams?.team1Id;
    const team2Id = tie.teams?.team2Id;
    const team1Name = tie.teams?.team1Name || 'Team 1';
    const team2Name = tie.teams?.team2Name || 'Team 2';
    const isCompleted = tie.status === 'completed';
    const winner = tie.winnerId === team1Id ? team1Name : tie.winnerId === team2Id ? team2Name : null;

    // Sub-match win tally (computed from sub-matches for the scoreboard)
    const t1SubWins = subMatches.filter(sm => sm.status === 'completed' && sm.winnerId === team1Id).length;
    const t2SubWins = subMatches.filter(sm => sm.status === 'completed' && sm.winnerId === team2Id).length;
    const hasScore = isCompleted && (t1SubWins + t2SubWins) > 0;

    return (
        <div className="space-y-5">

            {/* ── Back nav ── */}
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to ties
            </button>

            {/* ── Scoreboard header ── */}
            <div className="rounded-2xl border border-white/10 bg-black/50 overflow-hidden">
                <div className="flex items-stretch">
                    {/* Team 1 */}
                    <div className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-6 px-4 ${tie.winnerId === team1Id ? 'bg-emerald-500/8' : ''}`}>
                        {tie.winnerId === team1Id && (
                            <Trophy className="h-4 w-4 text-emerald-400 mb-1" />
                        )}
                        <span className={`font-oswald font-bold text-xl text-center leading-tight tracking-wide ${
                            tie.winnerId === team1Id ? 'text-emerald-300' : isCompleted ? 'text-white/40' : 'text-white'
                        }`}>
                            {team1Name}
                        </span>
                        {tie.winnerId === team1Id && (
                            <span className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">Winner</span>
                        )}
                    </div>

                    {/* Score / Status centre */}
                    <div className="shrink-0 flex flex-col items-center justify-center px-6 py-6 border-x border-white/8 text-center">
                        {hasScore ? (
                            <>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-3xl font-black font-oswald tabular-nums ${tie.winnerId === team1Id ? 'text-emerald-400' : 'text-white/40'}`}>
                                        {t1SubWins}
                                    </span>
                                    <span className="text-gray-600 text-lg font-light">—</span>
                                    <span className={`text-3xl font-black font-oswald tabular-nums ${tie.winnerId === team2Id ? 'text-emerald-400' : 'text-white/40'}`}>
                                        {t2SubWins}
                                    </span>
                                </div>
                                <span className="text-[9px] uppercase tracking-widest text-gray-600 mt-1 font-medium">sub-matches</span>
                            </>
                        ) : isCompleted ? (
                            <span className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">Completed</span>
                        ) : (
                            <span className="text-[9px] uppercase tracking-widest text-blue-400 font-bold">In Progress</span>
                        )}
                    </div>

                    {/* Team 2 */}
                    <div className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-6 px-4 ${tie.winnerId === team2Id ? 'bg-emerald-500/8' : ''}`}>
                        {tie.winnerId === team2Id && (
                            <Trophy className="h-4 w-4 text-emerald-400 mb-1" />
                        )}
                        <span className={`font-oswald font-bold text-xl text-center leading-tight tracking-wide ${
                            tie.winnerId === team2Id ? 'text-emerald-300' : isCompleted ? 'text-white/40' : 'text-white'
                        }`}>
                            {team2Name}
                        </span>
                        {tie.winnerId === team2Id && (
                            <span className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">Winner</span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Lineups ── */}
            {lineups.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Lineups</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {lineups.map((lineup: any) => {
                            const isTeam1 = lineup.teamId === team1Id;
                            return (
                                <div key={lineup._id} className="bg-black/40 border border-white/8 rounded-xl p-4">
                                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">
                                        {isTeam1 ? team1Name : team2Name}
                                    </p>
                                    <div className="space-y-1.5">
                                        {(lineup.assignments || []).map((a: any) => {
                                            const slotConf = categoryConfig?.subTeamSlots?.find((s: any) => s.slotNumber === a.slotNumber);
                                            return (
                                                <div key={a.slotNumber} className="flex items-center justify-between gap-3 py-1.5 px-3 bg-white/5 rounded-lg">
                                                    <span className="text-[10px] text-gray-500 shrink-0">{slotConf?.label || `Slot ${a.slotNumber}`}</span>
                                                    <span className="text-sm text-white font-medium text-right">{a.playerNames?.join(' & ') || 'TBD'}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Sub-matches ── */}
            <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Sub-Matches
                    {subMatches.length > 0 && (
                        <span className="ml-2 text-gray-700 normal-case tracking-normal">
                            ({subMatches.filter(sm => sm.status === 'completed').length}/{subMatches.length} done)
                        </span>
                    )}
                </h4>

                {subMatches.length === 0 ? (
                    <p className="text-gray-600 text-sm py-4 text-center">No sub-matches yet.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {subMatches.map((sm: any) => {
                            const slotConfig = categoryConfig?.subTeamSlots?.find((s: any) => s.slotNumber === sm.subMatchSlotNumber);
                            const label = sm.slotLabel || slotConfig?.label || `Match ${sm.subMatchSlotNumber}`;
                            const p1Name = sm.player1?.name || team1Name;
                            const p2Name = sm.player2?.name || team2Name;
                            const smDone = sm.status === 'completed';
                            const smLive = sm.status === 'in_progress';
                            const p1Wins = smDone && sm.winnerId === sm.player1?.teamId;
                            const p2Wins = smDone && sm.winnerId === sm.player2?.teamId;
                            const gameScores: string[] = smDone && sm.gameScores
                                ? sm.gameScores.map((g: any) => `${g.team1Score}–${g.team2Score}`)
                                : [];

                            return (
                                <div
                                    key={sm._id}
                                    className={`rounded-xl border overflow-hidden ${
                                        smDone ? 'border-white/8 bg-black/30' : 'border-white/5 bg-black/20'
                                    }`}
                                >
                                    {/* Label row */}
                                    <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/5 bg-white/[0.02]">
                                        <span className="text-[10px] text-gray-500 font-medium">{label}</span>
                                        {smDone ? (
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-500">Done</span>
                                        ) : smLive ? (
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-red-400">Live</span>
                                        ) : (
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-gray-600">Upcoming</span>
                                        )}
                                    </div>

                                    {/* Players row */}
                                    <div className="flex items-stretch">
                                        {/* Player 1 */}
                                        <div className={`flex-1 flex items-center justify-end gap-2 px-4 py-3 ${p1Wins ? 'bg-emerald-500/5' : ''}`}>
                                            <span className={`text-sm font-medium text-right leading-tight ${p1Wins ? 'text-emerald-300 font-bold' : smDone ? 'text-white/40' : 'text-white/80'}`}>
                                                {p1Name}
                                            </span>
                                        </div>

                                        {/* Score */}
                                        <div className="shrink-0 flex flex-col items-center justify-center px-3 border-x border-white/5 min-w-[80px] text-center">
                                            {gameScores.length > 0 ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {gameScores.map((gs, gi) => (
                                                        <span key={gi} className="text-xs font-bold text-gray-300 tabular-nums">{gs}</span>
                                                    ))}
                                                </div>
                                            ) : smLive ? (
                                                <a
                                                    href={`/live/${sm._id}`}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold uppercase tracking-widest"
                                                >
                                                    <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse" /> Live
                                                </a>
                                            ) : (
                                                <span className="text-[9px] text-gray-700 uppercase font-bold tracking-wider">vs</span>
                                            )}
                                        </div>

                                        {/* Player 2 */}
                                        <div className={`flex-1 flex items-center gap-2 px-4 py-3 ${p2Wins ? 'bg-emerald-500/5' : ''}`}>
                                            <span className={`text-sm font-medium leading-tight ${p2Wins ? 'text-emerald-300 font-bold' : smDone ? 'text-white/40' : 'text-white/80'}`}>
                                                {p2Name}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
