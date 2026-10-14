import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronRight, Info, Loader2, Plus, Radio, Shuffle, Trash2 } from 'lucide-react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import { COLHEAD, ConfirmBar, Dialog, Drawer, EmptyState, Field, INPUT, Notice, PANEL, ROW, SegTabs, Spinner, TeamLogo, useReadOnly } from '@/pages/organizer/ui';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS, MATCH_STATUS, ToneBadge } from '@/pages/organizer/shared';
import { cn } from '@/lib/utils';
import LineupAssignmentModal from './LineupAssignmentModal';
import SubMatchResultModal from './SubMatchResultModal';
import BadmintonScoringConsole from './BadmintonScoringConsole';

interface Team { _id: string; name: string; logo?: string; primaryColor?: string }
interface Group { _id: string; groupName: string; groupNumber: number; teamIds: string[]; teams?: (Team | null)[] }

interface Props {
    categoryId: string;
    groups: Group[] | null;
    teams: Team[];
    /** Tie count per group id, for the group tabs. */
    tieCounts: Record<string, number>;
    categoryConfig: any;
    onRefresh: () => void;
    setError: (err: string | null) => void;
}

const TIE_COLS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,10rem)_4.5rem]';

/** A tie reads Live while any of its sub-matches is being scored. */
const tieStatus = (tie: any) => tie.status === 'completed' ? MATCH_STATUS.completed
    : tie.status === 'in_progress' || tie.subMatches?.some((m: any) => m.status === 'in_progress') ? MATCH_STATUS.in_progress
    : MATCH_STATUS.scheduled;

const gameLine = (m: any) => (m.gameScores || [])
    .filter((g: any) => g.team1Score || g.team2Score)
    .map((g: any) => `${g.team1Score}–${g.team2Score}`).join(', ');

/**
 * The tie drawer stays open under its lineup, result and scoring overlays, and every overlay
 * closes on Escape. This wrapper handles Escape for the top one first, so it alone closes.
 */
