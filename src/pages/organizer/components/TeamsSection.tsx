import { ChangeEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, ExternalLink, Loader2, Mail, MessageCircle, Pencil, Phone, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    clearTeams, createTeam, deleteTeam, fetchTournamentTeams, resetTeamBudget, Team, updateTeam, updateTeamBudget,
} from '@/store/slices/teamSlice';
import { fetchRegistrationsByTournament, Registration } from '@/store/slices/registrationSlice';
import { uploadImage } from '@/api/upload';
import { cn } from '@/lib/utils';
import { BTN_DANGER_SOLID, BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS, inr } from '../shared';
import { Avatar, Drawer, EmptyState, Field, FormGroup, INPUT, MoreMenu, Notice, PageHead, PANEL, Spinner, TeamLogo, useSectionNav } from '../ui';
import { RoleChip } from './RegistrationsSection';

interface TeamsSectionProps {
    tournamentId: string;
    defaultBudget: number;
}

type View = { kind: 'detail'; id: string } | { kind: 'form'; id?: string } | null;

const errText = (p: unknown) => (typeof p === 'string' && p ? p : 'Check your connection and try again.');
const playerName = (r: Registration) => [r.profile?.firstName, r.profile?.lastName].filter(Boolean).join(' ') || 'Unnamed player';
const playerCount = (roster: Registration[]) => {
    const n = new Set(roster.map(r => r.playerId)).size;
    return `${n} player${n === 1 ? '' : 's'}`;
};

/** Remaining budget, a spend bar and the spent/starting line. Negative budgets read as "−₹…", not just red. */
const Budget = ({ team, label, startLabel }: { team: Team; label: string; startLabel: (n: string) => string }) => {
    const initial = team.initialBudget || 0, left = team.budget || 0, spent = initial - left;
    const pct = left < 0 ? 100 : initial ? Math.min(100, Math.max(0, (spent / initial) * 100)) : 0;
    return (
        <span className="grid gap-1.5">
            <span className="flex justify-between gap-3 text-[13px] tabular-nums text-fg-muted">
                <span>{label}</span><b className={cn('font-semibold', left < 0 ? 'text-red-300' : 'text-fg')}>{inr(left)}</b>
            </span>
            <span role="img" aria-label={left < 0 ? 'Over budget' : `${Math.round(pct)}% of budget spent`} className="block h-1.5 overflow-hidden rounded-full bg-line">
                <span className={cn('block h-full rounded-full', left < 0 ? 'bg-red-400' : 'bg-fg-subtle')} style={{ width: `${pct}%` }} />
            </span>
            <span className="flex justify-between gap-3 text-xs tabular-nums text-fg-muted">
                <span>Spent {inr(spent)}</span><span>{startLabel(inr(initial))}</span>
            </span>
        </span>
    );
};

