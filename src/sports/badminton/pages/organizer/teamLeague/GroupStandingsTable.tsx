import React, { useState } from 'react';
import { RefreshCw, BarChart3, ArrowRight, Loader2, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';

interface Group {
    _id: string;
    groupName: string;
    groupNumber: number;
    teamIds: string[];
}

interface StandingEntry {
    teamId: string;
    teamName: string;
    played: number;
    won: number;
    lost: number;
    drawn: number;
    points: number;
    subMatchesWon: number;
    subMatchesLost: number;
    rank: number;
}

interface GroupStanding {
    group: { _id: string; groupName: string; groupNumber: number };
    standings: StandingEntry[];
    totalTies: number;
    completedTies: number;
}

interface Props {
    categoryId: string;
    stageNumber: number;
    standings: GroupStanding[];
    groups: Group[];
    topNPerGroup: number;
    onRefresh: () => void;
    onAdvanced: () => void;
    setError: (err: string | null) => void;
}

export default function GroupStandingsTable({ categoryId, stageNumber, standings, groups, topNPerGroup, onRefresh, onAdvanced, setError }: Props) {
    const [showAdvance, setShowAdvance] = useState(false);
    const [advanceFormat, setAdvanceFormat] = useState<'groups' | 'knockout'>('knockout');
    const [advanceGroups, setAdvanceGroups] = useState(1);
    const [advancing, setAdvancing] = useState(false);

    const allComplete = standings.length > 0 && standings.every(gs => gs.completedTies > 0 && gs.completedTies === gs.totalTies);

    // Build qualified teams (top N from each group based on rank)
    const qualifiedTeams = standings.flatMap(gs =>
        (gs.standings || [])
            .filter(e => e.rank <= topNPerGroup)
            .map(e => ({ teamId: e.teamId, teamName: e.teamName, groupName: gs.group.groupName }))
    );

    const handleAdvance = async () => {
        if (qualifiedTeams.length === 0) {
            setError('No teams to advance.');
            return;
        }
        setAdvancing(true);
        setError(null);
        try {
            const teamAdvancement = qualifiedTeams.map((t, idx) => ({
                teamId: t.teamId,
                ...(advanceFormat === 'groups' ? { groupNumber: (idx % advanceGroups) + 1 } : {}),
            }));
            await teamLeagueApi.advanceTeams(categoryId, stageNumber, {
                format: advanceFormat,
                numberOfGroups: advanceFormat === 'groups' ? advanceGroups : undefined,
                teamAdvancement,
            });
            setShowAdvance(false);
            onAdvanced();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to advance teams');
        } finally {
            setAdvancing(false);
        }
    };

    if (standings.length === 0 && groups.length === 0) {
        return (
            <div className="text-center p-8 bg-black/20 border border-white/5 rounded-xl">
                <BarChart3 className="h-10 w-10 text-gray-500 mx-auto mb-3 opacity-50" />
                <p className="text-gray-400">No standings available yet.</p>
                <p className="text-sm text-gray-500 mt-1">Configure groups and play ties to see standings.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" /> Standings
                </h3>
                <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            {standings.map(gs => (
                <div key={gs.group._id} className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">{gs.group.groupName}</h4>
                        <span className="text-xs text-gray-500">{gs.completedTies}/{gs.totalTies} ties completed</span>
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
                                {(gs.standings || []).map((entry, idx) => {
                                    const isQualified = entry.rank <= topNPerGroup;
                                    return (
                                        <tr key={entry.teamId} className={`border-b border-white/5 transition-colors ${isQualified && allComplete ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'hover:bg-white/5'}`}>
                                            <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                                            <td className="px-4 py-2.5 text-white font-medium flex items-center gap-2">
                                                {entry.teamName}
                                                {isQualified && allComplete && (
                                                    <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 rounded uppercase font-bold">Q</span>
                                                )}
                                            </td>
                                            <td className="text-center px-3 py-2.5 text-gray-300">{entry.played}</td>
                                            <td className="text-center px-3 py-2.5 text-emerald-400">{entry.won}</td>
                                            <td className="text-center px-3 py-2.5 text-red-400">{entry.lost}</td>
                                            <td className="text-center px-3 py-2.5 text-yellow-400">{entry.drawn}</td>
                                            <td className="text-center px-3 py-2.5 text-gray-300">{entry.subMatchesWon}</td>
                                            <td className="text-center px-3 py-2.5 text-gray-300">{entry.subMatchesLost}</td>
                                            <td className="text-center px-3 py-2.5 text-primary font-bold text-base">{entry.points}</td>
                                        </tr>
                                    );
                                })}
                                {(!gs.standings || gs.standings.length === 0) && (
                                    <tr>
                                        <td colSpan={9} className="text-center py-4 text-gray-500">No data yet</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            {/* Advancement / Winner section */}
            {allComplete && (() => {
                // Determine total teams across all groups
                const totalTeams = standings.reduce((acc, gs) => acc + (gs.standings?.length || 0), 0);
                // If only 1 group with ≤2 teams, this is the final
                const isFinal = standings.length === 1 && totalTeams <= 2;
                const winner = isFinal && standings[0]?.standings?.[0];

                if (isFinal && winner) {
                    return (
                        <div className="bg-gradient-to-r from-yellow-500/10 to-primary/10 border border-yellow-500/30 rounded-xl p-6 text-center space-y-3">
                            <Trophy className="h-12 w-12 text-yellow-400 mx-auto" />
                            <h3 className="text-2xl font-oswald font-bold text-white">
                                {winner.teamName}
                            </h3>
                            <p className="text-yellow-400 font-semibold uppercase tracking-wider text-sm">
                                Team League Champion
                            </p>
                            <div className="text-gray-400 text-sm">
                                Won {winner.won} of {winner.played} tie(s) &middot; {winner.subMatchesWon} sub-matches won
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-emerald-400" />
                                <h4 className="text-white font-bold">Stage {stageNumber} Complete</h4>
                            </div>
                            {!showAdvance && (
                                <button
                                    onClick={() => setShowAdvance(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-full text-sm font-medium"
                                >
                                    <ArrowRight className="h-4 w-4" /> Advance Teams to Stage {stageNumber + 1}
                                </button>
                            )}
                        </div>

                    {showAdvance && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            {/* Qualified teams */}
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-2">
                                    Qualified Teams (Top {topNPerGroup} per group)
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {qualifiedTeams.map(t => (
                                        <span key={t.teamId} className="px-3 py-1.5 text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                                            {t.teamName}
                                            <span className="text-gray-500 text-xs ml-1">({t.groupName})</span>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Next stage format */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Next Stage Format</Label>
                                    <select
                                        value={advanceFormat}
                                        onChange={(e) => setAdvanceFormat(e.target.value as 'groups' | 'knockout')}
                                        className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
                                    >
                                        <option value="knockout">Knockout</option>
                                        <option value="groups">New Groups</option>
                                    </select>
                                </div>
                                {advanceFormat === 'groups' && (
                                    <div className="space-y-2">
                                        <Label className="text-gray-400">Number of Groups</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={advanceGroups}
                                            onChange={(e) => setAdvanceGroups(Number(e.target.value))}
                                            className="bg-black/50 border-white/10 text-white"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                                <button
                                    onClick={() => setShowAdvance(false)}
                                    className="px-4 py-2 rounded-full border border-white/10 text-white text-sm hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAdvance}
                                    disabled={advancing || qualifiedTeams.length === 0}
                                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                    Advance {qualifiedTeams.length} Teams
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                );
            })()}
        </div>
    );
}
