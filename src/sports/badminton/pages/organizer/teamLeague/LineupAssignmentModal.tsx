import { useEffect, useId, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, Search, Shuffle, X } from 'lucide-react';
import API from '@/api/axios';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, INPUT, Notice, Spinner } from '@/pages/organizer/ui';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM } from '@/pages/organizer/shared';
import { cn } from '@/lib/utils';

interface Props {
    tieId: string;
    teamId: string;
    teamName: string;
    categoryConfig: any;
    onClose: () => void;
    onSaved: () => void;
}

interface RosterPlayer {
    _id: string;
    playerId: string;
    fullName: string;
}

interface SlotAssignment {
    slotNumber: number;
    playerIds: string[];
    playerNames: string[];
}

const slotSize = (slot: any) => (slot.matchType === 'singles' ? 1 : 2);

// ─── Searchable player picker ────────────────────────────────────────────────

function PlayerPicker({ label, players, value, onChange, excluded }: {
    label: string;
    players: RosterPlayer[];
    value: string;
    onChange: (id: string, name: string) => void;
    excluded: string[];
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const listId = useId();

    const selected = players.find(p => p.playerId === value || p._id === value);
    const options = players.filter(p =>
        (!excluded.includes(p.playerId) || p.playerId === value) && p.fullName.toLowerCase().includes(query.trim().toLowerCase()));

    const pick = (id: string, name: string) => { onChange(id, name); setOpen(false); setQuery(''); };

    return (
        <div className="flex min-w-0 items-center gap-1">
            <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQuery(''); }}>
                <PopoverTrigger role="combobox" aria-label={label} aria-controls={listId}
                    className={cn(INPUT, 'flex min-w-0 items-center justify-between gap-2 text-left', !selected && 'text-fg-subtle')}>
                    <span className="truncate">{selected ? selected.fullName : 'Choose a player'}</span>
                    <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={4}
                    className="z-[70] w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-[10px] border-line bg-raised p-0 font-ui text-fg">
                    <label className="flex items-center gap-2 border-b border-line px-3">
                        <Search aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                        <span className="sr-only">Search players</span>
                        <input type="search" autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search players"
                            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle focus:outline-none" />
                    </label>
                    <div id={listId} role="listbox" aria-label={label} data-lenis-prevent className="max-h-56 overflow-y-auto p-1">
                        {options.length === 0 ? (
                            <p className="px-2.5 py-3 text-center text-[13px] text-fg-subtle">No players found</p>
                        ) : options.map(p => (
                            <button key={p._id} type="button" role="option" aria-selected={p === selected}
                                onClick={() => pick(p.playerId || p._id, p.fullName)}
                                className={cn('block w-full truncate rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.06] focus-visible:outline-none',
                                    p === selected ? 'text-primary' : 'text-fg-muted hover:text-fg')}>
                                {p.fullName}
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
            {selected && (
                <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange('', '')} className={cn(BTN_GHOST, 'w-9 px-0')}>
                    <X aria-hidden className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

// ─── Lineup dialog ───────────────────────────────────────────────────────────

export default function LineupAssignmentModal({ tieId, teamId, teamName, categoryConfig, onClose, onSaved }: Props) {
    const [roster, setRoster] = useState<RosterPlayer[]>([]);
    const [assignments, setAssignments] = useState<SlotAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const subTeamSlots: any[] = categoryConfig?.subTeamSlots || [];
    const needed = subTeamSlots.reduce((n: number, s: any) => n + slotSize(s), 0);

    useEffect(() => {
        let live = true;
        (async () => {
            setLoading(true);
            // Fetch roster and existing lineup in parallel
            const [rosterRes, lineupRes] = await Promise.allSettled([
                API.get(`/registrations/teams/${teamId}/roster`),
                teamLeagueApi.getLineup(tieId, teamId),
            ]);
            if (!live) return;

            let players: RosterPlayer[] = [];
            if (rosterRes.status === 'fulfilled') {
                const rosterData = rosterRes.value.data?.data?.data || rosterRes.value.data?.data;
                players = (rosterData?.players || []).map((p: any) => ({
                    _id: p._id,
                    playerId: p.playerId || p._id,
                    fullName: `${p.profile?.firstName || ''} ${p.profile?.lastName || ''}`.trim(),
                }));
            }
            setRoster(players);

            const lineupData = lineupRes.status === 'fulfilled' ? lineupRes.value : null;
            const lineups = Array.isArray(lineupData) ? lineupData : lineupData ? [lineupData] : [];
            const existing = lineups.find((l: any) => l.teamId === teamId);
            setAssignments(subTeamSlots.map((s: any) => {
                const found = existing?.assignments?.find((a: any) => a.slotNumber === s.slotNumber);
                const blank = Array(slotSize(s)).fill('');
                return {
                    slotNumber: s.slotNumber,
                    playerIds: found?.playerIds?.length ? found.playerIds : blank,
                    playerNames: found?.playerNames?.length ? found.playerNames : blank,
                };
            }));
            setLoading(false);
        })();
        return () => { live = false; };
    }, [tieId, teamId]);

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

    // Fill every slot with distinct random players from the roster.
    const fillRandomly = () => {
        const pool = [...roster];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        let k = 0;
        setAssignments(subTeamSlots.map((s: any) => {
            const picks = pool.slice(k, k + slotSize(s));
            k += slotSize(s);
            return { slotNumber: s.slotNumber, playerIds: picks.map(p => p.playerId || p._id), playerNames: picks.map(p => p.fullName) };
        }));
        setError(null);
    };

    // All playerIds selected in this lineup (for exclusion in pickers)
    const allSelectedIds = assignments.flatMap(a => a.playerIds.filter(Boolean));
    const labelOf = (slotNumber: number) => subTeamSlots.find((s: any) => s.slotNumber === slotNumber)?.label || `Slot ${slotNumber}`;

    const save = async () => {
        // A half-filled doubles pair can't be saved; empty slots are simply left for later.
        const half = assignments.find(a => a.playerIds.some(Boolean) && !a.playerIds.every(Boolean));
        if (half) { setError(`${labelOf(half.slotNumber)} needs both players.`); return; }
        const filled = assignments.filter(a => a.playerIds.length && a.playerIds.every(Boolean));
        if (!filled.length) { setError('Choose players for at least one slot.'); return; }
        setSaving(true);
        setError(null);
        try {
            await teamLeagueApi.submitLineup(tieId, teamId, filled);
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to save lineup');
            setSaving(false);
        }
    };

    return (
        <Dialog title={`${teamName} lineup`} onClose={onClose}
            footer={<>
                {error && <p role="alert" className="mr-auto min-w-0 text-[13px] text-red-300">{error}</p>}
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" onClick={save} disabled={saving || loading} className={BTN_PRIMARY}>
                    {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}Save lineup
                </button>
            </>}>
            {loading ? <Spinner label="Loading lineup" /> : (
                <div className="grid gap-4">
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="text-fg-muted">{roster.length} player{roster.length === 1 ? '' : 's'} in roster</span>
                        <button type="button" onClick={fillRandomly} disabled={!roster.length || roster.length < needed} className={cn(BTN_GHOST, BTN_SM)}>
                            <Shuffle aria-hidden className="h-3.5 w-3.5" />Fill randomly
                        </button>
                    </div>

                    {roster.length === 0 ? (
                        <Notice tone="amber" icon={AlertTriangle}>
                            No players in this team's roster yet. Players appear here once the auction assigns them to the team.
                        </Notice>
                    ) : roster.length < needed && (
                        <Notice tone="amber" icon={AlertTriangle}>
                            A full lineup needs {needed} different players, and the roster has {roster.length}. Some slots will stay empty.
                        </Notice>
                    )}

                    {subTeamSlots.map((slot: any, idx: number) => {
                        const a = assignments[idx];
                        if (!a) return null;
                        const size = slotSize(slot);
                        return (
                            <div key={slot.slotNumber} className="grid gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-medium text-fg-muted">{slot.label}</span>
                                    <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11.5px] text-fg-subtle ring-1 ring-inset ring-white/10">
                                        {String(slot.matchType).replace('_', ' ')}
                                    </span>
                                </div>
                                <div className={cn('grid gap-2', size > 1 && 'sm:grid-cols-2')}>
                                    {Array.from({ length: size }, (_, k) => (
                                        <PlayerPicker key={k}
                                            label={size > 1 ? `${slot.label} player ${k + 1}` : slot.label}
                                            players={roster}
                                            value={a.playerIds[k] || ''}
                                            onChange={(id, name) => updatePlayer(idx, k, id, name)}
                                            excluded={allSelectedIds.filter(id => id !== a.playerIds[k])}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {subTeamSlots.length > 0 && <p className="text-xs text-fg-subtle">A player already picked for another slot isn't offered again.</p>}
                </div>
            )}
        </Dialog>
    );
}