const TeamsSection = ({ tournamentId, defaultBudget }: TeamsSectionProps) => {
    const dispatch = useAppDispatch();
    const teams = useAppSelector(s => s.team.teams);
    const maxTeams = useAppSelector(s => s.tournament.currentTournament?.settings?.maxTeams);
    const { tournamentRegistrations: regs, categories } = useAppSelector(s => s.registration);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [view, setView] = useState<View>(null);

    const load = () => {
        setLoaded(false);
        setLoadError('');
        dispatch(fetchTournamentTeams(tournamentId)).then(r => {
            if (fetchTournamentTeams.rejected.match(r)) setLoadError(errText(r.payload));
            setLoaded(true);
        });
    };
    useEffect(() => {
        load();
        dispatch(fetchRegistrationsByTournament({ tournamentId })); // rosters; without it cards just show 0 players
        return () => { dispatch(clearTeams()); };
    }, [dispatch, tournamentId]);

    const rosterOf = (teamId: string) => regs.filter(r => r.teamId === teamId);
    const categoryName = (id: string) => categories.find(c => c._id === id)?.name ?? '';
    const current = view && view.id ? teams.find(t => t._id === view.id) : undefined;

    const body = () => {
        if (!loaded && !teams.length) return <Spinner label="Loading teams" />;
        if (loadError && !teams.length) return (
            <div className={PANEL}>
                <EmptyState title="Teams didn't load" text={loadError}
                    action={<button type="button" onClick={load} className={BTN_SECONDARY}>Try again</button>} />
            </div>
        );
        if (!teams.length) return (
            <div className={PANEL}>
                <EmptyState title="No teams yet" text="Add the teams taking part, with their owners and auction budgets."
                    action={<button type="button" onClick={() => setView({ kind: 'form' })} className={BTN_PRIMARY}><Plus aria-hidden className="h-4 w-4" />Add team</button>} />
            </div>
        );
        return (
            <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
                {teams.map(team => {
                    const roster = rosterOf(team._id);
                    const captain = roster.find(r => r.role === 'captain');
                    return (
                        <button key={team._id} type="button" onClick={() => setView({ kind: 'detail', id: team._id })}
                            className={cn('flex w-full flex-col gap-3.5 rounded-xl bg-panel p-4 text-left ring-1 ring-inset ring-line transition-shadow hover:ring-white/15', FOCUS)}>
                            <span className="flex w-full items-center gap-3">
                                <TeamLogo name={team.name} logo={team.logo} color={team.primaryColor} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[15px] font-semibold text-fg">{team.name}</span>
                                    <span className="mt-0.5 block truncate text-[13px] text-fg-subtle">Owner: {team.owner?.name}</span>
                                </span>
                            </span>
                            <span className="text-[13px] text-fg-muted">
                                {playerCount(roster)}{captain ? ` · Captain: ${playerName(captain)}` : ' · No captain yet'}
                            </span>
                            <Budget team={team} label="Remaining" startLabel={n => `of ${n}`} />
                            <span className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-fg-subtle">
                                {team.owner?.phone && <span className="inline-flex items-center gap-1.5"><Phone aria-hidden className="h-3.5 w-3.5" />{team.owner.phone}</span>}
                                {team.owner?.email && <span className="inline-flex items-center gap-1.5"><Mail aria-hidden className="h-3.5 w-3.5" />Email</span>}
                                {team.whatsappGroupLink && <span className="inline-flex items-center gap-1.5"><MessageCircle aria-hidden className="h-3.5 w-3.5" />WhatsApp group</span>}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="@container space-y-6">
            <PageHead title="Teams" desc="Teams, their owners and auction budgets. Open a team to see its roster."
                actions={<>
                    <span className="text-[13px] text-fg-subtle">{maxTeams ? `${teams.length} of ${maxTeams} teams` : `${teams.length} teams`}</span>
                    <button type="button" onClick={() => setView({ kind: 'form' })} className={BTN_PRIMARY}><Plus aria-hidden className="h-4 w-4" />Add team</button>
                </>} />
            {loadError && teams.length > 0 && (
                <Notice tone="red" icon={AlertCircle}>
                    <span role="alert">Couldn't refresh the teams. {loadError}</span>{' '}
                    <button type="button" onClick={load} className={cn('underline underline-offset-2', FOCUS)}>Try again</button>
                </Notice>
            )}
            {body()}

            {view?.kind === 'detail' && current && (
                <TeamDrawer team={current} roster={rosterOf(current._id)} categoryName={categoryName}
                    onClose={() => setView(null)} onEdit={() => setView({ kind: 'form', id: current._id })} />
            )}
            {view?.kind === 'form' && (
                <TeamForm tournamentId={tournamentId} defaultBudget={defaultBudget} team={current}
                    onClose={() => setView(current ? { kind: 'detail', id: current._id } : null)}
                    onSaved={id => setView(current ? { kind: 'detail', id } : null)} />
            )}
        </div>
    );
};

const TeamDrawer = ({ team, roster, categoryName, onClose, onEdit }: {
    team: Team; roster: Registration[]; categoryName: (id: string) => string; onClose: () => void; onEdit: () => void;
}) => {
    const dispatch = useAppDispatch();
    const goTo = useSectionNav();
    const isStaff = useAppSelector(s => s.auth.user?.role === 'staff');
    const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const run = async (kind: 'reset' | 'delete') => {
        setBusy(true);
        setError('');
        const res = kind === 'reset' ? await dispatch(resetTeamBudget(team._id)) : await dispatch(deleteTeam(team._id));
        setBusy(false);
        if (res.meta.requestStatus === 'rejected') {
            setError(`Couldn't ${kind === 'reset' ? 'reset the budget' : 'delete the team'}. ${errText(res.payload)}`);
            return;
        }
        setConfirm(null);
        if (kind === 'delete') onClose();
    };

    const contact: [string, ReactNode][] = [
        ['Phone', team.owner?.phone || '—'],
        ['Email', team.owner?.email || '—'],
        ['WhatsApp group', team.whatsappGroupLink ? (
            <a href={team.whatsappGroupLink} target="_blank" rel="noopener noreferrer"
                className={cn('inline-flex items-center gap-1 rounded text-fg-muted hover:text-fg', FOCUS)}>
                Open link<ExternalLink aria-hidden className="h-3.5 w-3.5" /><span className="sr-only">(opens in a new tab)</span>
            </a>
        ) : '—'],
    ];

    return (
        <Drawer title={team.name} description={`Owner: ${team.owner?.name} · ${team.owner?.phone}`} onClose={onClose}
            footer={<>
                <div className="mr-auto">
                    <MoreMenu side="top" label="More team actions" items={[
                        { label: 'Reset budget', icon: RotateCcw, onSelect: () => setConfirm('reset') },
                        ...(isStaff ? [] : ['separator' as const, { label: 'Delete team', icon: Trash2, danger: true, onSelect: () => setConfirm('delete') }]),
                    ]} />
                </div>
                <button type="button" onClick={onEdit} className={BTN_SECONDARY}><Pencil aria-hidden className="h-4 w-4" />Edit team</button>
            </>}>
            <div className="grid gap-6">
                <section className="grid gap-3">
                    <div className="flex items-center gap-3.5">
                        <TeamLogo name={team.name} logo={team.logo} color={team.primaryColor} size="lg" />
                        <div className="flex-1"><Budget team={team} label="Remaining budget" startLabel={n => `Starting budget ${n}`} /></div>
                    </div>
                    {team.budget < 0 && (
                        <Notice tone="red" icon={AlertCircle}>This team is over budget. A manual assignment pushed it below zero.</Notice>
                    )}
                </section>

                <section className="grid gap-3 border-t border-line pt-5">
                    <h3 className="text-sm font-semibold text-fg">Roster <span className="font-normal text-fg-subtle">{new Set(roster.map(r => r.playerId)).size}</span></h3>
                    {roster.length ? (
                        <ul className={cn(PANEL, 'divide-y divide-line')}>
                            {roster.map(r => (
                                <li key={r._id} className="flex items-center gap-2.5 px-4 py-2.5">
                                    <Avatar name={playerName(r)} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-fg">{playerName(r)}</p>
                                        <p className="truncate text-[13px] text-fg-subtle">{categoryName(r.categoryId)}</p>
                                    </div>
                                    {r.role === 'captain' || r.role === 'icon'
                                        ? <RoleChip role={r.role} />
                                        : <span className="text-[13.5px] tabular-nums text-fg-muted">{inr(r.auctionData?.soldPrice || 0)}</span>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-[13.5px] text-fg-muted">
                            No players yet. Assign players from{' '}
                            <button type="button" onClick={() => { onClose(); goTo('registrations'); }} className={cn('rounded underline underline-offset-2 hover:text-fg', FOCUS)}>Registrations</button>
                            {' '}or the auction.
                        </p>
                    )}
                </section>

                <section className="grid gap-3 border-t border-line pt-5">
                    <h3 className="text-sm font-semibold text-fg">Contact</h3>
                    <dl className="grid gap-1.5 text-[13.5px]">
                        {contact.map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-4"><dt className="text-fg-muted">{k}</dt><dd className="min-w-0 truncate text-fg">{v}</dd></div>
                        ))}
                    </dl>
                </section>

                {confirm === 'reset' && (
                    <Notice tone="amber" icon={AlertTriangle}>
                        <span role="alertdialog" aria-label="Reset budget">
                            Reset the budget to {inr(team.initialBudget || 0)}? Players stay on the team, so spending will show as zero even though they were bought.
                        </span>
                        <span className="mt-2 flex gap-2">
                            <button type="button" autoFocus onClick={() => setConfirm(null)} disabled={busy} className={cn(BTN_SECONDARY, BTN_SM)}>Keep budget</button>
                            <button type="button" onClick={() => run('reset')} disabled={busy} className={cn(BTN_PRIMARY, BTN_SM)}>
                                {busy && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}Reset budget
                            </button>
                        </span>
                    </Notice>
                )}
                {confirm === 'delete' && (
                    <Notice tone="red" icon={AlertTriangle}>
                        <span role="alertdialog" aria-label="Delete team">
                            Delete {team.name}? Its {playerCount(roster)} lose their team. Only the tournament organizer can do this.
                        </span>
                        <span className="mt-2 flex gap-2">
                            <button type="button" autoFocus onClick={() => setConfirm(null)} disabled={busy} className={cn(BTN_SECONDARY, BTN_SM)}>Keep team</button>
                            <button type="button" onClick={() => run('delete')} disabled={busy} className={cn(BTN_DANGER_SOLID, BTN_SM)}>
                                {busy && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}Delete team
                            </button>
                        </span>
                    </Notice>
                )}
                {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}
            </div>
        </Drawer>
    );
};

type Form = {
    name: string; logo: string; primaryColor: string; secondaryColor: string;
    ownerName: string; ownerPhone: string; ownerEmail: string; whatsappGroupLink: string; budget: string;
};
const HEX = /^#[0-9a-f]{6}$/i;

const TeamForm = ({ tournamentId, defaultBudget, team, onClose, onSaved }: {
    tournamentId: string; defaultBudget: number; team?: Team; onClose: () => void; onSaved: (id: string) => void;
}) => {
    const dispatch = useAppDispatch();
    const [f, setF] = useState<Form>({
        name: team?.name ?? '', logo: team?.logo ?? '',
        primaryColor: team?.primaryColor || '#F97316', secondaryColor: team?.secondaryColor || '#0A0A0B',
        ownerName: team?.owner?.name ?? '', ownerPhone: team?.owner?.phone ?? '', ownerEmail: team?.owner?.email ?? '',
        whatsappGroupLink: team?.whatsappGroupLink ?? '', budget: String(team ? team.budget ?? 0 : defaultBudget),
    });
    const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);
    const formId = useId();

    const set = (k: keyof Form) => (v: string) => {
        setF(p => ({ ...p, [k]: v }));
        setErrors(e => ({ ...e, [k]: undefined }));
    };
    const bind = (k: keyof Form) => ({ id: `team-${k}`, value: f[k], onChange: (e: ChangeEvent<HTMLInputElement>) => set(k)(e.target.value) });

    const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setUploadError('');
        try {
            set('logo')(await uploadImage(file, 'team-logos'));
        } catch {
            setUploadError("The logo didn't upload. Check it's a PNG, JPG or GIF and try again.");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const validate = () => {
        const budget = Number(f.budget);
        const next: Partial<Record<keyof Form, string>> = {
            name: f.name.trim() ? undefined : 'Enter a team name.',
            ownerName: f.ownerName.trim() ? undefined : "Enter the owner's name.",
            ownerPhone: f.ownerPhone.trim() ? undefined : "Enter the owner's phone number.",
            ownerEmail: !f.ownerEmail.trim() || /^\S+@\S+\.\S+$/.test(f.ownerEmail.trim()) ? undefined : 'Enter a valid email address, or leave it empty.',
            primaryColor: HEX.test(f.primaryColor) ? undefined : 'Use a hex colour like #F97316.',
            secondaryColor: HEX.test(f.secondaryColor) ? undefined : 'Use a hex colour like #0A0A0B.',
            budget: f.budget !== '' && Number.isInteger(budget) && budget >= 0 ? undefined : 'Enter a whole rupee amount of 0 or more.',
        };
        setErrors(next);
        return Object.values(next).every(v => !v);
    };

    const save = async () => {
        if (!validate()) return;
        setBusy(true);
        setError('');
        // The server rejects empty strings for these optional fields (422), so leave them out when blank.
        // Omitting logo or WhatsApp link on edit keeps the saved value: the API has no way to clear them.
        const blank = (v: string) => v.trim() || undefined;
        const data = {
            name: f.name.trim(), logo: blank(f.logo),
            primaryColor: f.primaryColor, secondaryColor: f.secondaryColor,
            owner: { name: f.ownerName.trim(), phone: f.ownerPhone.trim(), email: blank(f.ownerEmail) },
            whatsappGroupLink: blank(f.whatsappGroupLink),
        };
        const budget = Number(f.budget);
        let failure: unknown = null;
        if (team) {
            const res = await dispatch(updateTeam({ id: team._id, data }));
            if (updateTeam.rejected.match(res)) failure = res.payload;
            else if (team.budget !== budget) {
                const b = await dispatch(updateTeamBudget({ id: team._id, amount: budget }));
                if (updateTeamBudget.rejected.match(b)) failure = `Details were saved, but the budget wasn't. ${errText(b.payload)}`;
            }
        } else {
            const res = await dispatch(createTeam({ tournamentId, teamData: { ...data, initialBudget: budget, budget } }));
            if (createTeam.rejected.match(res)) failure = res.payload;
            else { setBusy(false); return onSaved(res.payload?._id); }
        }
        setBusy(false);
        if (failure !== null) setError(team ? `Couldn't save ${team.name}. ${errText(failure)}` : `Couldn't create the team. ${errText(failure)}`);
        else onSaved(team._id);
    };

    const colour = (k: 'primaryColor' | 'secondaryColor', label: string) => (
        <Field label={label} error={errors[k]}>
            <span className="flex items-center gap-2">
                <input type="color" aria-label={label} value={HEX.test(f[k]) ? f[k] : '#000000'} onChange={e => set(k)(e.target.value)}
                    className={cn('h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-line bg-canvas p-0.5', FOCUS)} />
                <input aria-label={`${label} hex`} maxLength={7} value={f[k]} onChange={e => set(k)(e.target.value)} className={cn(INPUT, 'font-mono')} />
            </span>
        </Field>
    );

    return (
        <Drawer title={team ? `Edit ${team.name}` : 'Add team'}
            description={team ? undefined : 'Captains and icon players are added from Registrations after the team exists.'}
            onClose={onClose}
            footer={<>
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="submit" form={formId} disabled={busy || uploading} className={BTN_PRIMARY}>
                    {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}{team ? 'Save changes' : 'Create team'}
                </button>
            </>}>
            <form id={formId} className="grid gap-5" noValidate onSubmit={e => { e.preventDefault(); save(); }}>
                <FormGroup title="Team">
                    <Field id="team-name" label="Team name" error={errors.name}>
                        <input {...bind('name')} maxLength={100} placeholder="e.g. Smash Kings" aria-invalid={!!errors.name} className={INPUT} />
                    </Field>
                    <Field label="Logo" error={uploadError}
                        help={team?.logo && !f.logo ? "A saved logo can't be removed yet, so the current one stays. Upload a new image to replace it." : 'PNG, JPG or GIF. Optional.'}>
                        <span className="flex items-center gap-3">
                            {f.logo
                                ? <TeamLogo name={f.name || '?'} logo={f.logo} size="lg" />
                                : <span aria-hidden className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-raised text-fg-subtle">—</span>}
                            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={onFile} />
                            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={cn(BTN_SECONDARY, BTN_SM)}>
                                {uploading ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Upload aria-hidden className="h-3.5 w-3.5" />}
                                {uploading ? 'Uploading…' : f.logo ? 'Replace image' : 'Upload image'}
                            </button>
                            {f.logo && <button type="button" onClick={() => set('logo')('')} className={cn(BTN_GHOST, BTN_SM)}>Remove</button>}
                        </span>
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {colour('primaryColor', 'Primary colour')}
                        {colour('secondaryColor', 'Secondary colour')}
                    </div>
                </FormGroup>

                <FormGroup title="Owner">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field id="team-ownerName" label="Owner name" error={errors.ownerName}>
                            <input {...bind('ownerName')} aria-invalid={!!errors.ownerName} className={INPUT} />
                        </Field>
                        <Field id="team-ownerPhone" label="Owner phone" error={errors.ownerPhone}>
                            <input {...bind('ownerPhone')} type="tel" aria-invalid={!!errors.ownerPhone} className={INPUT} />
                        </Field>
                        <Field id="team-ownerEmail" label="Owner email" error={errors.ownerEmail}>
                            <input {...bind('ownerEmail')} type="email" placeholder="Optional" aria-invalid={!!errors.ownerEmail} className={INPUT} />
                        </Field>
                        <Field id="team-whatsappGroupLink" label="WhatsApp group link"
                            help={team?.whatsappGroupLink && !f.whatsappGroupLink.trim() ? "A saved link can't be removed yet, so the current one stays." : undefined}>
                            <input {...bind('whatsappGroupLink')} type="url" placeholder="Optional" className={INPUT} />
                        </Field>
                    </div>
                </FormGroup>

                <FormGroup title="Budget">
                    <Field id="team-budget" label={team ? 'Remaining budget' : 'Starting budget'} error={errors.budget}
                        help={team
                            ? `Adjusts what the team has left to spend. The starting budget of ${inr(team.initialBudget || 0)} doesn't change.`
                            : "Defaults to the tournament's auction budget per team."}>
                        <div className="relative">
                            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">₹</span>
                            <input {...bind('budget')} type="number" min={0} step={1} inputMode="numeric" aria-invalid={!!errors.budget} className={cn(INPUT, 'pl-7')} />
                        </div>
                    </Field>
                </FormGroup>
                {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}
            </form>
        </Drawer>
    );
};

export default TeamsSection;
