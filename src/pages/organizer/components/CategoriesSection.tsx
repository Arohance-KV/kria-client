// Categories: the list with one "next step" per category, row menus, the sport's
// create/edit form in a drawer, and analytics & awards.
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Pencil, Plus, RotateCcw, Trash2, Trophy, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
    Category,
    clearCategoryError,
    completeCategory,
    deleteCategory,
    fetchTournamentCategories,
    openCategoryRegistration,
    setCategoryStatus,
    startCategory,
    startCategoryAuction,
} from '../../../store/slices/categorySlice';
import { fetchTournamentCategories as fetchPageCategories } from '../../../store/slices/registrationSlice';
import { sportRegistry } from '@/sports/registry';
import { cn } from '@/lib/utils';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS, inr, sportLabel, StatusBadge, statusOf } from '../shared';
import {
    CHOICE, COLHEAD, ConfirmBar, Dialog, Drawer, EmptyState, FormGroup, MoreMenu, Notice, PageHead, PANEL, ROW, Segmented, Spinner, useReadOnly, useSectionNav,
} from '../ui';
import CategoryAnalyticsModal from './CategoryAnalyticsModal';

type Cat = Category & { cricketConfig?: { overs?: number; playersPerTeam?: number } };

const FORMAT: Record<string, string> = { knockout: 'Knockout', league: 'League', hybrid: 'Groups + knockout', team_league: 'Team league' };
const GENDER: Record<string, string> = { male: 'Men', female: 'Women', mixed: 'Mixed' };

// One forward step per status. auction → Brackets, and team-league categories in
// auction/groups_configured → Team league, are links rather than actions.
const NEXT: Record<string, { label: string; text: string }> = {
    setup: { label: 'Open registration', text: 'Players can register for this category.' },
    registration: { label: 'Start auction', text: 'Registration closes for this category and its auction opens.' },
    bracket_configured: { label: 'Start category', text: 'Moves the category to In progress so matches can be played.' },
    ongoing: { label: 'Complete category', text: 'Marks the category as finished. Results become final.' },
};

// Stages a category can be moved back to. groups_configured is reached through the
// team-league tools only, so it's never a target here.
const PIPELINE = ['setup', 'registration', 'auction', 'bracket_configured', 'ongoing', 'completed'];
const STAGE_TEXT: Record<string, string> = {
    setup: 'Before registration opens.',
    registration: 'Players can register.',
    auction: 'Players are auctioned to teams.',
    bracket_configured: 'The draw is ready and no matches have started.',
    ongoing: 'Matches are being played.',
};
const earlierStages = (status: string) => {
    if (status === 'groups_configured') return PIPELINE.slice(0, PIPELINE.indexOf('auction') + 1);
    const i = PIPELINE.indexOf(status);
    return i === -1 ? PIPELINE : PIPELINE.slice(0, i);
};

const teamLeagueStep = (c: Cat) => c.bracketType === 'team_league' && ['auction', 'groups_configured'].includes(c.status);
const feeOf = (c: Cat) => (c.isPaidRegistration && c.registrationFee > 0 ? inr(c.registrationFee) : 'Free');
const matchLine = (c: Cat) => {
    if (c.bracketType === 'team_league') {
        const n = c.teamLeagueConfig?.subTeamSlots?.length ?? 0;
        return `${n} sub-match${n === 1 ? '' : 'es'} per tie`;
    }
    if (c.cricketConfig?.overs) return [`${c.cricketConfig.overs} overs`, c.cricketConfig.playersPerTeam && `${c.cricketConfig.playersPerTeam} a side`].filter(Boolean).join(' · ');
    if (c.matchFormat) {
        return [c.matchType === 'doubles' ? 'Doubles' : c.matchType === 'singles' ? 'Singles' : '',
            c.matchFormat.bestOf && `best of ${c.matchFormat.bestOf}`, c.matchFormat.pointsPerGame && `${c.matchFormat.pointsPerGame} points`].filter(Boolean).join(' · ');
    }
    return '';
};
const metaLine = (c: Cat) => [c.sport && sportLabel(c.sport), GENDER[c.gender] ?? c.gender, c.ageGroup?.label, matchLine(c)].filter(Boolean).join(' · ');

// Wide layout (xl+): name · format · fee · slots · status · actions
const COLS = 'xl:grid-cols-[minmax(0,1fr)_8rem_5rem_4.5rem_9rem_13rem]';

