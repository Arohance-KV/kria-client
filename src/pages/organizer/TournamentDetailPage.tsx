import { FormEvent, ReactNode, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import {
    AlertCircle, ArrowLeft, ArrowRight, Calendar, Check, FileText, Gavel, LayoutDashboard, LifeBuoy, ListTree,
    Loader2, Lock, LucideIcon, MapPin, Megaphone, Menu, Network, Settings, Shield, Swords, Trophy, UserCheck,
    Users, Wallet,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import {
    fetchTournament, updateTournament, deleteTournament,
    openRegistration, closeRegistration, startAuction,
    startTournament, completeTournament, cancelTournament,
    clearCurrentTournament, Tournament,
} from '../../store/slices/tournamentSlice';
import { Category, fetchTournamentCategories } from '../../store/slices/registrationSlice';
import TeamsSection from './components/TeamsSection';
import StaffSection from './components/StaffSection';
import CategoriesSection from './components/CategoriesSection';
import AnnouncementsSection from './components/AnnouncementsSection';
import RegistrationsSection from './components/RegistrationsSection';
import AuctionSection from './components/AuctionSection';
import MatchManagementSection from './components/MatchManagementSection';
import BracketManagementSection from './components/BracketManagementSection';
import PaymentsSection from './components/PaymentsSection';
import { sportRegistry } from '@/sports/registry';
import { getAppLenis } from '@/context/LenisContext';
import { cn } from '@/lib/utils';
import {
    AccountMenu, Brand, BTN_DANGER, BTN_DANGER_SOLID, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS, formatRange, inDays, inr,
    sportLabel, sportsOf, statusOf, StatusBadge, TONE,
} from './shared';
import { Field, FormSection, Notice, PageHead, ReadOnlyContext, SectionNavContext, Spinner } from './ui';

// ─── Navigation ───────────────────────────────────────────────────────────────

type SectionKey =
    | 'overview' | 'details' | 'announcements'
    | 'categories' | 'registrations' | 'payments'
    | 'teams' | 'auction'
    | 'brackets' | 'matches' | 'team_league'
    | 'staff' | 'settings';

const SECTIONS: Record<SectionKey, { label: string; icon: LucideIcon }> = {
    overview: { label: 'Overview', icon: LayoutDashboard },
    details: { label: 'Details', icon: FileText },
    announcements: { label: 'Announcements', icon: Megaphone },
    categories: { label: 'Categories', icon: ListTree },
    registrations: { label: 'Registrations', icon: UserCheck },
    payments: { label: 'Payments', icon: Wallet },
    teams: { label: 'Teams', icon: Shield },
    auction: { label: 'Auction', icon: Gavel },
    brackets: { label: 'Brackets', icon: Network },
    matches: { label: 'Matches', icon: Swords },
    team_league: { label: 'Team league', icon: Trophy },
    staff: { label: 'Staff', icon: Users },
    settings: { label: 'Settings', icon: Settings },
};

const GROUPS: { label: string; items: SectionKey[] }[] = [
    { label: 'Tournament', items: ['overview', 'details', 'announcements'] },
    { label: 'Players', items: ['categories', 'registrations', 'payments'] },
    { label: 'Teams', items: ['teams', 'auction'] },
    { label: 'Competition', items: ['brackets', 'matches', 'team_league'] },
    { label: 'Manage', items: ['staff', 'settings'] },
];

// Sections from before the redesign, so old links and bookmarks still land somewhere sensible.
const LEGACY_SECTIONS: Record<string, SectionKey> = { basic: 'details', schedule: 'details', location: 'details', danger: 'settings' };
const toSection = (s: string | null): SectionKey =>
    !s ? 'overview' : LEGACY_SECTIONS[s] ?? (s in SECTIONS ? (s as SectionKey) : 'overview');

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const STAGES = ['draft', 'registration_open', 'registration_closed', 'auction_in_progress', 'ongoing', 'completed'];
const STAGE_LABELS = ['Draft', 'Registration open', 'Registration closed', 'Auction', 'In progress', 'Completed'];

// One forward step per status: the same transitions the old Quick Actions offered.
const NEXT: Record<string, { label: string; text: string; thunk: typeof openRegistration }> = {
    draft: { label: 'Open registration', thunk: openRegistration, text: 'Players can find this tournament and register. You can keep editing details afterwards.' },
    registration_open: { label: 'Close registration', thunk: closeRegistration, text: 'New registrations stop. Entries you already have are kept.' },
    registration_closed: { label: 'Start auction', thunk: startAuction, text: 'Opens the player auction so teams can be built.' },
    auction_in_progress: { label: 'Start tournament', thunk: startTournament, text: 'Moves the tournament to In progress so you can run brackets and matches.' },
    ongoing: { label: 'Complete tournament', thunk: completeTournament, text: 'Marks the tournament as finished. Details become read-only.' },
};

const READ_ONLY_STATUSES = ['completed', 'cancelled'];
// Sections that go view-only with the tournament. Announcements stay open; Details and
// Settings lock themselves; Auction is hidden and Payments has nothing to change.
const LOCKABLE: SectionKey[] = ['categories', 'registrations', 'teams', 'brackets', 'matches', 'team_league', 'staff'];

// ─── Formatting ───────────────────────────────────────────────────────────────

const FORMAT: Record<string, string> = {
    knockout: 'Knockout', round_robin: 'Round robin', group_knockout: 'Groups + knockout',
    league: 'League', hybrid: 'Hybrid', team_league: 'Team league',
};
const GENDER: Record<string, string> = { Male: 'Men', Female: 'Women', Mixed: 'Mixed', Any: 'Open' };

const until = (d: string) => differenceInCalendarDays(new Date(d), new Date());
const relative = (n: number) => (n >= 0 ? inDays(n) : n === -1 ? 'yesterday' : `${-n} days ago`);

const eligibility = (c: Category) => {
    const age = c.minAge && c.maxAge ? `${c.minAge}–${c.maxAge}` : c.maxAge ? `U-${c.maxAge}` : c.minAge ? `${c.minAge}+` : '';
    return [GENDER[c.gender] ?? c.gender, age].filter(Boolean).join(' · ');
};
const feeOf = (c: Category) => (c.isPaidRegistration && c.registrationFee > 0 ? inr(c.registrationFee) : 'Free');

/** The next date that matters at this stage of the tournament. */
const keyDate = (t: Tournament): { label: string; value: string; sub: string; urgent: boolean } => {
    const short = (d: string) => format(new Date(d), 'd MMM');
    switch (t.status) {
        case 'draft':
        case 'registration_open': {
            const n = until(t.registrationDeadline);
            return { label: 'Registration deadline', value: short(t.registrationDeadline), sub: relative(n), urgent: t.status === 'registration_open' && n <= 3 };
        }
        case 'ongoing':
            return { label: 'Ends', value: short(t.endDate), sub: relative(until(t.endDate)), urgent: false };
        case 'completed':
            return { label: 'Ended', value: short(t.endDate), sub: '', urgent: false };
        case 'cancelled':
            return { label: 'Was due to start', value: short(t.startDate), sub: '', urgent: false };
        default:
            return { label: 'Starts', value: short(t.startDate), sub: relative(until(t.startDate)), urgent: false };
    }
};

// ─── Form model ───────────────────────────────────────────────────────────────

type Form = {
    name: string; description: string; sports: string[]; bannerImage: string;
    startDate: string; endDate: string; registrationDeadline: string;
    venue: { name: string; address: string; city: string };
    settings: { maxTeams: number; defaultBudget: number; auctionType: string; allowLateRegistration: boolean };
};

const day = (d?: string) => (d ? d.split('T')[0] : '');

const toForm = (t: Tournament): Form => {
    const sports = sportsOf(t);
    return {
        name: t.name || '',
        description: t.description || '',
        sports: sports.length ? sports : ['badminton'],
        bannerImage: t.bannerImage || '',
        startDate: day(t.startDate),
        endDate: day(t.endDate),
        registrationDeadline: day(t.registrationDeadline),
        venue: { name: t.venue?.name || '', address: t.venue?.address || '', city: t.venue?.city || '' },
        settings: {
            maxTeams: t.settings?.maxTeams || 8,
            defaultBudget: t.settings?.defaultBudget || 100000,
            auctionType: t.settings?.auctionType || 'manual',
            allowLateRegistration: t.settings?.allowLateRegistration || false,
        },
    };
};

// ─── Small pieces ─────────────────────────────────────────────────────────────

const INPUT = cn(
    'h-9 w-full rounded-lg border border-line bg-panel px-3 text-sm text-fg [color-scheme:dark] transition-colors',
    'placeholder:text-fg-subtle hover:border-white/15 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-60', FOCUS,
);
const CHOICE = cn(
    'flex cursor-pointer gap-2.5 rounded-lg bg-panel p-3 ring-1 ring-inset ring-line transition-colors',
    'has-[input:checked]:bg-primary/[0.06] has-[input:checked]:ring-primary/55 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60',
);

const Confirm = ({ question, yes, no = 'Not yet', onYes, onNo, busy, danger }: {
    question: string; yes: string; no?: string; onYes: () => void; onNo: () => void; busy: boolean; danger?: boolean;
}) => (
    <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] text-fg-muted">{question}</span>
        <button type="button" autoFocus onClick={onNo} disabled={busy} className={cn(BTN_SECONDARY, BTN_SM)}>{no}</button>
        <button type="button" onClick={onYes} disabled={busy} className={cn(danger ? BTN_DANGER_SOLID : BTN_PRIMARY, BTN_SM)}>
            {busy && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}{yes}
        </button>
    </div>
);

const FactSection = ({ title, onEdit, children }: { title: string; onEdit?: () => void; children: ReactNode }) => (
    <div className="py-3 [&+&]:border-t [&+&]:border-line">
        <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium text-fg-subtle">{title}</h3>
            {onEdit && <button type="button" onClick={onEdit} className={cn('rounded text-[13px] text-fg-muted hover:text-fg', FOCUS)}>Edit</button>}
        </div>
        {children}
    </div>
);

const Fact = ({ term, children }: { term: string; children: ReactNode }) => (
    <div className="flex justify-between gap-4 text-[13px]">
        <dt className="text-fg-muted">{term}</dt>
        <dd className="text-right tabular-nums text-fg">{children}</dd>
    </div>
);

// Category table columns once there is room (1400px+): name · format · fee · max · status
const CAT_COLS = 'min-[1400px]:grid-cols-[minmax(0,1fr)_7.5rem_4.5rem_4.5rem_9.5rem]';

// ═════════════════════════════════════════════════════════════════════════════

const TournamentDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { currentTournament: t, error } = useAppSelector((state) => state.tournament);
    const { categories } = useAppSelector((state) => state.registration);
    const { user } = useAppSelector((state) => state.auth);
    const isStaff = user?.role === 'staff';

    const [searchParams, setSearchParams] = useSearchParams();
    const [activeSection, setActiveSection] = useState<SectionKey>(() => toSection(searchParams.get('section')));
    const [navOpen, setNavOpen] = useState(false);
    // Until the first requests settle, missing data means "loading", not "not found" / "no categories".
    const [fetched, setFetched] = useState(false);
    const [catsLoaded, setCatsLoaded] = useState(false);
    const [form, setForm] = useState<Form | null>(null);
    const [saving, setSaving] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const [confirming, setConfirming] = useState<'advance' | 'cancel' | 'delete' | null>(null);
    const [busy, setBusy] = useState(false);

    const load = () => {
        if (!id) return;
        setFetched(false);
        setCatsLoaded(false);
        dispatch(fetchTournament(id)).finally(() => setFetched(true));
        dispatch(fetchTournamentCategories(id)).finally(() => setCatsLoaded(true));
    };

    useEffect(() => {
        load();
        return () => { dispatch(clearCurrentTournament()); };
    }, [id, dispatch]);

    // Keep the active section in the URL so a refresh restores it.
    useEffect(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('section', activeSection);
            return next;
        }, { replace: true });
    }, [activeSection]);

    // Reset the form whenever the saved tournament changes (load, save, status change).
    useEffect(() => { setForm(t ? toForm(t) : null); }, [t]);

    useEffect(() => {
        if (!justSaved) return;
        const timer = setTimeout(() => setJustSaved(false), 2500);
        return () => clearTimeout(timer);
    }, [justSaved]);

    useEffect(() => {
        if (!navOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [navOpen]);

    const handleLogout = () => { dispatch(logout()); navigate('/login'); };

    if (!t) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas px-4 font-ui text-fg">
                {!fetched ? (
                    <Loader2 aria-label="Loading tournament" className="h-6 w-6 animate-spin text-fg-subtle" />
                ) : (
                    <div role="alert" className="max-w-sm text-center">
                        <AlertCircle aria-hidden className="mx-auto mb-3 h-5 w-5 text-red-400" />
                        <p className="text-sm font-medium">Couldn't open this tournament</p>
                        <p className="mt-1 text-sm text-fg-muted">{error ?? 'It may have been deleted.'}</p>
                        <div className="mt-5 flex justify-center gap-2">
                            <button type="button" onClick={load} className={BTN_SECONDARY}>Try again</button>
                            <Link to="/organizer/home" className={BTN_PRIMARY}>All tournaments</Link>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─── Derived state ───────────────────────────────────────────────────────

    const status = t.status || 'draft';
    const readOnly = READ_ONLY_STATUSES.includes(status);
    const tournamentSports = sportsOf(t);
    // team_league is a badminton bracket type — resolve its plugin from the badminton
    // sport when the tournament hosts it, else fall back to the tournament's first sport.
    const teamLeagueSportKey = tournamentSports.find(s => s === 'badminton') || tournamentSports[0];
    const teamLeagueSection = (teamLeagueSportKey ? sportRegistry.get(teamLeagueSportKey) : undefined)
        ?.organizerTournamentSections?.find(s => s.key === 'team_league');
    const leagueCategories = categories.map(c => ({
        _id: c._id, name: c.name, status: c.status, bracketType: c.bracketType, teamLeagueConfig: c.teamLeagueConfig,
    }));

    // Same visibility rules as before. Staff may edit an assigned tournament but not
    // manage staff, delete or cancel it, or view payments.
    const isVisible = (key: SectionKey) => {
        if (key === 'auction') return !['draft', 'cancelled', 'completed'].includes(status);
        if (key === 'brackets' || key === 'matches') return !['draft', 'cancelled'].includes(status);
        if (key === 'team_league') return !['draft', 'cancelled'].includes(status) && !!teamLeagueSection?.visible(leagueCategories);
        if (isStaff && (key === 'payments' || key === 'staff')) return false;
        return true;
    };
    const section = isVisible(activeSection) ? activeSection : 'overview';

    const goTo = (key: SectionKey) => {
        setActiveSection(key);
        setNavOpen(false);
        setConfirming(null);
        const lenis = getAppLenis();
        if (lenis) lenis.scrollTo(0, { immediate: true });
        else window.scrollTo(0, 0);
    };

    const dirty = !!form && JSON.stringify(form) !== JSON.stringify(toForm(t));
    const formValid = !!form && form.sports.length > 0;

    const runAction = async (thunk: typeof openRegistration) => {
        setBusy(true);
        await dispatch(thunk(t._id));
        setBusy(false);
        setConfirming(null);
    };

    const handleDelete = async () => {
        setBusy(true);
        const result = await dispatch(deleteTournament(t._id));
        setBusy(false);
        if (deleteTournament.fulfilled.match(result)) navigate('/organizer/home');
        else setConfirming(null);
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!form || !dirty || !formValid || readOnly) return;
        setSaving(true);
        const result = await dispatch(updateTournament({ id: t._id, data: form }));
        setSaving(false);
        if (updateTournament.fulfilled.match(result)) setJustSaved(true);
    };

    const setField = (patch: Partial<Form>) => setForm(f => f && { ...f, ...patch });
    const setVenue = (patch: Partial<Form['venue']>) => setForm(f => f && { ...f, venue: { ...f.venue, ...patch } });
    const setSettings = (patch: Partial<Form['settings']>) => setForm(f => f && { ...f, settings: { ...f.settings, ...patch } });

    // ─── Layout ──────────────────────────────────────────────────────────────

    const s = statusOf(status);
    const ownSection = section === 'overview' || section === 'details' || section === 'settings';
    const locked = readOnly && LOCKABLE.includes(section);

    return (
        <div className="min-h-screen bg-canvas font-ui text-fg antialiased">
            {navOpen && (
                <button type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)}
                    className="fixed inset-0 z-30 bg-black/60 md:hidden" />
            )}

            <aside className={cn(
                'fixed inset-y-0 left-0 z-40 w-72 flex-col border-r border-line bg-canvas shadow-2xl md:flex md:w-16 md:shadow-none lg:w-60',
                navOpen ? 'flex' : 'hidden',
            )}>
                <div className="flex h-14 shrink-0 items-center border-b border-line px-5 md:justify-center md:px-0 lg:justify-start lg:px-5">
                    <Brand className="md:[&>span]:hidden lg:[&>span]:inline" />
                </div>

                <div className="grid gap-2.5 px-2.5 pb-1 pt-3">
                    <Link to="/organizer/home" title="All tournaments"
                        className={cn('flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-white/[0.04] hover:text-fg md:justify-center lg:justify-start', FOCUS)}>
                        <ArrowLeft aria-hidden className="h-3.5 w-3.5 shrink-0" />
                        <span className="md:sr-only lg:not-sr-only">All tournaments</span>
                    </Link>
                    <div className="flex items-start gap-2.5 rounded-lg bg-panel p-2.5 ring-1 ring-inset ring-line md:justify-center md:bg-transparent md:p-1.5 md:ring-0 lg:justify-start lg:bg-panel lg:p-2.5 lg:ring-1">
                        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-xs font-semibold text-fg-muted ring-1 ring-inset ring-line">
                            {sportLabel(tournamentSports[0] ?? '?')[0]}
                        </span>
                        <div className="min-w-0 md:hidden lg:block">
                            <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-fg">{t.name}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                                <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE[s.tone].dot)} />{s.label}
                            </p>
                        </div>
                    </div>
                </div>

                <nav aria-label="Tournament sections" data-lenis-prevent className="flex-1 overflow-y-auto px-2.5 pb-2.5">
                    {GROUPS.map(group => {
                        const items = group.items.filter(isVisible);
                        if (!items.length) return null;
                        return (
                            <div key={group.label} role="group" aria-label={group.label}
                                className="mt-1.5 md:border-t md:border-line md:pt-1.5 md:first:border-t-0 lg:border-t-0 lg:pt-0">
                                <p className="px-2.5 pb-1 pt-2.5 text-xs text-fg-subtle md:hidden lg:block">{group.label}</p>
                                {items.map(key => {
                                    const { label, icon: Icon } = SECTIONS[key];
                                    const current = section === key;
                                    return (
                                        <button key={key} type="button" title={label} onClick={() => goTo(key)}
                                            aria-current={current ? 'page' : undefined}
                                            className={cn(
                                                'relative flex h-[34px] w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-medium transition-colors md:justify-center lg:justify-start',
                                                FOCUS, current ? 'bg-white/[0.06] text-fg' : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg',
                                            )}>
                                            {current && <span aria-hidden className="absolute -left-2.5 top-2 bottom-2 w-0.5 rounded-full bg-primary" />}
                                            <Icon aria-hidden className={cn('h-4 w-4 shrink-0', current && 'text-primary')} />
                                            <span className="truncate md:sr-only lg:not-sr-only">{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>

                <div className="border-t border-line p-2.5">
                    <Link to="/support" title="Help & support"
                        className={cn('flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-white/[0.04] hover:text-fg md:justify-center lg:justify-start', FOCUS)}>
                        <LifeBuoy aria-hidden className="h-4 w-4 shrink-0" />
                        <span className="md:sr-only lg:not-sr-only">Help & support</span>
                    </Link>
                </div>
            </aside>

            <div className="md:pl-16 lg:pl-60">
                <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas/95 px-4 sm:px-6 lg:px-8">
                    <button type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)}
                        className={cn('-ml-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-white/[0.05] hover:text-fg md:hidden', FOCUS)}>
                        <Menu aria-hidden className="h-4 w-4" />
                    </button>
                    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap text-sm text-fg-muted">
                        <Link to="/organizer/home" className={cn('hidden rounded hover:text-fg md:inline', FOCUS)}>Tournaments</Link>
                        <span aria-hidden className="hidden text-fg-subtle md:inline">/</span>
                        <button type="button" onClick={() => goTo('overview')} className={cn('hidden min-w-0 truncate rounded hover:text-fg md:inline', FOCUS)}>{t.name}</button>
                        <span aria-hidden className="hidden text-fg-subtle md:inline">/</span>
                        <span aria-current="page" className="truncate text-fg">{SECTIONS[section].label}</span>
                    </nav>
                    <AccountMenu
                        name={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Organizer'}
                        email={user?.email} image={user?.profileImage} onLogout={handleLogout} />
                </header>

                <main className={cn('mx-auto px-4 py-7 sm:px-6 lg:px-8 lg:py-9', ownSection ? 'max-w-6xl space-y-6' : 'max-w-[1600px]')}>
                    {error && <div className={ownSection ? '' : 'mb-6'}><Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice></div>}
                    {locked && <div className="mb-6">{lockNotice()}</div>}
                    <SectionNavContext.Provider value={s => goTo(toSection(s))}>
                        <ReadOnlyContext.Provider value={locked}>{renderSection()}</ReadOnlyContext.Provider>
                    </SectionNavContext.Provider>
                </main>
            </div>
        </div>
    );

    // ═════════════════════════════════════════════════════════════════════════

    function renderSection() {
        const id = t!._id;
        switch (section) {
            case 'overview': return overview();
            case 'details': return detailsForm();
            case 'settings': return settingsForm();
            case 'announcements': return <AnnouncementsSection tournamentId={id} />;
            case 'categories': return <CategoriesSection tournamentId={id} sports={tournamentSports} />;
            case 'teams': return <TeamsSection tournamentId={id} defaultBudget={t!.settings?.defaultBudget || 100000} />;
            case 'registrations': return <RegistrationsSection tournamentId={id} />;
            case 'payments': return <PaymentsSection tournamentId={id} />;
            case 'auction': return <AuctionSection tournamentId={id} categories={categories.map(c => ({ _id: c._id, name: c.name, status: c.status }))} />;
            case 'brackets': return <BracketManagementSection tournamentId={id} sports={tournamentSports} categories={categories.map(c => ({ _id: c._id, name: c.name, status: c.status, bracketType: c.bracketType, sport: c.sport }))} />;
            case 'matches': return <MatchManagementSection tournamentId={id} sports={tournamentSports} categories={categories.map(c => ({ _id: c._id, name: c.name, status: c.status, sport: c.sport }))} />;
            case 'team_league': {
                if (!teamLeagueSection) return null;
                const SectionComponent = teamLeagueSection.component;
                return <Suspense fallback={<Spinner />}><SectionComponent tournamentId={id} categories={leagueCategories} /></Suspense>;
            }
            case 'staff': return <StaffSection tournamentId={id} staffIds={t!.staffIds || []} />;
            default: return null;
        }
    }

    // ─── Overview ────────────────────────────────────────────────────────────

    function overview() {
        const tt = t!;
        const stage = STAGES.indexOf(status);
        const next = NEXT[status];
        const kd = keyDate(tt);
        const maxTeams = tt.settings?.maxTeams;
        const teams = tt.teamsCount ?? 0;
        const openSlots = maxTeams ? maxTeams - teams : 0;
        const openCats = categories.filter(c => c.status === 'registration').length;
        const venueLine = [tt.venue?.name, tt.venue?.city].filter(Boolean).join(', ');
        const deadlineIn = until(tt.registrationDeadline);

        const metrics: { key: SectionKey; label: string; value: ReactNode; sub?: string; urgent?: boolean }[] = [
            { key: 'registrations', label: 'Registered players', value: tt.registeredPlayersCount ?? '—' },
            {
                key: 'teams', label: 'Teams',
                value: <>{teams}{maxTeams ? <span className="text-[15px] font-medium tracking-normal text-fg-subtle"> / {maxTeams}</span> : null}</>,
                sub: maxTeams ? (openSlots > 0 ? `${openSlots} slot${openSlots === 1 ? '' : 's'} open` : 'Full') : undefined,
            },
            { key: 'categories', label: 'Categories', value: catsLoaded ? categories.length : '—', sub: openCats ? `${openCats} taking entries` : undefined },
            { key: 'details', label: kd.label, value: kd.value, sub: kd.sub, urgent: kd.urgent },
        ];

        return (
            <>
                <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-fg font-ui!">{tt.name}</h1>
                        <StatusBadge status={status} />
                    </div>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-fg-muted">
                        <span className="inline-flex items-center gap-1.5"><Calendar aria-hidden className="h-3.5 w-3.5 text-fg-subtle" />{formatRange(tt.startDate, tt.endDate)}</span>
                        {venueLine && <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />{venueLine}</span>}
                        <span>{tournamentSports.map(sportLabel).join(', ')}</span>
                    </p>
                </div>

                <section aria-label="Tournament progress" className="rounded-xl border border-line bg-panel p-4 sm:px-5">
                    {status === 'cancelled' ? (
                        <Notice tone="red" icon={AlertCircle}>
                            <span className="font-medium">This tournament was cancelled.</span> It's read-only, and players can no longer register or play.
                        </Notice>
                    ) : stage >= 0 && (
                        <>
                            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px] text-fg-muted">
                                <span>Tournament progress</span>
                                <span>Stage <b className="font-medium text-fg">{stage + 1}</b> of {STAGES.length} · <b className="font-medium text-fg">{STAGE_LABELS[stage]}</b></span>
                            </div>
                            <ol className="mt-3 grid grid-cols-6 gap-1">
                                {STAGE_LABELS.map((label, i) => (
                                    <li key={label} aria-current={i === stage ? 'step' : undefined}>
                                        <span aria-hidden className={cn('block h-1 rounded-full', i < stage ? 'bg-fg-subtle' : i === stage ? 'bg-primary' : 'bg-line')} />
                                        <span className={cn('mt-2 hidden text-xs sm:block', i < stage ? 'text-fg-muted' : i === stage ? 'font-medium text-fg' : 'text-fg-subtle')}>
                                            {label}{i < stage && <span className="sr-only"> (done)</span>}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                            <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-fg">{next ? `Next: ${next.label.toLowerCase()}` : 'All stages complete'}</p>
                                    <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{next ? next.text : 'This tournament has finished.'}</p>
                                    {status === 'draft' && catsLoaded && categories.length === 0 && (
                                        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-amber-300">
                                            <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />Add a category first. Players need one to register.
                                        </p>
                                    )}
                                </div>
                                {next && (confirming === 'advance' ? (
                                    <Confirm question={`${next.label}?`} yes={`Yes, ${next.label.toLowerCase()}`} busy={busy}
                                        onYes={() => runAction(next.thunk)} onNo={() => setConfirming(null)} />
                                ) : (
                                    <button type="button" onClick={() => setConfirming('advance')} className={cn(BTN_PRIMARY, 'shrink-0 self-start sm:self-auto')}>
                                        {next.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </section>

                <section aria-label="At a glance" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
                    {metrics.map(m => (
                        <button key={m.label} type="button" onClick={() => goTo(m.key)}
                            className="bg-panel px-4 py-4 text-left transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70 sm:px-5">
                            <span className="block text-[13px] text-fg-muted">{m.label}</span>
                            <span className="mt-1.5 block text-2xl font-semibold tabular-nums tracking-tight text-fg">{m.value}</span>
                            <span className={cn('mt-0.5 block min-h-[18px] text-xs', m.urgent ? 'text-amber-300' : 'text-fg-subtle')}>{m.sub}</span>
                            <span className="sr-only">, open {SECTIONS[m.key].label}</span>
                        </button>
                    ))}
                </section>

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <section aria-labelledby="categories-heading" className="overflow-hidden rounded-xl border border-line bg-panel">
                        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                            <h2 id="categories-heading" className="flex items-baseline gap-2 text-sm font-semibold text-fg">
                                Categories {catsLoaded && <span className="text-[13px] font-normal tabular-nums text-fg-subtle">{categories.length}</span>}
                            </h2>
                            <button type="button" onClick={() => goTo('categories')} className={cn('inline-flex items-center gap-1 rounded text-[13px] text-fg-muted hover:text-fg', FOCUS)}>
                                Manage <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        {!catsLoaded ? (
                            <div aria-busy="true" aria-label="Loading categories" className="space-y-3 p-5">
                                {[0, 1, 2].map(i => <span key={i} className="block h-4 animate-pulse rounded bg-white/[0.05]" />)}
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="px-6 py-10 text-center">
                                <p className="text-sm font-medium text-fg">No categories yet</p>
                                <p className="mt-1 text-sm text-fg-muted">Add the events players can register for, like singles or doubles.</p>
                                {!readOnly && <button type="button" onClick={() => goTo('categories')} className={cn(BTN_SECONDARY, 'mt-4')}>Add a category</button>}
                            </div>
                        ) : (
                            <>
                                <div className={cn('hidden gap-x-5 border-b border-line px-5 py-2 text-xs font-medium text-fg-subtle min-[1400px]:grid', CAT_COLS)}>
                                    <span>Category</span><span>Format</span><span className="text-right">Fee</span><span className="text-right">Max</span><span>Status</span>
                                </div>
                                <ul className="divide-y divide-line">
                                    {categories.map(c => {
                                        const fmt = FORMAT[c.bracketType ?? ''] ?? '—';
                                        const elig = [tournamentSports.length > 1 && c.sport ? sportLabel(c.sport) : '', eligibility(c)].filter(Boolean).join(' · ');
                                        return (
                                            <li key={c._id}>
                                                <button type="button" onClick={() => goTo('categories')}
                                                    className={cn('grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70 sm:px-5 min-[1400px]:gap-x-5', CAT_COLS)}>
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                                                        <span className="mt-0.5 block truncate text-[13px] text-fg-subtle">
                                                            {elig}<span className="min-[1400px]:hidden">{elig && ' · '}{fmt} · {feeOf(c)} · {c.maxParticipants} max</span>
                                                        </span>
                                                    </span>
                                                    <span className="hidden text-sm text-fg-muted min-[1400px]:block">{fmt}</span>
                                                    <span className="hidden text-right text-sm tabular-nums text-fg-muted min-[1400px]:block">{feeOf(c)}</span>
                                                    <span className="hidden text-right text-sm tabular-nums text-fg-muted min-[1400px]:block">{c.maxParticipants}</span>
                                                    <span><StatusBadge status={c.status} /></span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </>
                        )}
                    </section>

                    <aside aria-label="Tournament facts" className="rounded-xl border border-line bg-panel px-4 py-1 sm:px-5">
                        <FactSection title="Schedule" onEdit={readOnly ? undefined : () => goTo('details')}>
                            <dl className="grid gap-1.5">
                                <Fact term="Registration deadline">
                                    {format(new Date(tt.registrationDeadline), 'd MMM yyyy')}
                                    {status === 'registration_open' && (
                                        <span className={cn('block text-xs', deadlineIn <= 3 ? 'text-amber-300' : 'text-fg-subtle')}>{relative(deadlineIn)}</span>
                                    )}
                                </Fact>
                                <Fact term="Starts">{format(new Date(tt.startDate), 'EEE, d MMM yyyy')}</Fact>
                                <Fact term="Ends">{format(new Date(tt.endDate), 'EEE, d MMM yyyy')}</Fact>
                            </dl>
                        </FactSection>
                        <FactSection title="Venue" onEdit={readOnly ? undefined : () => goTo('details')}>
                            <p className="text-[13px] leading-relaxed text-fg">{tt.venue?.name || '—'}</p>
                            <p className="text-[13px] leading-relaxed text-fg-muted">{[tt.venue?.address, tt.venue?.city].filter(Boolean).join(', ')}</p>
                        </FactSection>
                        <FactSection title="Rules" onEdit={readOnly ? undefined : () => goTo('settings')}>
                            <dl className="grid gap-1.5">
                                <Fact term="Max teams">{tt.settings?.maxTeams ?? '—'}</Fact>
                                <Fact term="Auction budget per team">{tt.settings?.defaultBudget != null ? inr(tt.settings.defaultBudget) : '—'}</Fact>
                                <Fact term="Auction type">{tt.settings?.auctionType === 'live' ? 'Live' : 'Manual'}</Fact>
                                <Fact term="Late registration">{tt.settings?.allowLateRegistration ? 'Allowed' : 'Not allowed'}</Fact>
                            </dl>
                        </FactSection>
                    </aside>
                </div>
            </>
        );
    }

    // ─── Forms ───────────────────────────────────────────────────────────────

    function lockNotice() {
        return readOnly ? <Notice tone="neutral" icon={Lock}>{statusOf(status).label} tournaments can't be edited.</Notice> : null;
    }

    function saveBar() {
        if (readOnly || !(dirty || justSaved)) return null;
        return (
            <div role="status" className="sticky bottom-4 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-raised py-2.5 pl-4 pr-2.5 text-sm shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-line">
                {dirty ? (
                    <>
                        <span>You have unsaved changes</span>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setForm(toForm(t!))} disabled={saving} className={cn(BTN_SECONDARY, BTN_SM)}>Discard</button>
                            <button type="submit" disabled={saving || !formValid} className={cn(BTN_PRIMARY, BTN_SM)}>
                                {saving && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}Save changes
                            </button>
                        </div>
                    </>
                ) : (
                    <span className="flex items-center gap-2 py-1 text-fg-muted"><Check aria-hidden className="h-4 w-4 text-emerald-400" />Changes saved</span>
                )}
            </div>
        );
    }

    function detailsForm() {
        if (!form) return null;
        return (
            <>
                <PageHead title="Details" desc="How this tournament appears to players." />
                {lockNotice()}
                <form onSubmit={handleSave} noValidate>
                    <FormSection title="General" desc="The name, sports and description players see when they find this tournament.">
                        <div className="grid gap-4">
                            <Field id="t-name" label="Tournament name">
                                <input id="t-name" className={INPUT} value={form.name} disabled={readOnly} onChange={e => setField({ name: e.target.value })} />
                            </Field>
                            <Field label="Sports" help={form.sports.length === 0
                                ? <span className="text-amber-300">Choose at least one sport.</span>
                                : "You can't remove a sport that already has categories."}>
                                <div role="group" aria-label="Sports" className="flex flex-wrap gap-2">
                                    {sportRegistry.list().map(p => (
                                        <label key={p.sportKey} className={cn(CHOICE, 'h-8 items-center px-3 py-0 text-[13px]')}>
                                            <input type="checkbox" className="accent-primary" disabled={readOnly}
                                                checked={form.sports.includes(p.sportKey)}
                                                onChange={e => setField({ sports: e.target.checked ? [...form.sports, p.sportKey] : form.sports.filter(x => x !== p.sportKey) })} />
                                            {p.displayName}
                                        </label>
                                    ))}
                                </div>
                            </Field>
                            <Field id="t-desc" label="Description">
                                <textarea id="t-desc" rows={4} className={cn(INPUT, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed')} value={form.description}
                                    disabled={readOnly} onChange={e => setField({ description: e.target.value })} />
                            </Field>
                            <Field id="t-banner" label="Banner image URL">
                                <input id="t-banner" className={INPUT} placeholder="https://" value={form.bannerImage} disabled={readOnly}
                                    onChange={e => setField({ bannerImage: e.target.value })} />
                            </Field>
                        </div>
                    </FormSection>
                    <FormSection title="Schedule" desc="Registration closes at the end of the deadline day.">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field id="t-start" label="Start date">
                                <input id="t-start" type="date" className={INPUT} value={form.startDate} disabled={readOnly} onChange={e => setField({ startDate: e.target.value })} />
                            </Field>
                            <Field id="t-end" label="End date">
                                <input id="t-end" type="date" className={INPUT} value={form.endDate} disabled={readOnly} onChange={e => setField({ endDate: e.target.value })} />
                            </Field>
                            <Field id="t-deadline" label="Registration deadline">
                                <input id="t-deadline" type="date" className={INPUT} value={form.registrationDeadline} disabled={readOnly} onChange={e => setField({ registrationDeadline: e.target.value })} />
                            </Field>
                        </div>
                    </FormSection>
                    <FormSection title="Venue" desc="Where matches are played.">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field id="t-venue" label="Venue name" className="sm:col-span-2">
                                <input id="t-venue" className={INPUT} value={form.venue.name} disabled={readOnly} onChange={e => setVenue({ name: e.target.value })} />
                            </Field>
                            <Field id="t-city" label="City">
                                <input id="t-city" className={INPUT} value={form.venue.city} disabled={readOnly} onChange={e => setVenue({ city: e.target.value })} />
                            </Field>
                            <Field id="t-address" label="Full address">
                                <input id="t-address" className={INPUT} value={form.venue.address} disabled={readOnly} onChange={e => setVenue({ address: e.target.value })} />
                            </Field>
                        </div>
                    </FormSection>
                    {saveBar()}
                </form>
            </>
        );
    }

    function settingsForm() {
        if (!form) return null;
        const showDanger = !readOnly && !isStaff;
        const dangerRow = (key: 'cancel' | 'delete', title: string, text: string, question: string, yes: string, onYes: () => void) => (
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 [&+&]:border-t [&+&]:border-red-400/25">
                <div>
                    <p className="text-sm font-medium text-fg">{title}</p>
                    <p className="mt-0.5 max-w-[52ch] text-[13px] leading-relaxed text-fg-muted">{text}</p>
                </div>
                {confirming === key ? (
                    <Confirm question={question} yes={yes} no="Keep it" danger busy={busy} onYes={onYes} onNo={() => setConfirming(null)} />
                ) : (
                    <button type="button" onClick={() => setConfirming(key)} className={cn(BTN_DANGER, BTN_SM, 'self-start sm:self-auto')}>{title}</button>
                )}
            </div>
        );
        return (
            <>
                <PageHead title="Settings" desc="Team limits, auction rules and tournament controls." />
                {lockNotice()}
                <form onSubmit={handleSave} noValidate>
                    <FormSection title="Teams and auction" desc="Limits and defaults used when teams are created and the auction runs.">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field id="t-max" label="Maximum teams">
                                <input id="t-max" type="number" min={2} className={INPUT} value={form.settings.maxTeams} disabled={readOnly}
                                    onChange={e => setSettings({ maxTeams: Number(e.target.value) })} />
                            </Field>
                            <Field id="t-budget" label="Auction budget per team" help="Default for new teams. You can change it per team.">
                                <div className="relative">
                                    <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">₹</span>
                                    <input id="t-budget" type="number" min={0} step={1000} className={cn(INPUT, 'pl-7')} value={form.settings.defaultBudget} disabled={readOnly}
                                        onChange={e => setSettings({ defaultBudget: Number(e.target.value) })} />
                                </div>
                            </Field>
                            <Field label="Auction type" className="sm:col-span-2">
                                <div role="radiogroup" aria-label="Auction type" className="grid gap-2 sm:grid-cols-2">
                                    {[
                                        { value: 'manual', title: 'Manual', text: 'Offline draft. You record each pick.' },
                                        { value: 'live', title: 'Live', text: 'Interactive auction run live on KRIA.' },
                                    ].map(o => (
                                        <label key={o.value} className={CHOICE}>
                                            <input type="radio" name="auctionType" className="mt-0.5 accent-primary" disabled={readOnly}
                                                checked={form.settings.auctionType === o.value} onChange={() => setSettings({ auctionType: o.value })} />
                                            <span>
                                                <span className="block text-sm font-medium text-fg">{o.title}</span>
                                                <span className="mt-0.5 block text-[13px] text-fg-muted">{o.text}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </Field>
                        </div>
                    </FormSection>
                    <FormSection title="Registration" desc="Control entries after the deadline.">
                        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-panel p-3 ring-1 ring-inset ring-line has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60">
                            <span>
                                <span className="block text-sm font-medium text-fg">Allow late registration</span>
                                <span className="mt-0.5 block text-[13px] text-fg-muted">Accept entries after the registration deadline.</span>
                            </span>
                            <span className="relative inline-flex h-5 w-9 shrink-0">
                                <input type="checkbox" role="switch" className="peer sr-only" disabled={readOnly}
                                    checked={form.settings.allowLateRegistration}
                                    onChange={e => setSettings({ allowLateRegistration: e.target.checked })} />
                                <span aria-hidden className="absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/70" />
                                <span aria-hidden className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-fg transition-transform peer-checked:translate-x-4" />
                            </span>
                        </label>
                    </FormSection>
                    {saveBar()}
                </form>
                {showDanger && (
                    <FormSection title="Danger zone" desc="These actions can't be undone." danger>
                        <div className="rounded-xl border border-red-400/25">
                            {dangerRow('cancel', 'Cancel tournament',
                                'Stops the tournament for everyone. Registrations, teams and results stay on record, but nothing can be changed.',
                                `Cancel ${t!.name}?`, 'Yes, cancel it', () => runAction(cancelTournament))}
                            {dangerRow('delete', 'Delete tournament',
                                'Permanently removes the tournament and all of its data.',
                                'Delete permanently?', 'Yes, delete', handleDelete)}
                        </div>
                    </FormSection>
                )}
            </>
        );
    }
};

export default TournamentDetailPage;
