import React, { useEffect, useState } from 'react';
import { Loader2, Trophy, BarChart3, Swords, Users } from 'lucide-react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';

interface Team { _id: string; name: string }

interface Props {
    categoryId: string;
    teams: Team[];
    setError: (err: string | null) => void;
}

interface StageData {
    stageNumber: number;
    groups: any[];
    standings: any[];
}

export default function OverallView({ categoryId, teams, setError }: Props) {
    const [stages, setStages] = useState<StageData[]>([]);
    const [loading, setLoading] = useState(true);

    const getTeamName = (teamId: string) => teams.find(t => t._id === teamId)?.name || teamId;

    useEffect(() => {
        loadAllStages();
    }, [categoryId]);

    const loadAllStages = async () => {
        setLoading(true);
        try {
            const stageData: StageData[] = [];
            // Load up to 5 stages
            for (let s = 1; s <= 5; s++) {
                const [groups, standings] = await Promise.all([
                    teamLeagueApi.getGroups(categoryId, s).catch(() => []),
                    teamLeagueApi.getGroupStandings(categoryId, s).catch(() => []),
                ]);
                const groupArr = Array.isArray(groups) ? groups : [];
                const standArr = Array.isArray(standings) ? standings : [];
                if (groupArr.length === 0 && standArr.length === 0) break;
                stageData.push({ stageNumber: s, groups: groupArr, standings: standArr });
            }
            setStages(stageData);
        } catch (e: any) {
            setError(e.message || 'Failed to load overview');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (stages.length === 0) {
        return (
            <div className="text-center p-8 bg-black/20 border border-white/5 rounded-xl">
                <BarChart3 className="h-10 w-10 text-gray-500 mx-auto mb-3 opacity-50" />
                <p className="text-gray-400">No data available yet.</p>
            </div>
        );
    }

    // Determine champion: last stage, 1 group, ≤2 teams, all ties complete → rank 1 is champion
    const lastStage = stages[stages.length - 1];
    const lastStandings = lastStage.standings;
    const allLastComplete = lastStandings.length > 0 && lastStandings.every((gs: any) => gs.completedTies > 0 && gs.completedTies === gs.totalTies);
    const isFinal = lastStandings.length === 1 && (lastStandings[0]?.standings?.length || 0) <= 2;
    const champion = isFinal && allLastComplete ? lastStandings[0]?.standings?.[0] : null;

    return (
        <div className="space-y-6">
            {/* Champion banner */}
            {champion && (
                <div className="bg-gradient-to-r from-yellow-500/10 to-primary/10 border border-yellow-500/30 rounded-xl p-6 text-center space-y-2">
                    <Trophy className="h-10 w-10 text-yellow-400 mx-auto" />
                    <h3 className="text-2xl font-oswald font-bold text-white">{champion.teamName}</h3>
                    <p className="text-yellow-400 font-semibold uppercase tracking-wider text-sm">Team League Champion</p>
                </div>
            )}

            {/* Stage-by-stage summary */}
            {stages.map(stage => {
                const totalTeams = stage.groups.reduce((acc: number, g: any) => acc + (g.teamIds?.length || 0), 0);
                return (
                    <div key={stage.stageNumber} className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Swords className="h-4 w-4 text-primary" />
                                Stage {stage.stageNumber}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {totalTeams} teams</span>
                                <span>{stage.groups.length} group{stage.groups.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        {stage.standings.map((gs: any) => (
                            <div key={gs.group._id} className="border-b border-white/5 last:border-0">
                                <div className="px-5 py-2 bg-white/[0.02] flex items-center justify-between">
                                    <span className="text-xs text-gray-400 font-semibold uppercase">{gs.group.groupName}</span>
                                    <span className="text-[10px] text-gray-600">{gs.completedTies}/{gs.totalTies} ties</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-white/5">
                                                <th className="text-left px-5 py-1.5 text-gray-600 font-medium text-xs">#</th>
                                                <th className="text-left px-3 py-1.5 text-gray-600 font-medium text-xs">Team</th>
                                                <th className="text-center px-2 py-1.5 text-gray-600 font-medium text-xs">P</th>
                                                <th className="text-center px-2 py-1.5 text-gray-600 font-medium text-xs">W</th>
                                                <th className="text-center px-2 py-1.5 text-gray-600 font-medium text-xs">L</th>
                                                <th className="text-center px-2 py-1.5 text-gray-600 font-medium text-xs">D</th>
                                                <th className="text-center px-2 py-1.5 text-primary font-bold text-xs">Pts</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(gs.standings || []).map((entry: any, idx: number) => (
                                                <tr key={entry.teamId} className="border-b border-white/5">
                                                    <td className="px-5 py-2 text-gray-500 text-xs">{idx + 1}</td>
                                                    <td className="px-3 py-2 text-white text-xs font-medium">
                                                        {entry.teamName}
                                                        {champion && entry.teamId === champion.teamId && (
                                                            <Trophy className="inline h-3 w-3 text-yellow-400 ml-1" />
                                                        )}
                                                    </td>
                                                    <td className="text-center px-2 py-2 text-gray-400 text-xs">{entry.played}</td>
                                                    <td className="text-center px-2 py-2 text-emerald-400 text-xs">{entry.won}</td>
                                                    <td className="text-center px-2 py-2 text-red-400 text-xs">{entry.lost}</td>
                                                    <td className="text-center px-2 py-2 text-yellow-400 text-xs">{entry.drawn}</td>
                                                    <td className="text-center px-2 py-2 text-primary font-bold text-xs">{entry.points}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