interface Props {
    tournamentId: string;
    sports: string[];
}

export default function CategoriesSection({ tournamentId, sports }: Props) {
    const dispatch = useAppDispatch();
    const goTo = useSectionNav();
    const readOnly = useReadOnly();
    const { categories, error } = useAppSelector(state => state.category) as { categories: Cat[]; error: string | null };

    const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
    const [form, setForm] = useState<{ category: Cat | null } | null>(null);
    const [confirm, setConfirm] = useState<{ id: string; kind: 'next' | 'delete' } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    // The row whose action failed, so its error shows next to it rather than at the top.
    const [errorAt, setErrorAt] = useState<string | null>(null);
    const [stageFor, setStageFor] = useState<Cat | null>(null);
    const [analyticsFor, setAnalyticsFor] = useState<Cat | null>(null);

    // Sports this tournament can create categories for.
    const creatable = sports.filter(s => sportRegistry.get(s)?.categoryForm);
    const [createSport, setCreateSport] = useState(creatable[0]);
    useEffect(() => {
        if (creatable.length && !creatable.includes(createSport)) setCreateSport(creatable[0]);
    }, [creatable, createSport]);

    const load = useCallback(async () => {
        setLoadState('loading');
        const r = await dispatch(fetchTournamentCategories(tournamentId));
        setLoadState(fetchTournamentCategories.fulfilled.match(r) ? 'ok' : 'error');
    }, [dispatch, tournamentId]);

    useEffect(() => { if (tournamentId) load(); }, [tournamentId, load]);

    // The page's Overview counts and sidebar read the registration store's copy.
    const syncPage = () => dispatch(fetchPageCategories(tournamentId));

    const run = async (c: Cat, key: string, action: Promise<{ meta: { requestStatus: 'fulfilled' | 'rejected' } }>) => {
        setBusy(key);
        setErrorAt(null);
        const r = await action;
        setBusy(null);
        setConfirm(null);
        if (r.meta.requestStatus === 'fulfilled') syncPage();
        else setErrorAt(c._id);
    };

    const advance = (c: Cat) => {
        const id = c._id;
        switch (c.status) {
            case 'setup': return run(c, id, dispatch(openCategoryRegistration(id)));
            case 'registration': return run(c, id, dispatch(startCategoryAuction({ id, tournamentId })));
            case 'bracket_configured': return run(c, id, dispatch(startCategory(id)));
            case 'ongoing': return run(c, id, dispatch(completeCategory(id)));
        }
    };

    const closeForm = () => { setForm(null); dispatch(clearCategoryError()); };
    const onFormSuccess = () => {
        setForm(null);
        dispatch(fetchTournamentCategories(tournamentId));
        syncPage();
    };

    const FormComponent = form
        ? sportRegistry.get((form.category ? form.category.sport : createSport) ?? '')?.categoryForm
        : undefined;

    const addButton = !readOnly && creatable.length > 0 && (
        <button type="button" onClick={() => setForm({ category: null })} className={BTN_PRIMARY}>
            <Plus aria-hidden className="h-4 w-4" />Add category
        </button>
    );

    return (
        <div className="space-y-6">
            <PageHead title="Categories" actions={addButton}
                desc="Events players register for, with their format, eligibility and fees. Each category moves through its own stages." />

            {creatable.length === 0 && (
                <Notice tone="neutral" icon={AlertCircle}>
                    Categories can’t be created for {sports.map(sportLabel).join(', ') || 'this tournament’s sport'} yet.
                </Notice>
            )}

            {error && loadState === 'ok' && !errorAt && !form && !stageFor && (
                <Notice tone="red" icon={AlertCircle}>
                    <div className="flex items-start justify-between gap-3">
                        <span role="alert">{error}</span>
                        <button type="button" aria-label="Dismiss" onClick={() => dispatch(clearCategoryError())}
                            className={cn('-my-0.5 rounded text-red-300 hover:text-red-200', FOCUS)}>
                            <X aria-hidden className="h-4 w-4" />
                        </button>
                    </div>
                </Notice>
            )}

            <section aria-label="Categories" className={cn(PANEL, 'overflow-hidden')}>
                {loadState === 'loading' && categories.length === 0 ? <Spinner label="Loading categories" /> : loadState === 'error' && categories.length === 0 ? (
                    <div role="alert">
                        <EmptyState title="Couldn’t load categories" text={error ?? 'The server didn’t respond.'}
                            action={<button type="button" onClick={load} className={BTN_SECONDARY}>Try again</button>} />
                    </div>
                ) : categories.length === 0 ? (
                    <EmptyState title="No categories yet" text="Add the events players can register for, like singles or doubles."
                        action={!readOnly && creatable.length > 0 && <button type="button" onClick={() => setForm({ category: null })} className={BTN_SECONDARY}>Add category</button>} />
                ) : (
                    <>
                        <div className={cn(COLHEAD, 'hidden xl:grid', COLS)}>
                            <span>Category</span><span>Format</span><span className="text-right">Fee</span><span className="text-right">Slots</span><span>Status</span><span />
                        </div>
                        <ul className="divide-y divide-line">
                            {categories.map(c => {
                                const next = teamLeagueStep(c) ? undefined : NEXT[c.status];
                                const fmt = FORMAT[c.bracketType] ?? c.bracketType ?? '—';
                                const fee = feeOf(c);
                                const canEdit = !readOnly && !!sportRegistry.get(c.sport ?? '')?.categoryForm;
                                const hasAwards = c.status === 'completed' || (c.status === 'groups_configured' && c.bracketType === 'team_league');
                                const lateStage = c.status === 'ongoing' || c.status === 'completed';
                                const rowBusy = busy === c._id || busy === `del:${c._id}`;
                                return (
                                    <li key={c._id} aria-busy={rowBusy || undefined}>
                                        <div className={cn(ROW, 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]', COLS)}>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-fg">{c.name}</p>
                                                <p className="mt-0.5 truncate text-[13px] text-fg-subtle">{metaLine(c)}</p>
                                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 xl:hidden">
                                                    <StatusBadge status={c.status} />
                                                    {[fmt, fee, c.maxRegistrations ? `${c.maxRegistrations} slots` : 'Unlimited slots'].map(t => (
                                                        <span key={t} className="whitespace-nowrap rounded-md px-1.5 py-px text-xs text-fg-muted ring-1 ring-inset ring-line">{t}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <span className="hidden text-sm text-fg-muted xl:block">{fmt}</span>
                                            <span className="hidden text-right text-sm tabular-nums text-fg-muted xl:block">{fee}</span>
                                            <span className="hidden text-right text-sm tabular-nums text-fg-muted xl:block">
                                                {c.maxRegistrations ?? <><span aria-hidden>∞</span><span className="sr-only">Unlimited</span></>}
                                            </span>
                                            <span className="hidden xl:block"><StatusBadge status={c.status} /></span>
                                            <div className="flex items-center gap-1.5 sm:justify-end">
                                                {readOnly ? null : next ? (
                                                    <button type="button" disabled={rowBusy} onClick={() => { setErrorAt(null); setConfirm({ id: c._id, kind: 'next' }); }}
                                                        className={cn(BTN_SECONDARY, BTN_SM)}>{next.label}</button>
                                                ) : teamLeagueStep(c) ? (
                                                    <button type="button" onClick={() => goTo('team_league')} className={cn(BTN_SECONDARY, BTN_SM)}>Manage in Team league</button>
                                                ) : c.status === 'auction' ? (
                                                    <button type="button" onClick={() => goTo('brackets')} className={cn(BTN_SECONDARY, BTN_SM)}>Set up bracket</button>
                                                ) : null}
                                                <MoreMenu label={`More actions for ${c.name}`} items={[
                                                    ...(canEdit ? [{ label: 'Edit', icon: Pencil, onSelect: () => setForm({ category: c }) }] : []),
                                                    ...(hasAwards ? [{ label: 'Analytics & awards', icon: Trophy, onSelect: () => setAnalyticsFor(c) }] : []),
                                                    ...(readOnly ? [] : [
                                                        ...(earlierStages(c.status).length ? [{ label: 'Move to an earlier stage…', icon: RotateCcw, onSelect: () => setStageFor(c) }] : []),
                                                        'separator' as const,
                                                        { label: 'Delete category', icon: Trash2, danger: true, onSelect: () => { setErrorAt(null); setConfirm({ id: c._id, kind: 'delete' }); } },
                                                    ]),
                                                ]} />
                                            </div>
                                        </div>
                                        {errorAt === c._id && error && (
                                            <p role="alert" className="flex items-start gap-2 border-t border-line px-4 py-2.5 text-[13px] text-red-300 sm:px-5">
                                                <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
                                            </p>
                                        )}
                                        {confirm?.id === c._id && confirm.kind === 'next' && next && (
                                            <ConfirmBar busy={busy === c._id}
                                                message={<><b className="font-medium text-fg">{next.label}</b> for {c.name}? {next.text}</>}
                                                confirmLabel={`Yes, ${next.label.toLowerCase()}`}
                                                onConfirm={() => advance(c)} onCancel={() => setConfirm(null)} />
                                        )}
                                        {confirm?.id === c._id && confirm.kind === 'delete' && (
                                            <ConfirmBar danger busy={busy === `del:${c._id}`}
                                                message={`Delete ${c.name}?${lateStage ? ' It already has matches and results.' : ''} This can’t be undone.`}
                                                confirmLabel="Delete category"
                                                onConfirm={() => run(c, `del:${c._id}`, dispatch(deleteCategory(c._id)))} onCancel={() => setConfirm(null)} />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </section>

            {form && (
                <Drawer wide onClose={closeForm}
                    title={form.category ? `Edit ${form.category.name}` : 'Add category'}
                    description={form.category ? 'Changes apply to new registrations and draws.' : 'Players register for categories, so set fees and eligibility before opening registration.'}>
                    {!form.category && creatable.length > 1 && (
                        <div className="mb-5 border-b border-line pb-5">
                            <FormGroup title="Sport" description="The rest of the form follows the sport.">
                                <Segmented<string> name="cat-sport" label="Sport" value={createSport} onChange={setCreateSport}
                                    options={creatable.map(s => ({ value: s, label: sportLabel(s) }))} />
                            </FormGroup>
                        </div>
                    )}
                    {FormComponent ? (
                        <FormComponent key={form.category?._id ?? createSport} tournamentId={tournamentId} category={form.category}
                            onSuccess={onFormSuccess} onCancel={closeForm} sport={form.category ? form.category.sport : createSport} />
                    ) : (
                        <Notice tone="neutral" icon={AlertCircle}>This sport’s categories can’t be edited here yet.</Notice>
                    )}
                </Drawer>
            )}

            {stageFor && (
                <StageDialog category={stageFor} onClose={() => setStageFor(null)} onMoved={() => { setStageFor(null); syncPage(); }} />
            )}

            <CategoryAnalyticsModal isOpen={!!analyticsFor} onClose={() => setAnalyticsFor(null)} category={analyticsFor} tournamentId={tournamentId} />
        </div>
    );
}

function StageDialog({ category, onClose, onMoved }: { category: Cat; onClose: () => void; onMoved: () => void }) {
    const dispatch = useAppDispatch();
    const [target, setTarget] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const move = async () => {
        setSaving(true);
        setError(null);
        const r = await dispatch(setCategoryStatus({ id: category._id, status: target }));
        if (setCategoryStatus.fulfilled.match(r)) { onMoved(); return; }
        // Shown here, so keep it out of the page banner.
        dispatch(clearCategoryError());
        setError((r.payload as string) || 'Couldn’t change the stage. Try again.');
        setSaving(false);
    };

    return (
        <Dialog title="Move to an earlier stage" description={category.name} onClose={onClose}
            footer={<>
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" onClick={move} disabled={!target || saving} className={BTN_PRIMARY}>
                    {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}{target ? `Move to ${statusOf(target).label}` : 'Move'}
                </button>
            </>}>
            <div className="grid gap-3">
                <p className="text-[13px] leading-relaxed text-fg-muted">
                    Currently <b className="font-medium text-fg">{statusOf(category.status).label}</b>. This only changes the status. Registrations, teams, draws and results are kept.
                </p>
                <div role="radiogroup" aria-label="Earlier stage" className="grid gap-2">
                    {earlierStages(category.status).filter(s => s !== category.status).map(s => (
                        <label key={s} className={CHOICE}>
                            <input type="radio" name="earlier-stage" className="mt-0.5 accent-primary" checked={target === s} onChange={() => setTarget(s)} />
                            <span>
                                <span className="block text-sm font-medium text-fg">{statusOf(s).label}</span>
                                {STAGE_TEXT[s] && <span className="mt-0.5 block text-[13px] text-fg-muted">{STAGE_TEXT[s]}</span>}
                            </span>
                        </label>
                    ))}
                </div>
                {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}
            </div>
        </Dialog>
    );
}
