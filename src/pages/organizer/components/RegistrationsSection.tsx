import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, AlertTriangle, Check, Loader2, Shield, Star, UserMinus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    approveRegistration, bulkApproveRegistrations, fetchRegistrationsByTournament, fetchTournamentCategories,
    manualAssignPlayer, Registration, rejectRegistration, setCaptainRole, setIconRole, unassignRegistration,
} from '@/store/slices/registrationSlice';
import { fetchTournamentTeams, Team } from '@/store/slices/teamSlice';
import { cn } from '@/lib/utils';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS, inr, Tone, ToneBadge } from '../shared';
import {
    Avatar, CHOICE, COLHEAD, ConfirmBar, Dialog, EmptyState, Field, INPUT, INPUT_SM, MenuItem, MoreMenu, Notice,
    PageHead, PANEL, ROW, SearchInput, SegTabs, Spinner, TeamLogo, Toolbar, useReadOnly, useSectionNav,
} from '../ui';

type Reg = Registration & { createdAt?: string };
type Status = Registration['status'];

const REG_STATUS: Record<Status, { label: string; tone: Tone }> = {
    pending: { label: 'Pending review', tone: 'amber' },
    approved: { label: 'Approved', tone: 'green' },
    assigned: { label: 'Assigned', tone: 'blue' },
    auctioned: { label: 'Auctioned', tone: 'blue' },
    rejected: { label: 'Rejected', tone: 'red' },
    withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};
const TABS: { key: 'all' | Status; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' },
    { key: 'assigned', label: 'Assigned' }, { key: 'auctioned', label: 'Auctioned' }, { key: 'rejected', label: 'Rejected' },
    { key: 'withdrawn', label: 'Withdrawn' },
];
// Statuses where an organizer may manually assign/reassign the player to a team.
const ASSIGNABLE: Status[] = ['approved', 'assigned', 'auctioned'];
const NO_FILTERS = { q: '', categoryId: '', teamId: '', gender: '', skill: '' };

// Stacked rows on narrow containers, a full table from 1024px of content width.
// Phones: actions drop under the player. From 448px they sit on the right; from 1024px it's a full table.
const COLS = 'grid-cols-[20px_minmax(0,1fr)] @md:grid-cols-[20px_minmax(0,1fr)_auto] @5xl:grid-cols-[20px_minmax(0,1.4fr)_minmax(0,1.1fr)_9rem_5rem_8.5rem_minmax(0,1fr)_11rem]';
const WIDE = 'hidden @5xl:block';
const NARROW = '@5xl:hidden';
const CELL = 'min-w-0 truncate text-[13.5px] text-fg-muted';
const CHIP = 'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-px text-xs text-fg-muted ring-1 ring-inset ring-line';

const playerName = (r: Reg) => [r.profile?.firstName, r.profile?.lastName].filter(Boolean).join(' ') || 'Unnamed player';
const capital = (s?: string) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const errText = (p: unknown) => (typeof p === 'string' && p ? p : 'Check your connection and try again.');

export const RoleChip = ({ role }: { role?: string }) => {
    if (role !== 'captain' && role !== 'icon') return null;
    const Icon = role === 'captain' ? Shield : Star;
    return <span className={CHIP}><Icon aria-hidden className="h-3 w-3 text-primary" />{role === 'captain' ? 'Captain' : 'Icon player'}</span>;
};

const StatusBadge = ({ status }: { status: Status }) => {
    const s = REG_STATUS[status] ?? { label: status, tone: 'neutral' as Tone };
    return <ToneBadge label={s.label} tone={s.tone} />;
};

