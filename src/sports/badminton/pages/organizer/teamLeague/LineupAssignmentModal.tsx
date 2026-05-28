import React, { useEffect, useState, useRef } from 'react';
import { Loader2, Save, X, Users, Search, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import API from '@/api/axios';

interface Props {
    tieId: string;
    teamId: string;
    teamName: string;
    categoryConfig: any;
    onClose: () => void;
    onSaved: () => void;
    setError: (err: string | null) => void;
}

interface RosterPlayer {
    _id: string;
    playerId: string;
    profile: { firstName: string; lastName: string; photo?: string };
    fullName: string;
}

interface SlotAssignment {
    slotNumber: number;
    playerIds: string[];
    playerNames: string[];
}

// ─── Searchable player picker ────────────────────────────────────────────────

function PlayerPicker({
    players,
    value,
    onChange,
    placeholder,
    excluded,
}: {
    players: RosterPlayer[];
    value: string;
    onChange: (id: string, name: string) => void;
    placeholder: string;
    excluded: string[];
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    const selected = players.find(p => p.playerId === value || p._id === value);
    const available = players.filter(p => !excluded.includes(p.playerId) || p.playerId === value);
    const filtered = available.filter(p =>
        p.fullName.toLowerCase().includes(query.toLowerCase())
    );

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (player: RosterPlayer) => {
        onChange(player.playerId || player._id, player.fullName);
        setOpen(false);
        setQuery('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('', '');
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between h-9 px-3 rounded-md border text-sm transition-colors ${
                    selected
                        ? 'bg-primary/10 border-primary/40 text-white'
                        : 'bg-black/50 border-white/10 text-gray-400'
                }`}
            >
                <span className="truncate">{selected ? selected.fullName : placeholder}</span>
                <div className="flex items-center gap-1 shrink-0">
                    {selected && (
                        <span
                            onClick={handleClear}
                            className="p-0.5 text-gray-500 hover:text-red-400 cursor-pointer"
                        >
                            <X className="h-3 w-3" />
                        </span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    {/* Search */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                        <Search className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                        <input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search player..."
                            className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1"
                        />
                    </div>

                    {/* Options */}
                    <div className="max-h-44 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="text-center text-xs text-gray-500 py-3">No players found</p>
                        ) : (
                            filtered.map(player => (
                                <button
                                    key={player._id}
                                    type="button"
                                    onClick={() => handleSelect(player)}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                                        (player.playerId === value || player._id === value)
                                            ? 'text-primary bg-primary/10'
                                            : 'text-gray-300'
                                    }`}
                                >
                                    {player.fullName}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export default function LineupAssignmentModal({ tieId, teamId, teamName, categoryConfig, onClose, onSaved, setError }: Props) {
    const [roster, setRoster] = useState<RosterPlayer[]>([]);
    const [assignments, setAssignments] = useState<SlotAssignment[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const subTeamSlots: any[] = categoryConfig?.subTeamSlots || [];

    useEffect(() => {
        loadData();
    }, [tieId, teamId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch roster and existing lineup in parallel
            const [rosterRes, lineupRes] = await Promise.allSettled([
                API.get(`/registrations/teams/${teamId}/roster`),
                teamLeagueApi.getLineup(tieId, teamId),
            ]);

            // Build roster list
            let rosterPlayers: RosterPlayer[] = [];
            if (rosterRes.status === 'fulfilled') {
                const rosterData = rosterRes.value.data?.data?.data || rosterRes.value.data?.data;
                const raw: any[] = rosterData?.players || [];
                rosterPlayers = raw.map(p => ({
                    _id: p._id,
                    playerId: p.playerId || p._id,
                    profile: p.profile,
                    fullName: `${p.profile?.firstName || ''} ${p.profile?.lastName || ''}`.trim(),
                }));
            }
            setRoster(rosterPlayers);

            // Build assignment state from existing lineup or blank
            const defaultAssignments = subTeamSlots.map((s: any) => ({
                slotNumber: s.slotNumber,
                playerIds: s.matchType === 'singles' ? [''] : ['', ''],
                playerNames: s.matchType === 'singles' ? [''] : ['', ''],
            }));

            if (lineupRes.status === 'fulfilled') {
                const lineupData = lineupRes.value;
                const lineups = Array.isArray(lineupData) ? lineupData : lineupData ? [lineupData] : [];
                const existing = lineups.find((l: any) => l.teamId === teamId);
                if (existing?.assignments?.length) {
                    const merged = defaultAssignments.map(def => {
                        const found = existing.assignments.find((a: any) => a.slotNumber === def.slotNumber);
                        if (!found) return def;
                        return {
                            ...def,
                            playerIds: found.playerIds?.length ? found.playerIds : def.playerIds,
                            playerNames: found.playerNames?.length ? found.playerNames : def.playerNames,
                        };
                    });
                    setAssignments(merged);
                } else {
                    setAssignments(defaultAssignments);
                }
            } else {
                setAssignments(defaultAssignments);
            }
        } catch {
            setAssignments(subTeamSlots.map((s: any) => ({
                slotNumber: s.slotNumber,
                playerIds: s.matchType === 'singles' ? [''] : ['', ''],
                playerNames: s.matchType === 'singles' ? [''] : ['', ''],
            })));
        } finally {
            setLoading(false);
        }
    };

    const updatePlayer = (slotIdx: number, playerIdx: number, playerId: string, playerName: string) => {
        setAssignments(prev => prev.map((a, i) => {
            if (i !== slotIdx) return a;
            const ids = [...a.playerIds];
            const names = [...a.playerNames];
            ids[playerIdx] = playerId;
            names[playerIdx] = playerName;
            return { ...a, playerIds: ids, playerNames: names };
        }));
    };

    // All playerIds selected in this lineup (for exclusion in pickers)
    const allSelectedIds = assignments.flatMap(a => a.playerIds.filter(Boolean));

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await teamLeagueApi.submitLineup(tieId, teamId, assignments);
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to save lineup');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-bold text-white">{teamName} Lineup</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Roster summary */}
                        {roster.length === 0 ? (
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
                                No players found in this team's roster. Ensure the auction is complete and players are assigned to this team.
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 p-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400">
                                <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                                {roster.length} player{roster.length !== 1 ? 's' : ''} in roster
                            </div>
                        )}

                        {/* Slot assignments */}
                        {subTeamSlots.map((slot: any, idx: number) => {
                            const assignment = assignments[idx];
                            if (!assignment) return null;
                            const isDoubles = slot.matchType === 'doubles' || slot.matchType === 'mixed_doubles';

                            // For each picker, exclude all selected IDs except the one in this position
                            const excludedForP1 = allSelectedIds.filter(id => id !== assignment.playerIds[0]);
                            const excludedForP2 = allSelectedIds.filter(id => id !== assignment.playerIds[1]);

                            return (
                                <div key={slot.slotNumber} className="p-3 bg-black/40 border border-white/10 rounded-lg space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-gray-300 font-semibold text-sm">{slot.label}</Label>
                                        <span className="text-[10px] text-gray-500 uppercase bg-white/5 px-2 py-0.5 rounded">
                                            {slot.matchType.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <PlayerPicker
                                        players={roster}
                                        value={assignment.playerIds[0] || ''}
                                        onChange={(id, name) => updatePlayer(idx, 0, id, name)}
                                        placeholder={isDoubles ? 'Player 1' : 'Select player'}
                                        excluded={excludedForP1}
                                    />

                                    {isDoubles && (
                                        <PlayerPicker
                                            players={roster}
                                            value={assignment.playerIds[1] || ''}
                                            onChange={(id, name) => updatePlayer(idx, 1, id, name)}
                                            placeholder="Player 2"
                                            excluded={excludedForP2}
                                        />
                                    )}
                                </div>
                            );
                        })}

                        {/* Footer */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-full border border-white/10 text-white text-sm hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Lineup
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
