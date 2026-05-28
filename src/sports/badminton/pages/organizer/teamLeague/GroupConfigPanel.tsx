import React, { useState } from 'react';
import { Loader2, Shuffle, Plus, X, Save, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';

interface Team {
    _id: string;
    name: string;
    logo?: string;
    primaryColor?: string;
}

interface Group {
    _id: string;
    groupName: string;
    groupNumber: number;
    teamIds: string[];
}

interface Props {
    categoryId: string;
    categoryStatus: string;
    groups: Group[];
    teams: Team[];
    onRefresh: () => void;
    setError: (err: string | null) => void;
}

export default function GroupConfigPanel({ categoryId, categoryStatus, groups, teams, onRefresh, setError }: Props) {
    const [loading, setLoading] = useState(false);
    const [randomizeCount, setRandomizeCount] = useState(2);
    const [editingGroups, setEditingGroups] = useState<{ name: string; teamIds: string[] }[] | null>(null);

    const canConfigure = ['auction', 'registration'].includes(categoryStatus);

    const handleRandomize = async () => {
        if (!confirm(`Randomize teams into ${randomizeCount} groups? This will replace existing groups.`)) return;
        setLoading(true);
        setError(null);
        try {
            await teamLeagueApi.randomizeGroups(categoryId, randomizeCount);
            onRefresh();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to randomize groups');
        } finally {
            setLoading(false);
        }
    };

    const startManualConfig = () => {
        if (groups.length > 0) {
            setEditingGroups(groups.map(g => ({ name: g.groupName, teamIds: [...g.teamIds] })));
        } else {
            setEditingGroups([
                { name: 'Group A', teamIds: [] },
                { name: 'Group B', teamIds: [] },
            ]);
        }
    };

    const addGroupSlot = () => {
        if (!editingGroups) return;
        const letter = String.fromCharCode(65 + editingGroups.length);
        setEditingGroups([...editingGroups, { name: `Group ${letter}`, teamIds: [] }]);
    };

    const removeGroupSlot = (idx: number) => {
        if (!editingGroups || editingGroups.length <= 1) return;
        setEditingGroups(editingGroups.filter((_, i) => i !== idx));
    };

    const toggleTeamInGroup = (groupIdx: number, teamId: string) => {
        if (!editingGroups) return;
        const updated = editingGroups.map((g, i) => {
            if (i === groupIdx) {
                const has = g.teamIds.includes(teamId);
                return { ...g, teamIds: has ? g.teamIds.filter(id => id !== teamId) : [...g.teamIds, teamId] };
            }
            // Remove from other groups
            return { ...g, teamIds: g.teamIds.filter(id => id !== teamId) };
        });
        setEditingGroups(updated);
    };

    const handleSaveGroups = async () => {
        if (!editingGroups) return;
        const emptyGroups = editingGroups.filter(g => g.teamIds.length === 0);
        if (emptyGroups.length > 0) {
            setError('All groups must have at least one team.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await teamLeagueApi.configureGroups(categoryId, editingGroups);
            setEditingGroups(null);
            onRefresh();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to save groups');
        } finally {
            setLoading(false);
        }
    };

    const assignedTeamIds = groups.flatMap(g => g.teamIds);
    const unassignedTeams = teams.filter(t => !assignedTeamIds.includes(t._id));

    const getTeamName = (teamId: string) => teams.find(t => t._id === teamId)?.name || teamId;

    if (editingGroups) {
        const editAssignedIds = editingGroups.flatMap(g => g.teamIds);
        const editUnassigned = teams.filter(t => !editAssignedIds.includes(t._id));

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Configure Groups</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setEditingGroups(null)} className="px-4 py-2 rounded-full border border-white/10 text-white text-sm hover:bg-white/5">
                            Cancel
                        </button>
                        <button onClick={addGroupSlot} className="flex items-center gap-1 px-3 py-2 text-sm bg-white/10 text-white rounded-full hover:bg-white/15">
                            <Plus className="h-3 w-3" /> Add Group
                        </button>
                        <button onClick={handleSaveGroups} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm hover:bg-primary/90 disabled:opacity-50">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Groups
                        </button>
                    </div>
                </div>

                {/* Unassigned teams */}
                {editUnassigned.length > 0 && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-xs text-yellow-400 mb-2 font-semibold uppercase">Unassigned Teams ({editUnassigned.length})</p>
                        <div className="flex flex-wrap gap-2">
                            {editUnassigned.map(t => (
                                <span key={t._id} className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-300 rounded">
                                    {t.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Groups */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {editingGroups.map((group, gIdx) => (
                        <div key={gIdx} className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <Input
                                    value={group.name}
                                    onChange={(e) => {
                                        const updated = [...editingGroups];
                                        updated[gIdx] = { ...updated[gIdx], name: e.target.value };
                                        setEditingGroups(updated);
                                    }}
                                    className="bg-black/50 border-white/10 text-white font-bold w-40 h-8 text-sm"
                                />
                                {editingGroups.length > 1 && (
                                    <button onClick={() => removeGroupSlot(gIdx)} className="p-1 text-red-400 hover:text-red-500">
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1">
                                {teams.map(team => {
                                    const inThisGroup = group.teamIds.includes(team._id);
                                    const inOtherGroup = !inThisGroup && editAssignedIds.includes(team._id);
                                    return (
                                        <button
                                            key={team._id}
                                            onClick={() => toggleTeamInGroup(gIdx, team._id)}
                                            disabled={inOtherGroup}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                                inThisGroup
                                                    ? 'bg-primary/20 text-primary border border-primary/30'
                                                    : inOtherGroup
                                                        ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                                                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                            }`}
                                        >
                                            {team.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Randomize / Manual config controls */}
            {canConfigure && (
                <div className="flex flex-wrap items-center gap-3 p-4 bg-black/30 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2">
                        <Label className="text-gray-400 text-sm">Groups:</Label>
                        <Input
                            type="number"
                            min={1}
                            max={10}
                            value={randomizeCount}
                            onChange={(e) => setRandomizeCount(Number(e.target.value))}
                            className="bg-black/50 border-white/10 text-white w-16 h-8 text-sm"
                        />
                    </div>
                    <button
                        onClick={handleRandomize}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-full text-sm font-medium disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                        Randomize
                    </button>
                    <span className="text-gray-600">or</span>
                    <button
                        onClick={startManualConfig}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white hover:bg-white/15 rounded-full text-sm font-medium"
                    >
                        <Users className="h-4 w-4" /> Manual Setup
                    </button>
                </div>
            )}

            {/* Current groups */}
            {groups.length === 0 ? (
                <div className="text-center p-8 bg-black/20 border border-white/5 rounded-xl">
                    <Users className="h-10 w-10 text-gray-500 mx-auto mb-3 opacity-50" />
                    <p className="text-gray-400">No groups configured yet.</p>
                    {canConfigure && <p className="text-sm text-gray-500 mt-1">Use the controls above to set up groups.</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groups.map(group => (
                        <div key={group._id} className="bg-black/40 border border-white/10 rounded-xl p-4">
                            <h4 className="text-md font-bold text-white mb-3 flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                {group.groupName}
                                <span className="text-xs text-gray-500 font-normal">({group.teamIds.length} teams)</span>
                            </h4>
                            <div className="space-y-1.5">
                                {group.teamIds.map((teamId: string) => (
                                    <div key={teamId} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-sm text-gray-300">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                        {getTeamName(teamId)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Unassigned teams info */}
            {groups.length > 0 && unassignedTeams.length > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-xs text-yellow-400 font-semibold">
                        {unassignedTeams.length} team(s) not in any group: {unassignedTeams.map(t => t.name).join(', ')}
                    </p>
                </div>
            )}
        </div>
    );
}