export default function TieManagementPanel({ categoryId, groups, teams, tieCounts, categoryConfig, onRefresh, setError }: Props) {
    const [groupId, setGroupId] = useState('');
    const [ties, setTies] = useState<any[] | null>(null);
    const [adding, setAdding] = useState(false);
    const [confirmGenerate, setConfirmGenerate] = useState(false);
    const [generating, setGenerating] = useState(false);

    // Tie drawer
    const [openTie, setOpenTie] = useState<any>(null);
    const [detail, setDetail] = useState<any>(null);
    const [tieError, setTieError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [lineupFor, setLineupFor] = useState<{ teamId: string; teamName: string } | null>(null);
    const [resultFor, setResultFor] = useState<any>(null);
    const [liveFor, setLiveFor] = useState<any>(null);
    const readOnly = useReadOnly();

    // Keep the chosen group across refreshes; fall back to the first when it's gone (new stage, regrouped).
    useEffect(() => {
        if (groups?.length && !groups.some(g => g._id === groupId)) setGroupId(groups[0]._id);
    }, [groups, groupId]);

    const refreshTies = useCallback(async () => {
        if (!groupId) return;
        try {
            const data = await teamLeagueApi.getTiesByGroup(groupId);
            setTies(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to load ties');
            setTies([]);
        }
    }, [groupId, setError]);

    useEffect(() => {
        setTies(null);
        setConfirmGenerate(false);
        refreshTies();
    }, [refreshTies]);

    const group = groups?.find(g => g._id === groupId);
    const teamOf = (id: string): Team | undefined => teams.find(t => t._id === id) ?? group?.teams?.find(t => t?._id === id) ?? undefined;
    const sidesOf = (tie: any) => [1, 2].map(n => {
        const id = String(tie?.teams?.[`team${n}Id`] ?? '');
        const t = teamOf(id);
        return { id, name: t?.name ?? tie?.teams?.[`team${n}Name`] ?? `Team ${n}`, logo: t?.logo, color: t?.primaryColor };
    });

    const generate = async () => {
        setGenerating(true);
        setError(null);
        try {
            await teamLeagueApi.generateGroupTies(groupId, categoryId);
            setConfirmGenerate(false);
            refreshTies();
            onRefresh();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to generate ties');
        } finally {
            setGenerating(false);
        }
    };

    const open = async (tie: any) => {
        setOpenTie(tie);
        setTieError(null);
        setConfirmDelete(false);
        try {
            setDetail(await teamLeagueApi.getTieDetails(tie._id));
        } catch (e: any) {
            setTieError(e.response?.data?.message || 'Failed to load tie details');
        }
    };

    const closeTie = () => { setOpenTie(null); setDetail(null); };

    // After a lineup, live point or result: reload the tie, its row, and the standings.
    const refreshTie = async () => {
        if (!openTie) return;
        refreshTies();
        onRefresh();
        try {
            setDetail(await teamLeagueApi.getTieDetails(openTie._id));
        } catch (e: any) {
            setTieError(e.response?.data?.message || 'Failed to refresh the tie');
        }
    };

    const deleteTie = async () => {
        setDeleting(true);
        setTieError(null);
        try {
            await teamLeagueApi.deleteTie(openTie._id);
            closeTie();
            refreshTies();
            onRefresh();
        } catch (e: any) {
            setTieError(e.response?.data?.message || 'Failed to delete tie');
        } finally {
            setDeleting(false);
        }
    };

    if (!groups) return <Spinner label="Loading groups" />;
    if (groups.length === 0) {
        return (
            <div className={PANEL}>
                <EmptyState title="No groups yet" text="Set up groups first, then add ties." />
            </div>
        );
    }

    const groupTeams = (group?.teamIds ?? []).map(id => ({ _id: id, name: teamOf(id)?.name ?? 'Unknown team' }));
    const pairings = (groupTeams.length * (groupTeams.length - 1)) / 2;
    const canGenerate = !readOnly && ties?.length === 0 && groupTeams.length >= 2;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <SegTabs label="Group" value={groupId} onChange={setGroupId}
                    items={groups.map(g => ({ key: g._id, label: g.groupName, count: g._id === groupId && ties ? ties.length : tieCounts[g._id] }))} />
                <div className="flex flex-wrap gap-2">
                    {canGenerate && (
                        <button type="button" onClick={() => setConfirmGenerate(true)} className={BTN_SECONDARY}>
                            <Shuffle aria-hidden className="h-4 w-4" />Generate round robin
                        </button>
                    )}
                    {!readOnly && (
                        <button type="button" onClick={() => setAdding(true)} disabled={groupTeams.length < 2} className={BTN_SECONDARY}>
                            <Plus aria-hidden className="h-4 w-4" />Add tie
                        </button>
                    )}
                </div>
            </div>

            <section aria-label={`Ties in ${group?.groupName ?? 'group'}`} className={cn(PANEL, 'overflow-hidden')}>
                {confirmGenerate && canGenerate && (
                    <ConfirmBar
                        className="border-b border-t-0"
                        message={`Create all ${pairings} ties for ${group?.groupName}? Every team plays each other once.`}
                        confirmLabel="Generate"
                        onConfirm={generate}
                        onCancel={() => setConfirmGenerate(false)}
                        busy={generating}
                    />
                )}
                {ties === null ? <Spinner label="Loading ties" /> : ties.length === 0 ? (
                    <EmptyState title="No ties in this group yet" text="Add ties one at a time, or generate a full round robin." />
                ) : (
                    <>
                        <div className={cn(COLHEAD, 'hidden sm:grid', TIE_COLS)}>
                            <span>Tie</span><span>Status</span><span>Winner</span><span />
                        </div>
                        <ul className="divide-y divide-line">
                            {ties.map(tie => {
                                const [home, away] = sidesOf(tie);
                                const st = tieStatus(tie);
                                const winner = tie.winReason === 'draw' ? 'Draw'
                                    : tie.winnerId ? [home, away].find(s => s.id === String(tie.winnerId))?.name : null;
                                return (
                                    <li key={tie._id}>
                                        <button type="button" onClick={() => open(tie)}
                                            className={cn(ROW, TIE_COLS, 'w-full text-left transition-colors hover:bg-white/[0.025]', FOCUS, 'focus-visible:ring-inset')}>
                                            <span className="flex min-w-0 items-center gap-2.5">
                                                <span className="flex shrink-0 gap-0.5">
                                                    <TeamLogo size="sm" name={home.name} logo={home.logo} color={home.color} />
                                                    <TeamLogo size="sm" name={away.name} logo={away.logo} color={away.color} />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-medium text-fg">
                                                        {home.name} <span className="font-normal text-fg-subtle">vs</span> {away.name}
                                                    </span>
                                                    <span className="block truncate text-[13px] text-fg-subtle sm:hidden">
                                                        {st.label}{winner && winner !== 'Draw' ? ` · Won by ${winner}` : winner ? ' · Draw' : ''}
                                                    </span>
                                                </span>
                                            </span>
                                            <span className="hidden sm:block"><ToneBadge label={st.label} tone={st.tone} live={st.live} /></span>
                                            <span className="hidden truncate text-[13.5px] text-fg-muted sm:block">{winner ?? '—'}</span>
                                            <span className="flex items-center justify-end gap-0.5 text-[13px] font-medium text-fg-muted">
                                                Open<ChevronRight aria-hidden className="h-4 w-4" />
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </section>

            {adding && group && (
                <AddTieDialog
                    categoryId={categoryId}
                    group={group}
                    teams={groupTeams}
                    onClose={() => setAdding(false)}
                    onCreated={() => { setAdding(false); refreshTies(); onRefresh(); }}
                />
            )}

            {openTie && (() => {
                const d = detail?.tie?._id === openTie._id ? detail : null;
                const tie = d?.tie ?? openTie;
                const [home, away] = sidesOf(tie);
                const subMatches: any[] = d?.subMatches ?? openTie.subMatches ?? [];
                const wins = [home, away].map(s => subMatches.filter(m => m.status === 'completed' && String(m.winnerId) === s.id).length);
                const slots: any[] = categoryConfig?.subTeamSlots?.length ? categoryConfig.subTeamSlots : d?.subTeamSlots ?? [];
                const slotLabel = (m: any) => slots.find(s => s.slotNumber === m.subMatchSlotNumber)?.label || m.slotLabel || `Match ${m.subMatchSlotNumber}`;
                const lineupOf = (teamId: string) => (d?.lineups || []).find((l: any) => String(l.teamId) === teamId);

                return (
                    <Drawer wide title={`${home.name} vs ${away.name}`} onClose={closeTie}
                        description={`${group?.groupName ?? 'Group'} · ${wins[0]}–${wins[1]} in sub-matches`}>
                        <div className="grid gap-6">
                            {tieError && <Notice tone="red" icon={AlertCircle}><span role="alert">{tieError}</span></Notice>}
                            {!d ? (!tieError && <Spinner label="Loading tie" />) : <>
                                <section className="grid gap-3">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <h3 className="text-sm font-semibold text-fg">Lineups</h3>
                                        <span className="text-[12.5px] text-fg-subtle">Set before each sub-match starts</span>
                                    </div>
                                    <div className="grid gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-2">
                                        {[home, away].map(side => {
                                            const lineup = lineupOf(side.id);
                                            return (
                                                <div key={side.id} className="min-w-0 bg-panel">
                                                    <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                                                        <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-fg">
                                                            <TeamLogo size="sm" name={side.name} logo={side.logo} color={side.color} />
                                                            <span className="truncate">{side.name}</span>
                                                        </span>
                                                        {!readOnly && (
                                                            <button type="button" onClick={() => setLineupFor({ teamId: side.id, teamName: side.name })}
                                                                className={cn(BTN_SECONDARY, BTN_SM)}>
                                                                Edit lineup<span className="sr-only"> for {side.name}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    <ul className="divide-y divide-line">
                                                        {slots.map(s => {
                                                            const names = lineup?.assignments?.find((a: any) => a.slotNumber === s.slotNumber)?.playerNames?.filter(Boolean).join(' & ');
                                                            return (
                                                                <li key={s.slotNumber} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2.5 px-3.5 py-2.5 text-[13.5px]">
                                                                    <span className="text-[12.5px] text-fg-subtle">{s.label}</span>
                                                                    <span className={cn('truncate', names ? 'text-fg' : 'text-fg-subtle')}>{names || 'Not set'}</span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="grid gap-3">
                                    <h3 className="text-sm font-semibold text-fg">Sub-matches</h3>
                                    {subMatches.length === 0 ? <p className="text-[13px] text-fg-subtle">No sub-matches found.</p> : (
                                        <ul className={cn(PANEL, 'divide-y divide-line')}>
                                            {subMatches.map(m => {
                                                const label = slotLabel(m);
                                                const ready = m.player1?.teamId && m.player2?.teamId;
                                                const done = m.status === 'completed';
                                                const games = gameLine(m);
                                                const winner = [home, away].find(s => s.id === String(m.winnerId))?.name;
                                                return (
                                                    <li key={m._id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-fg">{label}</p>
                                                            <p className="text-[13px] text-fg-muted">{ready ? `${m.player1.name} vs ${m.player2.name}` : 'Waiting for lineups'}</p>
                                                            {done ? (
                                                                <p className="text-[13px] tabular-nums text-fg-subtle">Won by {winner ?? 'unknown'}{games && ` · ${games}`}</p>
                                                            ) : games && (
                                                                <p className="text-[13px] tabular-nums text-fg-subtle">Live · {games}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {done ? <ToneBadge {...MATCH_STATUS.completed} /> : ready && !readOnly ? <>
                                                                <button type="button" onClick={() => setLiveFor(m)} className={cn(BTN_SECONDARY, BTN_SM)}>
                                                                    <Radio aria-hidden className="h-3.5 w-3.5" />
                                                                    {m.status === 'in_progress' ? 'Continue live' : 'Score live'}<span className="sr-only"> for {label}</span>
                                                                </button>
                                                                <button type="button" onClick={() => setResultFor({ ...m, slotLabel: label })} className={cn(BTN_SECONDARY, BTN_SM)}>
                                                                    Enter result<span className="sr-only"> for {label}</span>
                                                                </button>
                                                            </> : <ToneBadge {...MATCH_STATUS.scheduled} />}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </section>

                                {tie.status !== 'completed' && !readOnly && (confirmDelete ? (
                                    <div className={cn(PANEL, 'overflow-hidden')}>
                                        <ConfirmBar className="border-t-0" danger message="Delete this tie and its sub-matches?"
                                            confirmLabel="Delete tie" cancelLabel="Keep tie" busy={deleting}
                                            onConfirm={deleteTie} onCancel={() => setConfirmDelete(false)} />
                                    </div>
                                ) : (
                                    <div>
                                        <button type="button" onClick={() => setConfirmDelete(true)} className={cn(BTN_DANGER, BTN_SM)}>
                                            <Trash2 aria-hidden className="h-3.5 w-3.5" />Delete tie
                                        </button>
                                    </div>
                                ))}
                            </>}
                        </div>

                        {lineupFor && (
                            <LineupAssignmentModal
                                tieId={openTie._id}
                                teamId={lineupFor.teamId}
                                teamName={lineupFor.teamName}
                                categoryConfig={{ subTeamSlots: slots }}
                                onClose={() => setLineupFor(null)}
                                onSaved={refreshTie}
                            />
                        )}
                        {resultFor && (
                            <SubMatchResultModal match={resultFor} onClose={() => setResultFor(null)} onSaved={refreshTie} />
                        )}
                        {liveFor && (
                            <BadmintonScoringConsole match={liveFor} onClose={() => setLiveFor(null)} onSaved={refreshTie} />
                        )}
                    </Drawer>
                );
            })()}
        </div>
    );
}

function AddTieDialog({ categoryId, group, teams, onClose, onCreated }: {
    categoryId: string; group: Group; teams: { _id: string; name: string }[]; onClose: () => void; onCreated: () => void;
}) {
    const [home, setHome] = useState('');
    const [away, setAway] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const create = async () => {
        if (!home || !away) { setError('Choose a home team and an away team.'); return; }
        setSaving(true);
        setError(null);
        try {
            await teamLeagueApi.createTie(group._id, categoryId, home, away);
            onCreated();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to create tie');
            setSaving(false);
        }
    };

    return (
        <Dialog title="Add tie" description={group.groupName} onClose={onClose}
            footer={<>
                {error && <p role="alert" className="mr-auto min-w-0 text-[13px] text-red-300">{error}</p>}
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" onClick={create} disabled={saving} className={BTN_PRIMARY}>
                    {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}Add tie
                </button>
            </>}>
            <div className="grid gap-4">
                <Field id="tie-home" label="Home team">
                    <select id="tie-home" value={home} className={INPUT}
                        onChange={e => { setHome(e.target.value); if (e.target.value === away) setAway(''); }}>
                        <option value="">Choose a team</option>
                        {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                </Field>
                <Field id="tie-away" label="Away team">
                    <select id="tie-away" value={away} onChange={e => setAway(e.target.value)} className={INPUT}>
                        <option value="">Choose a team</option>
                        {teams.filter(t => t._id !== home).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                </Field>
                <Notice tone="neutral" icon={Info}>
                    Or create every pairing at once with <b className="font-medium text-fg">Generate round robin</b>. That's only available while the group has no ties.
                </Notice>
            </div>
        </Dialog>
    );
}
