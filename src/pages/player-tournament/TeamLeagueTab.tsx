import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Users, Swords, BarChart3, Trophy, ChevronRight, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Category } from '../../store/slices/registrationSlice';
import { teamLeagueApi } from '../../api/teamLeague';

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
                            {/* Tie detail */}
                            {selectedTie && tieDetail ? (
                                <TieDetailPublic
                                    tie={tieDetail.tie || selectedTie}
                                    subMatches={tieDetail.subMatches || []}
                                    lineups={tieDetail.lineups || []}
                                    categoryConfig={categoryConfig}
                                    onBack={() => { setSelectedTie(null); setTieDetail(null); }}
                                />
                            ) : selectedGroup ? (
                                /* Ties list for a group */
                                <div className="space-y-3">
                                    <button
                                        onClick={() => setSelectedGroup(null)}
                                        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
                                    >
                                        <ArrowLeft className="h-3 w-3" /> Back to groups
                                    </button>
                                    <h4 className="text-white font-bold">{selectedGroup.groupName} — Ties</h4>
                                    {tiesLoading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                    ) : ties.length === 0 ? (
                                        <p className="text-gray-500 text-sm text-center py-6">No ties scheduled yet.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {ties.map((tie: any) => (
                                                <button
                                                    key={tie._id}
                                                    onClick={() => loadTieDetail(tie)}
                                                    className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:border-primary/30 transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Swords className="h-4 w-4 text-primary shrink-0" />
                                                        <span className="text-white font-medium">{tie.teams?.team1Name}</span>
                                                        <span className="text-gray-500 text-xs">vs</span>
                                                        <span className="text-white font-medium">{tie.teams?.team2Name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                                                            tie.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                            {tie.status}
                                                        </span>
                                                        {tie.completedCount !== undefined && (
                                                            <span className="text-xs text-gray-500">{tie.completedCount}/{tie.subMatchCount}</span>
                                                        )}
                                                        <ChevronRight className="h-4 w-4 text-gray-600" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Group list */
                                <div className="space-y-2">
                                    {groups.length === 0 ? (
                                        <p className="text-center text-gray-500 py-8">No groups configured yet.</p>
                                    ) : groups.map((group: any) => (
                                        <button
                                            key={group._id}
                                            onClick={() => loadTies(group)}
                                            className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:border-primary/30 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Users className="h-4 w-4 text-primary" />
                                                <span className="text-white font-bold">{group.groupName}</span>
                                                <span className="text-xs text-gray-500">{group.teamIds?.length} teams</span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-gray-600" />
                                        </button>
                                    ))}
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
    const team1Name = tie.teams?.team1Name || 'Team 1';
    const team2Name = tie.teams?.team2Name || 'Team 2';

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h3 className="text-lg font-bold text-white">{team1Name} vs {team2Name}</h3>
                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded ${
                    tie.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                    {tie.status}
                </span>
                {tie.winnerId && (
                    <span className="text-xs text-emerald-400 ml-auto">
                        Winner: {tie.winnerId === tie.teams?.team1Id ? team1Name : team2Name}
                    </span>
                )}
            </div>

            {/* Lineups */}
            {lineups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {lineups.map((lineup: any) => {
                        const isTeam1 = lineup.teamId === tie.teams?.team1Id;
                        return (
                            <div key={lineup._id} className="bg-black/30 border border-white/10 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-2 uppercase font-semibold">
                                    {isTeam1 ? team1Name : team2Name} Lineup
                                </p>
                                <div className="space-y-1">
                                    {(lineup.assignments || []).map((a: any) => {
                                        const slotConf = categoryConfig?.subTeamSlots?.find((s: any) => s.slotNumber === a.slotNumber);
                                        return (
                                            <div key={a.slotNumber} className="flex items-center justify-between text-sm px-2 py-1 bg-white/5 rounded">
                                                <span className="text-gray-500 text-xs">{slotConf?.label || `Slot ${a.slotNumber}`}</span>
                                                <span className="text-white">{a.playerNames?.join(' & ') || 'TBD'}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Sub-matches */}
            <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-400 uppercase">Sub-Matches</h4>
                {subMatches.length === 0 ? (
                    <p className="text-gray-500 text-sm">No sub-matches yet.</p>
                ) : subMatches.map((sm: any) => {
                    const slotConfig = categoryConfig?.subTeamSlots?.find((s: any) => s.slotNumber === sm.subMatchSlotNumber);
                    const label = sm.slotLabel || slotConfig?.label || `Match ${sm.subMatchSlotNumber}`;
                    const p1Name = sm.player1?.name || team1Name;
                    const p2Name = sm.player2?.name || team2Name;

                    return (
                        <div key={sm._id} className="flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-lg">
                            <div className="flex items-center gap-3 flex-1">
                                <span className="text-xs text-gray-500 font-mono w-24 shrink-0">{label}</span>
                                <span className={`text-sm ${sm.winnerId === sm.player1?.teamId ? 'text-emerald-400 font-semibold' : 'text-white'}`}>
                                    {p1Name}
                                </span>
                                <span className="text-xs text-gray-600">vs</span>
                                <span className={`text-sm ${sm.winnerId === sm.player2?.teamId ? 'text-emerald-400 font-semibold' : 'text-white'}`}>
                                    {p2Name}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {sm.status === 'completed' ? (
                                    <>
                                        <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded uppercase font-bold">Done</span>
                                        {sm.gameScores && (
                                            <span className="text-xs text-gray-500">
                                                {sm.gameScores.map((g: any) => `${g.team1Score}-${g.team2Score}`).join(', ')}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded uppercase font-bold">Upcoming</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
