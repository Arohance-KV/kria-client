import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, Swords, Users, Eye, ArrowLeft } from 'lucide-react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import LineupAssignmentModal from './LineupAssignmentModal';
import SubMatchResultModal from './SubMatchResultModal';

interface Team { _id: string; name: string }
interface Group { _id: string; groupName: string; groupNumber: number; teamIds: string[] }

interface Props {
    categoryId: string;
    groups: Group[];
    teams: Team[];
    categoryConfig: any;
    onRefresh: () => void;
    setError: (err: string | null) => void;
}

export default function TieManagementPanel({ categoryId, groups, teams, categoryConfig, onRefresh, setError }: Props) {
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [ties, setTies] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newTie, setNewTie] = useState({ team1Id: '', team2Id: '' });

    // Tie detail view
    const [selectedTie, setSelectedTie] = useState<any>(null);
    const [tieDetail, setTieDetail] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Lineup modal
    const [lineupModal, setLineupModal] = useState<{ tieId: string; teamId: string; teamName: string } | null>(null);

    // Sub-match result modal
    const [resultModal, setResultModal] = useState<any>(null);

    const getTeamName = (teamId: string) => teams.find(t => t._id === teamId)?.name || teamId;

    useEffect(() => {
        if (groups.length > 0 && !selectedGroupId) {
            setSelectedGroupId(groups[0]._id);
        }
    }, [groups, selectedGroupId]);

    const refreshTies = useCallback(async () => {
        if (!selectedGroupId) return;
        setLoading(true);
        try {
            const data = await teamLeagueApi.getTiesByGroup(selectedGroupId);
            setTies(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to load ties');
            setTies([]);
        } finally {
            setLoading(false);
        }
    }, [selectedGroupId, setError]);

    useEffect(() => {
        if (selectedGroupId) {
            refreshTies();
        }
    }, [selectedGroupId, refreshTies]);

    const handleCreateTie = async () => {
        if (!newTie.team1Id || !newTie.team2Id || newTie.team1Id === newTie.team2Id) {
            setError('Select two different teams for the tie.');
            return;
        }
        setCreating(true);
        setError(null);
        try {
            await teamLeagueApi.createTie(selectedGroupId, categoryId, newTie.team1Id, newTie.team2Id);
            setNewTie({ team1Id: '', team2Id: '' });
            refreshTies();
            onRefresh();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to create tie');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteTie = async (tieId: string) => {
        if (!confirm('Delete this tie and all its sub-matches?')) return;
        try {
            await teamLeagueApi.deleteTie(tieId);
            refreshTies();
            onRefresh();
            if (selectedTie?._id === tieId) {
                setSelectedTie(null);
                setTieDetail(null);
            }
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to delete tie');
        }
    };

    const openTieDetail = async (tie: any) => {
        setSelectedTie(tie);
        setDetailLoading(true);
        try {
            const detail = await teamLeagueApi.getTieDetails(tie._id);
            setTieDetail(detail);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to load tie details');
        } finally {
            setDetailLoading(false);
        }
    };

    const refreshTieDetail = async () => {
        if (!selectedTie) return;
        try {
            const detail = await teamLeagueApi.getTieDetails(selectedTie._id);
            setTieDetail(detail);
            // Also refresh the ties list to update status badges
            refreshTies();
        } catch {
            // silent
        }
    };

    const selectedGroup = groups.find(g => g._id === selectedGroupId);
    const groupTeams = selectedGroup ? teams.filter(t => selectedGroup.teamIds.includes(t._id)) : [];

    if (groups.length === 0) {
        return (
            <div className="text-center p-8 bg-black/20 border border-white/5 rounded-xl">
                <Swords className="h-10 w-10 text-gray-500 mx-auto mb-3 opacity-50" />
                <p className="text-gray-400">Configure groups first before creating ties.</p>
            </div>
        );
    }

    // Tie detail view
    if (selectedTie && tieDetail) {
        const tie = tieDetail.tie || selectedTie;
        const subMatches = tieDetail.subMatches || [];
        const lineups = tieDetail.lineups || [];
        const team1Name = getTeamName(tie.teams?.team1Id);
        const team2Name = getTeamName(tie.teams?.team2Id);

        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => { setSelectedTie(null); setTieDetail(null); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <h3 className="text-lg font-bold text-white">
                        {team1Name} vs {team2Name}
                    </h3>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded ${
                        tie.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                        {tie.status}
                    </span>
                </div>

                {/* Lineup buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => setLineupModal({ tieId: tie._id, teamId: tie.teams?.team1Id, teamName: team1Name })}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-full text-sm font-medium"
                    >
                        <Users className="h-4 w-4" /> {team1Name} Lineup
                    </button>
                    <button
                        onClick={() => setLineupModal({ tieId: tie._id, teamId: tie.teams?.team2Id, teamName: team2Name })}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-full text-sm font-medium"
                    >
                        <Users className="h-4 w-4" /> {team2Name} Lineup
                    </button>
                </div>

                {/* Lineups display */}
                {lineups.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {lineups.map((lineup: any) => (
                            <div key={lineup._id} className="bg-black/30 border border-white/10 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-2 uppercase font-semibold">{getTeamName(lineup.teamId)} Lineup</p>
                                <div className="space-y-1">
                                    {(lineup.assignments || []).map((a: any) => (
                                        <div key={a.slotNumber} className="flex items-center justify-between text-sm px-2 py-1 bg-white/5 rounded">
                                            <span className="text-gray-500">Slot {a.slotNumber}</span>
                                            <span className="text-white">{a.playerNames?.join(' & ') || 'Not set'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Sub-matches */}
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase">Sub-Matches</h4>
                    {detailLoading ? (
                        <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : subMatches.length === 0 ? (
                        <p className="text-gray-500 text-sm">No sub-matches found.</p>
                    ) : (
                        <div className="space-y-2">
                            {subMatches.map((sm: any) => {
                                const slotConfig = categoryConfig?.subTeamSlots?.find((s: any) => s.slotNumber === sm.subMatchSlotNumber);
                                const label = slotConfig?.label || `Match ${sm.subMatchSlotNumber}`;
                                const p1Name = sm.player1?.name || sm.teams?.team1Name || team1Name;
                                const p2Name = sm.player2?.name || sm.teams?.team2Name || team2Name;

                                return (
                                    <div key={sm._id} className="flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-lg">
                                        <div className="flex items-center gap-3 flex-1">
                                            <span className="text-xs text-gray-500 font-mono w-24 shrink-0">{label}</span>
                                            <span className="text-sm text-white">{p1Name}</span>
                                            <span className="text-xs text-gray-600">vs</span>
                                            <span className="text-sm text-white">{p2Name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {sm.status === 'completed' ? (
                                                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded uppercase font-bold">
                                                    Done
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => setResultModal(sm)}
                                                    className="px-3 py-1 text-xs bg-primary/20 text-primary hover:bg-primary/30 rounded-full font-medium"
                                                >
                                                    Record Result
                                                </button>
                                            )}
                                            {sm.winnerId && (
                                                <span className="text-xs text-emerald-400">
                                                    W: {sm.winnerId === sm.player1?.teamId ? p1Name : p2Name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Lineup modal */}
                {lineupModal && (
                    <LineupAssignmentModal
                        tieId={lineupModal.tieId}
                        teamId={lineupModal.teamId}
                        teamName={lineupModal.teamName}
                        categoryConfig={categoryConfig}
                        onClose={() => setLineupModal(null)}
                        onSaved={refreshTieDetail}
                        setError={setError}
                    />
                )}

                {/* Sub-match result modal */}
                {resultModal && (
                    <SubMatchResultModal
                        match={resultModal}
                        onClose={() => setResultModal(null)}
                        onSaved={refreshTieDetail}
                        setError={setError}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Group tabs */}
            <div className="flex gap-2 flex-wrap">
                {groups.map(g => (
                    <button
                        key={g._id}
                        onClick={() => setSelectedGroupId(g._id)}
                        className={`px-4 py-2 text-sm rounded-full font-medium transition-colors ${
                            selectedGroupId === g._id
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        {g.groupName}
                    </button>
                ))}
            </div>

            {/* Create tie */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-black/30 rounded-xl border border-white/10">
                <select
                    value={newTie.team1Id}
                    onChange={(e) => setNewTie(prev => ({ ...prev, team1Id: e.target.value }))}
                    className="h-9 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white"
                >
                    <option value="" disabled>Select home team</option>
                    {groupTeams.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                </select>
                <span className="text-gray-500 text-sm font-bold">VS</span>
                <select
                    value={newTie.team2Id}
                    onChange={(e) => setNewTie(prev => ({ ...prev, team2Id: e.target.value }))}
                    className="h-9 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white"
                >
                    <option value="" disabled>Select away team</option>
                    {groupTeams.filter(t => t._id !== newTie.team1Id).map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                </select>
                <button
                    onClick={handleCreateTie}
                    disabled={creating || !newTie.team1Id || !newTie.team2Id}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create Tie
                </button>
            </div>

            {/* Ties list */}
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : ties.length === 0 ? (
                <div className="text-center p-8 bg-black/20 border border-white/5 rounded-xl">
                    <Swords className="h-8 w-8 text-gray-500 mx-auto mb-2 opacity-50" />
                    <p className="text-gray-400 text-sm">No ties in this group yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {ties.map((tie: any) => {
                        const t1Name = getTeamName(tie.teams?.team1Id);
                        const t2Name = getTeamName(tie.teams?.team2Id);
                        return (
                            <div key={tie._id} className="flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => openTieDetail(tie)}>
                                    <Swords className="h-4 w-4 text-primary shrink-0" />
                                    <span className="text-white font-medium">{t1Name}</span>
                                    <span className="text-gray-500 text-xs">vs</span>
                                    <span className="text-white font-medium">{t2Name}</span>
                                    <span className={`ml-2 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded ${
                                        tie.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {tie.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openTieDetail(tie)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded">
                                        <Eye className="h-4 w-4" />
                                    </button>
                                    {tie.status !== 'completed' && (
                                        <button onClick={() => handleDeleteTie(tie._id)} className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