const RegistrationsSection = ({ tournamentId }: { tournamentId: string }) => {
    const dispatch = useAppDispatch();
    const readOnly = useReadOnly();
    const { tournamentRegistrations, categories } = useAppSelector(s => s.registration);
    const teams = useAppSelector(s => s.team.teams);
    const regs = tournamentRegistrations as Reg[];

    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [actionError, setActionError] = useState('');

    const [tab, setTab] = useState<'all' | Status>('all');
    const [f, setF] = useState(NO_FILTERS);
    const [moreOpen, setMoreOpen] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [confirm, setConfirm] = useState<{ kind: 'reject' | 'remove'; id: string } | null>(null);
    const [assignFor, setAssignFor] = useState<Reg | null>(null);
    const [roleFor, setRoleFor] = useState<{ reg: Reg; kind: 'captain' | 'icon' } | null>(null);

    // Per-row busy state; the ref blocks a second click landing before the re-render disables the button.
    const [busy, setBusy] = useState<string[]>([]);
    const inFlight = useRef(new Set<string>());
    const guard = async (key: string, fn: () => Promise<void>) => {
        if (inFlight.current.has(key)) return;
        inFlight.current.add(key);
        setBusy(b => [...b, key]);
        setActionError('');
        try { await fn(); } finally {
            inFlight.current.delete(key);
            setBusy(b => b.filter(k => k !== key));
        }
    };

    const load = () => {
        setLoaded(false);
        setLoadError('');
        const fail = (what: string) => (r: { meta: { requestStatus: string }; payload?: unknown }) => {
            if (r.meta.requestStatus === 'rejected') setLoadError(`Couldn't load ${what}. ${errText(r.payload)}`);
        };
        dispatch(fetchRegistrationsByTournament({ tournamentId })).then(r => { fail('registrations')(r); setLoaded(true); });
        dispatch(fetchTournamentCategories(tournamentId)).then(fail('categories'));
        dispatch(fetchTournamentTeams(tournamentId)).then(fail('teams'));
    };
    useEffect(load, [dispatch, tournamentId]);

    // Assignments, roles and removals move money and can carry a player over to another team,
    // so reload both lists instead of patching them locally.
    const refresh = () => {
        dispatch(fetchRegistrationsByTournament({ tournamentId }));
        dispatch(fetchTournamentTeams(tournamentId));
    };

    const teamOf = (r: Reg) => (r.teamId ? teams.find(t => t._id === r.teamId) : undefined);
    const categoryName = (r: Reg) => categories.find(c => c._id === r.categoryId)?.name || r.categoryDetails?.name || 'Unknown category';

    const q = f.q.trim().toLowerCase();
    const list = regs.filter(r =>
        (tab === 'all' || r.status === tab)
        && (!f.categoryId || r.categoryId === f.categoryId)
        && (!f.teamId || (f.teamId === 'none' ? !r.teamId : r.teamId === f.teamId))
        && (!f.gender || r.profile?.gender?.toLowerCase() === f.gender)
        && (!f.skill || r.profile?.skillLevel?.toLowerCase() === f.skill)
        && (!q || `${playerName(r)} ${r.profile?.phone ?? ''}`.toLowerCase().includes(q)));
    const filtering = tab !== 'all' || Object.values(f).some(Boolean);
    const clearFilters = () => { setTab('all'); setF(NO_FILTERS); };
    const setFilter = (k: keyof typeof NO_FILTERS) => (v: string) => setF(p => ({ ...p, [k]: v }));
    const count = (s: Status) => regs.filter(r => r.status === s).length;
    const showMore = moreOpen || !!f.gender || !!f.skill;

    const pendingIds = new Set(regs.filter(r => r.status === 'pending').map(r => r._id));
    const sel = selected.filter(id => pendingIds.has(id));
    const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

    const approve = (r: Reg) => guard(r._id, async () => {
        const res = await dispatch(approveRegistration(r._id));
        if (approveRegistration.rejected.match(res)) setActionError(`Couldn't approve ${playerName(r)}. ${errText(res.payload)}`);
    });
    const reject = (r: Reg) => guard(r._id, async () => {
        const res = await dispatch(rejectRegistration(r._id));
        setConfirm(null);
        if (rejectRegistration.rejected.match(res)) setActionError(`Couldn't reject ${playerName(r)}. ${errText(res.payload)}`);
    });
    const remove = (r: Reg) => guard(r._id, async () => {
        const res = await dispatch(unassignRegistration(r._id));
        setConfirm(null);
        if (unassignRegistration.rejected.match(res)) setActionError(`Couldn't remove ${playerName(r)} from the team. ${errText(res.payload)}`);
        else refresh();
    });
    const bulkApprove = () => guard('bulk', async () => {
        const res = await dispatch(bulkApproveRegistrations(sel));
        if (bulkApproveRegistrations.rejected.match(res)) {
            setActionError(`Couldn't approve the selected players. ${errText(res.payload)}`);
            return;
        }
        const { failed } = res.payload;
        setSelected(failed.map(x => x.id));
        if (failed.length) setActionError(`${failed.length} of ${sel.length} players couldn't be approved. ${failed[0].error}`);
    });

    const removeMessage = (r: Reg) => {
        const price = r.auctionData?.soldPrice;
        return [
            `Remove ${playerName(r)} from ${teamOf(r)?.name ?? 'their team'}?`,
            price ? `${inr(price)} goes back to the team's budget.` : '',
            r.role === 'captain' || r.role === 'icon' ? `Their ${r.role === 'icon' ? 'icon player' : 'captain'} role is cleared.` : '',
        ].filter(Boolean).join(' ');
    };

    const actions = (r: Reg) => {
        const rowBusy = busy.includes(r._id) || busy.includes('bulk');
        if (r.status === 'pending') return (
            <>
                <button type="button" onClick={() => approve(r)} disabled={rowBusy} aria-label={`Approve ${playerName(r)}`} className={cn(BTN_SECONDARY, BTN_SM)}>
                    {busy.includes(r._id) && confirm?.id !== r._id
                        ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                        : <Check aria-hidden className="h-3.5 w-3.5 text-emerald-400" />}
                    Approve
                </button>
                <button type="button" onClick={() => setConfirm({ kind: 'reject', id: r._id })} disabled={rowBusy} aria-label={`Reject ${playerName(r)}`} className={cn(BTN_GHOST, BTN_SM)}>Reject</button>
            </>
        );
        if (!ASSIGNABLE.includes(r.status)) return null;
        const menu: MenuItem[] = [
            ...(r.role !== 'captain' ? [{ label: 'Make captain', icon: Shield, onSelect: () => setRoleFor({ reg: r, kind: 'captain' }) }] : []),
            ...(r.role !== 'icon' ? [{ label: 'Make icon player', icon: Star, onSelect: () => setRoleFor({ reg: r, kind: 'icon' }) }] : []),
            ...(r.teamId ? ['separator' as const, { label: 'Remove from team', icon: UserMinus, danger: true, onSelect: () => setConfirm({ kind: 'remove', id: r._id }) }] : []),
        ];
        return (
            <>
                <button type="button" onClick={() => setAssignFor(r)} disabled={rowBusy} className={cn(BTN_SECONDARY, BTN_SM)}>
                    {busy.includes(r._id) && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
                    {r.teamId ? 'Reassign' : 'Assign to team'}
                </button>
                <MoreMenu items={menu} label={`More actions for ${playerName(r)}`} />
            </>
        );
    };

    const row = (r: Reg) => {
        const name = playerName(r);
        const team = teamOf(r);
        const price = r.auctionData?.soldPrice;
        const rowBusy = busy.includes(r._id);
        const acts = readOnly ? null : actions(r);
        return (
            <li key={r._id} aria-label={name}>
                <div className={cn(ROW, COLS, 'gap-x-3.5')}>
                    {r.status === 'pending' && !readOnly
                        ? <input type="checkbox" aria-label={`Select ${name}`} checked={sel.includes(r._id)} disabled={rowBusy}
                            onChange={() => toggle(r._id)} className={cn('h-4 w-4 accent-primary', FOCUS)} />
                        : <span />}
                    <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={name} size="lg" />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-fg">{name}</p>
                            <p className="mt-0.5 truncate text-[13px] text-fg-subtle">
                                {r.profile?.phone}<span className={NARROW}> · {categoryName(r)}</span>
                            </p>
                            <div className={cn('mt-1.5 flex flex-wrap items-center gap-1.5', NARROW)}>
                                <StatusBadge status={r.status} />
                                {r.teamId && <span className={CHIP}>{team?.name ?? 'Unknown team'}</span>}
                                <RoleChip role={r.role} />
                            </div>
                        </div>
                    </div>
                    <span className={cn(WIDE, CELL)}>{categoryName(r)}</span>
                    <span className={cn(WIDE, CELL)}>
                        {[capital(r.profile?.gender), r.profile?.age].filter(Boolean).join(', ') || '—'}
                        <small className="block text-xs text-fg-subtle">{capital(r.profile?.skillLevel)}</small>
                    </span>
                    <span className={cn(WIDE, CELL, 'tabular-nums')}>{r.createdAt ? format(new Date(r.createdAt), 'd MMM') : '—'}</span>
                    <span className={WIDE}><StatusBadge status={r.status} /></span>
                    <div className={cn(WIDE, 'min-w-0')}>
                        {r.teamId ? (
                            <div className="flex min-w-0 items-center gap-2">
                                <TeamLogo name={team?.name ?? '?'} logo={team?.logo} color={team?.primaryColor} size="sm" />
                                <div className="min-w-0">
                                    <span className="block truncate text-[13.5px] text-fg">{team?.name ?? 'Unknown team'}</span>
                                    <small className="block text-xs text-fg-subtle">{price ? inr(price) : r.role === 'captain' || r.role === 'icon' ? '' : 'No price'}</small>
                                </div>
                            </div>
                        ) : <span className="text-fg-subtle">—</span>}
                        {(r.role === 'captain' || r.role === 'icon') && <div className="mt-1"><RoleChip role={r.role} /></div>}
                    </div>
                    {acts && <div className="col-start-2 flex flex-wrap items-center gap-1.5 pl-[46px] @md:col-start-auto @md:justify-end @md:pl-0">{acts}</div>}
                </div>
                {confirm?.id === r._id && (confirm.kind === 'reject' ? (
                    <ConfirmBar message={`Reject ${name}? Their entry will show as rejected, and this can't be undone.`}
                        confirmLabel="Reject" danger busy={rowBusy} onConfirm={() => reject(r)} onCancel={() => setConfirm(null)} />
                ) : (
                    <ConfirmBar message={removeMessage(r)} confirmLabel="Remove" danger busy={rowBusy}
                        onConfirm={() => remove(r)} onCancel={() => setConfirm(null)} />
                ))}
            </li>
        );
    };

    const body = () => {
        if (!loaded) return <Spinner label="Loading registrations" />;
        if (loadError && !regs.length) return (
            <EmptyState title="Something didn't load" text={loadError}
                action={<button type="button" onClick={load} className={BTN_SECONDARY}>Try again</button>} />
        );
        if (!regs.length) return <EmptyState title="No registrations yet" text="Players who sign up for a category show up here for review." />;
        if (!list.length) return (
            <EmptyState title="No registrations match these filters" text="Try another status, or clear the search."
                action={<button type="button" onClick={clearFilters} className={BTN_SECONDARY}>Clear filters</button>} />
        );
        return (
            <>
                <div aria-hidden className={cn(COLHEAD, COLS, 'hidden @5xl:grid')}>
                    <span /><span>Player</span><span>Category</span><span>Details</span><span>Applied</span><span>Status</span><span>Team</span><span />
                </div>
                <ul className="divide-y divide-line">{list.map(row)}</ul>
            </>
        );
    };

    return (
        <div className="@container space-y-6">
            <PageHead title="Registrations" desc="Review entries, approve players and place them on teams." />

            {loadError && regs.length > 0 && (
                <Notice tone="red" icon={AlertCircle}>
                    <span role="alert">{loadError}</span>{' '}
                    <button type="button" onClick={load} className={cn('underline underline-offset-2', FOCUS)}>Try again</button>
                </Notice>
            )}
            {actionError && <Notice tone="red" icon={AlertCircle}><span role="alert">{actionError}</span></Notice>}

            <section aria-label="Registrations" className={cn(PANEL, 'overflow-hidden')}>
                {loaded && regs.length > 0 && (
                    <Toolbar>
                        <SegTabs<'all' | Status> label="Status" value={tab} onChange={setTab}
                            items={TABS.map(t => ({ ...t, count: t.key === 'all' ? regs.length : count(t.key), hot: t.key === 'pending' }))} />
                        <div className="flex flex-wrap items-center gap-2">
                            <SearchInput label="Search registrations" placeholder="Search name or phone" value={f.q} onChange={setFilter('q')} className="min-w-full sm:min-w-0" />
                            <label>
                                <span className="sr-only">Category</span>
                                <select value={f.categoryId} onChange={e => setFilter('categoryId')(e.target.value)} className={INPUT_SM}>
                                    <option value="">All categories</option>
                                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </label>
                            <label>
                                <span className="sr-only">Team</span>
                                <select value={f.teamId} onChange={e => setFilter('teamId')(e.target.value)} className={INPUT_SM}>
                                    <option value="">All teams</option>
                                    <option value="none">No team</option>
                                    {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                </select>
                            </label>
                            {showMore ? (
                                <>
                                    <label>
                                        <span className="sr-only">Gender</span>
                                        <select value={f.gender} onChange={e => setFilter('gender')(e.target.value)} className={INPUT_SM}>
                                            <option value="">All genders</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                        </select>
                                    </label>
                                    <label>
                                        <span className="sr-only">Skill level</span>
                                        <select value={f.skill} onChange={e => setFilter('skill')(e.target.value)} className={INPUT_SM}>
                                            <option value="">All skill levels</option>
                                            {['beginner', 'intermediate', 'advanced', 'professional'].map(s => <option key={s} value={s}>{capital(s)}</option>)}
                                        </select>
                                    </label>
                                </>
                            ) : (
                                <button type="button" onClick={() => setMoreOpen(true)} className={cn(BTN_GHOST, BTN_SM)}>More filters</button>
                            )}
                            {filtering && <button type="button" onClick={clearFilters} className={cn(BTN_GHOST, BTN_SM)}>Clear filters</button>}
                            <span className="text-xs tabular-nums text-fg-subtle">{list.length} of {regs.length}</span>
                        </div>
                    </Toolbar>
                )}
                {sel.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-primary/[0.06] px-4 py-2.5 text-[13px] sm:px-5">
                        <span className="font-medium text-fg">{sel.length} selected</span>
                        <button type="button" onClick={bulkApprove} disabled={busy.includes('bulk')} className={cn(BTN_SECONDARY, BTN_SM)}>
                            {busy.includes('bulk')
                                ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                                : <Check aria-hidden className="h-3.5 w-3.5 text-emerald-400" />}
                            Approve selected
                        </button>
                        <button type="button" onClick={() => setSelected([])} className={cn(BTN_GHOST, BTN_SM)}>Clear</button>
                    </div>
                )}
                {body()}
            </section>

            {assignFor && (
                <AssignDialog reg={assignFor} teams={teams} onClose={() => setAssignFor(null)}
                    onDone={() => { setAssignFor(null); refresh(); }} />
            )}
            {roleFor && (
                <RoleDialog {...roleFor} teams={teams} tournamentId={tournamentId} categoryName={categoryName(roleFor.reg)}
                    onClose={() => setRoleFor(null)} onDone={() => { setRoleFor(null); refresh(); }} />
            )}
        </div>
    );
};

const AssignDialog = ({ reg, teams, onClose, onDone }: { reg: Reg; teams: Team[]; onClose: () => void; onDone: () => void }) => {
    const dispatch = useAppDispatch();
    const goTo = useSectionNav();
    const [teamId, setTeamId] = useState(reg.teamId || '');
    const [price, setPrice] = useState(reg.auctionData?.soldPrice ? String(reg.auctionData.soldPrice) : '');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const name = playerName(reg);
    const team = teams.find(t => t._id === teamId);

    const submit = async () => {
        if (!teamId) return setError('Choose a team.');
        const soldPrice = price === '' ? undefined : Number(price);
        if (soldPrice !== undefined && !(Number.isInteger(soldPrice) && soldPrice >= 0)) {
            return setError('Enter the price in whole rupees, or leave it empty.');
        }
        setBusy(true);
        setError('');
        const res = await dispatch(manualAssignPlayer({ registrationId: reg._id, teamId, soldPrice }));
        setBusy(false);
        if (manualAssignPlayer.rejected.match(res)) setError(`Couldn't assign ${name}. ${errText(res.payload)}`);
        else onDone();
    };

    return (
        <Dialog title={reg.teamId ? `Reassign ${name}` : `Assign ${name}`} onClose={onClose}
            footer={<>
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" onClick={submit} disabled={busy || !teams.length} className={BTN_PRIMARY}>
                    {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}{reg.teamId ? 'Reassign' : 'Assign player'}
                </button>
            </>}>
            {teams.length ? (
                <div className="grid gap-4">
                    <Field label="Team">
                        <div role="radiogroup" aria-label="Team" className="grid gap-2">
                            {teams.map(t => (
                                <label key={t._id} className={cn(CHOICE, 'items-center')}>
                                    <input type="radio" name="assign-team" checked={teamId === t._id} onChange={() => setTeamId(t._id)}
                                        className={cn('accent-primary', FOCUS)} />
                                    <TeamLogo name={t.name} logo={t.logo} color={t.primaryColor} />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-fg">{t.name}</span>
                                        <span className="block truncate text-[12.5px] text-fg-muted">{t.owner?.name}</span>
                                    </span>
                                    <span className={cn('ml-auto shrink-0 text-right text-[13px] tabular-nums', t.budget < 0 ? 'text-red-300' : 'text-fg-muted')}>
                                        {inr(t.budget)}<span className="block text-xs text-fg-subtle">left</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </Field>
                    <Field id="assign-price" label="Price" help="Taken from the team's budget. Leave empty to assign for free.">
                        <div className="relative">
                            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">₹</span>
                            <input id="assign-price" type="number" min={0} step={1} inputMode="numeric" placeholder="0"
                                value={price} onChange={e => setPrice(e.target.value)} className={cn(INPUT, 'pl-7')} />
                        </div>
                    </Field>
                    {team && team.budget < 0 && (
                        <Notice tone="amber" icon={AlertTriangle}>
                            {team.name} is already {inr(-team.budget)} over budget. Assigning more players with a price takes it further below zero.
                        </Notice>
                    )}
                    {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}
                </div>
            ) : (
                <Notice tone="neutral" icon={AlertCircle}>
                    There are no teams yet. Add teams first, then assign players.{' '}
                    <button type="button" onClick={() => { onClose(); goTo('teams'); }} className={cn('underline underline-offset-2', FOCUS)}>Go to Teams</button>
                </Notice>
            )}
        </Dialog>
    );
};

const RoleDialog = ({ reg, kind, teams, tournamentId, categoryName, onClose, onDone }: {
    reg: Reg; kind: 'captain' | 'icon'; teams: Team[]; tournamentId: string; categoryName: string; onClose: () => void; onDone: () => void;
}) => {
    const dispatch = useAppDispatch();
    const [teamId, setTeamId] = useState(reg.teamId || '');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const name = playerName(reg);
    const captain = kind === 'captain';

    const submit = async () => {
        if (!teamId) return setError('Choose a team.');
        setBusy(true);
        setError('');
        const res = captain
            ? await dispatch(setCaptainRole({ tournamentId, playerId: reg.playerId, teamId }))
            : await dispatch(setIconRole({ registrationId: reg._id, teamId }));
        setBusy(false);
        if (res.meta.requestStatus === 'rejected') setError(`Couldn't make ${name} ${captain ? 'captain' : 'an icon player'}. ${errText(res.payload)}`);
        else onDone();
    };

    return (
        <Dialog title={captain ? `Make ${name} captain` : `Make ${name} an icon player`} onClose={onClose}
            footer={<>
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" onClick={submit} disabled={busy} className={BTN_PRIMARY}>
                    {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}{captain ? 'Make captain' : 'Make icon player'}
                </button>
            </>}>
            <div className="grid gap-4">
                <p className="text-[13.5px] leading-relaxed text-fg-muted">
                    {captain
                        ? `${name} becomes captain of the team you choose, in every category they've entered in this tournament. They won't go to auction.`
                        : `${name} becomes the icon player for the team you choose, in ${categoryName} only. They won't go to auction.`}
                </p>
                <Field id="role-team" label="Team">
                    <select id="role-team" value={teamId} onChange={e => setTeamId(e.target.value)} className={INPUT}>
                        <option value="">Choose a team</option>
                        {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                </Field>
                {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}
            </div>
        </Dialog>
    );
};

export default RegistrationsSection;
