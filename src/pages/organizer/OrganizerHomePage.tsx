import { ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';
import { AlertCircle, ChevronRight, Plus, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { fetchMyTournaments, Tournament } from '../../store/slices/tournamentSlice';
import { cn } from '@/lib/utils';
import {
    AccountMenu, Brand, BTN_PRIMARY, BTN_SECONDARY, FOCUS, formatRange, inDays, OrganizerSidebar, sportLabel, sportsOf, STATUS, StatusBadge,
} from './shared';

// Same set the server counts as "active" in the organizer stats.
const ACTIVE_STATUSES = ['registration_open', 'registration_closed', 'auction_in_progress', 'ongoing'];
const QUIET_STATUSES = ['completed', 'cancelled'];

// ─── Filtering & sorting ──────────────────────────────────────────────────────

type Filter = 'all' | 'active' | 'completed' | 'draft';

const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'draft', label: 'Drafts' },
];

const METRICS: { filter: Filter; label: string }[] = [
    { filter: 'active', label: 'Active events' },
    { filter: 'all', label: 'Total tournaments' },
    { filter: 'draft', label: 'In draft' },
    { filter: 'completed', label: 'Completed' },
];

const matchesFilter = (t: Tournament, f: Filter) =>
    f === 'all' || (f === 'active' ? ACTIVE_STATUSES.includes(t.status) : t.status === f);

type Sort = 'status' | 'start' | 'recent' | 'name';

const SORTS: { key: Sort; label: string }[] = [
    { key: 'status', label: 'Sort by status' },
    { key: 'start', label: 'Sort by start date' },
    { key: 'recent', label: 'Sort by newest' },
    { key: 'name', label: 'Sort by name' },
];

const time = (d: string) => new Date(d).getTime();
const rank = (t: Tournament) => STATUS[t.status]?.rank ?? 99;

const COMPARATORS: Record<Sort, ((a: Tournament, b: Tournament) => number) | null> = {
    // Open work by soonest date; finished events most recent first.
    status: (a, b) => rank(a) - rank(b) || (rank(a) >= STATUS.completed.rank
        ? time(b.startDate) - time(a.startDate)
        : time(a.startDate) - time(b.startDate)),
    start: (a, b) => time(b.startDate) - time(a.startDate),
    recent: null, // the API already returns newest-created first
    name: (a, b) => a.name.localeCompare(b.name),
};

// ─── Formatting ───────────────────────────────────────────────────────────────

const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Date-driven nudge shown under a tournament; `urgent` flags something to act on soon. */
const getHint = (t: Tournament): { text: string; urgent: boolean } | null => {
    const until = (d: string) => differenceInCalendarDays(new Date(d), new Date());
    switch (t.status) {
        case 'draft':
            return { text: 'Not yet published', urgent: false };
        case 'registration_open': {
            if (!t.registrationDeadline) return null;
            const n = until(t.registrationDeadline);
            return n < 0
                ? { text: 'Registration deadline has passed', urgent: true }
                : { text: `Registration closes ${inDays(n)}`, urgent: n <= 3 };
        }
        case 'ongoing': {
            const n = until(t.endDate);
            return n >= 0 ? { text: `Ends ${inDays(n)}`, urgent: false } : null;
        }
        case 'completed':
        case 'cancelled':
            return null;
        default: {
            const n = until(t.startDate);
            return n >= 0 ? { text: `Starts ${inDays(n)}`, urgent: n <= 3 } : null;
        }
    }
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const FIELD = cn(
    'h-8 rounded-lg border border-line bg-canvas px-2.5 text-[13px] text-fg [color-scheme:dark]',
    'placeholder:text-fg-subtle transition-colors hover:border-white/15 focus:border-white/20', FOCUS,
);
// Desktop table columns: tournament · sport · dates · status · chevron
const COLS = 'xl:grid-cols-[minmax(0,1fr)_8rem_12rem_10.5rem_1rem]';

// ─── Small pieces ─────────────────────────────────────────────────────────────

const ListMessage = ({ title, text, action, isError }: {
    title: string; text?: string; action?: ReactNode; isError?: boolean;
}) => (
    <div role={isError ? 'alert' : undefined} className="flex flex-col items-center px-6 py-14 text-center">
        {isError && <AlertCircle aria-hidden className="mb-3 h-5 w-5 text-red-400" />}
        <p className="text-sm font-medium text-fg">{title}</p>
        {text && <p className="mt-1 max-w-sm text-sm text-fg-muted">{text}</p>}
        {action && <div className="mt-5">{action}</div>}
    </div>
);

const RowSkeleton = () => (
    <li className="flex items-center gap-3 px-4 py-4 sm:px-5">
        <span className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-white/[0.05]" />
        <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 animate-pulse rounded bg-white/[0.06]" />
            <span className="block h-3 w-3/5 animate-pulse rounded bg-white/[0.04]" />
        </span>
        <span className="hidden h-5 w-24 animate-pulse rounded-md bg-white/[0.05] sm:block" />
    </li>
);

// ─── App shell ────────────────────────────────────────────────────────────────

// ─── Tournament row ───────────────────────────────────────────────────────────

const TournamentRow = ({ t }: { t: Tournament }) => {
    const sports = sportsOf(t).map(sportLabel);
    const sportText = sports.join(', ') || '—';
    const dates = formatRange(t.startDate, t.endDate);
    const venue = [t.venue?.name, t.venue?.city].filter(Boolean).join(', ');
    const hint = getHint(t);
    const quiet = QUIET_STATUSES.includes(t.status);
    const hintEl = hint && (
        <p className={cn('mt-1 text-xs', hint.urgent ? 'text-amber-300' : 'text-fg-subtle')}>{hint.text}</p>
    );

    return (
        <li>
            <Link to={`/organizer/tournament/${t._id}`}
                className={cn(
                    'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3.5 transition-colors sm:px-5 xl:gap-x-6',
                    'hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70',
                    COLS,
                )}>
                <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-xs font-semibold ring-1 ring-inset ring-line',
                        quiet ? 'text-fg-subtle' : 'text-fg-muted',
                    )}>
                        {sports[0]?.[0] ?? '·'}
                    </span>
                    <div className="min-w-0">
                        <p title={t.name} className={cn('truncate text-sm font-medium', quiet ? 'text-fg-muted' : 'text-fg')}>
                            {t.name}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-fg-subtle">
                            <span className="xl:hidden">{sportText} · {dates}{venue && ' · '}</span>{venue}
                        </p>
                        <div className="xl:hidden">{hintEl}</div>
                        <StatusBadge status={t.status} className="mt-2 sm:hidden" />
                    </div>
                </div>

                <span className="hidden truncate text-sm text-fg-muted xl:block">{sportText}</span>

                <div className="hidden xl:block">
                    <p className="text-sm tabular-nums text-fg-muted">{dates}</p>
                    {hintEl}
                </div>

                <div className="flex items-center gap-3 justify-self-end xl:justify-self-start">
                    <StatusBadge status={t.status} className="hidden sm:inline-flex" />
                    <ChevronRight aria-hidden className="h-4 w-4 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-fg xl:hidden" />
                </div>
                <ChevronRight aria-hidden className="hidden h-4 w-4 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-fg xl:block" />
            </Link>
        </li>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const OrganizerHomePage = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector(s => s.auth);
    const { myTournaments, isLoading, error } = useAppSelector(s => s.tournament);
    const isStaff = user?.role === 'staff';
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<Sort>('status');
    // Until the first request settles, an empty list means "not loaded", not "no tournaments".
    const [fetched, setFetched] = useState(false);

    const load = () => dispatch(fetchMyTournaments()).finally(() => setFetched(true));
    useEffect(() => { load(); }, []);

    const handleLogout = () => { dispatch(logout()); navigate('/login'); };
    const resetView = () => { setFilter('all'); setQuery(''); };

    const firstName = user?.firstName ?? 'Organizer';
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || firstName;
    const hasTournaments = myTournaments.length > 0;
    const loading = (!fetched || isLoading) && !hasTournaments;
    const failed = fetched && !isLoading && !!error;
    const count = (f: Filter) => myTournaments.filter(t => matchesFilter(t, f)).length;

    const q = query.trim().toLowerCase();
    const filtered = myTournaments.filter(t => matchesFilter(t, filter) && (!q ||
        [t.name, t.venue?.name, t.venue?.city, ...sportsOf(t).map(sportLabel)].some(v => v?.toLowerCase().includes(q))));
    const comparator = COMPARATORS[sort];
    const visible = comparator ? [...filtered].sort(comparator) : filtered;

    let body: ReactNode;
    if (failed) {
        body = (
            <ListMessage isError title="Couldn't load your tournaments" text={error ?? undefined}
                action={<button type="button" onClick={load} className={BTN_SECONDARY}>Try again</button>} />
        );
    } else if (loading) {
        body = (
            <ul aria-busy="true" aria-label="Loading tournaments" className="divide-y divide-line">
                {[0, 1, 2, 3].map(i => <RowSkeleton key={i} />)}
            </ul>
        );
    } else if (!hasTournaments) {
        body = isStaff ? (
            <ListMessage title="No tournaments assigned yet"
                text="Tournaments an organizer adds you to as staff will appear here." />
        ) : (
            <ListMessage title="No tournaments yet"
                text="Create your first tournament to start managing registrations, auctions and brackets in one place."
                action={<Link to="/organizer/tournament/create" className={BTN_PRIMARY}>
                    <Plus aria-hidden className="h-4 w-4" />Create your first tournament
                </Link>} />
        );
    } else if (visible.length === 0) {
        body = (
            <ListMessage
                title={q ? `No tournaments match “${query.trim()}”` : `No ${filter === 'draft' ? 'draft' : filter} tournaments`}
                text={q ? 'Check the spelling or search by venue, city or sport.' : 'Nothing in this status right now.'}
                action={<button type="button" onClick={resetView} className={BTN_SECONDARY}>Show all tournaments</button>} />
        );
    } else {
        body = (
            <>
                <div className={cn('hidden gap-x-6 border-b border-line px-5 py-2 text-xs font-medium text-fg-subtle xl:grid', COLS)}>
                    <span>Tournament</span><span>Sport</span><span>Dates</span><span>Status</span><span />
                </div>
                <ul className="divide-y divide-line">
                    {visible.map(t => <TournamentRow key={t._id} t={t} />)}
                </ul>
            </>
        );
    }

    return (
        <div className="min-h-screen bg-canvas font-ui text-fg antialiased">
            <OrganizerSidebar isStaff={isStaff} />

            <div className="md:pl-16 lg:pl-60">
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/95 px-4 sm:px-6 lg:px-8">
                    <Brand className="md:hidden" />
                    <p className="hidden text-sm text-fg-muted md:block">
                        Organizer <span aria-hidden className="mx-1.5 text-fg-subtle">/</span>
                        <span className="text-fg">Overview</span>
                    </p>
                    <AccountMenu name={fullName} email={user?.email} image={user?.profileImage} onLogout={handleLogout} />
                </header>

                <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-semibold tracking-tight text-fg font-ui!">
                                {getGreeting()}, {firstName}
                            </h1>
                            <p className="mt-1 text-sm text-fg-muted">
                                Manage your tournaments, track registrations, and keep every event running smoothly.
                            </p>
                        </div>
                        {!isStaff && (
                            <Link to="/organizer/tournament/create" className={cn(BTN_PRIMARY, 'shrink-0 self-start sm:self-auto')}>
                                <Plus aria-hidden className="h-4 w-4" />Create tournament
                            </Link>
                        )}
                    </div>

                    <section aria-label="Summary"
                        className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
                        {METRICS.map(m => (
                            <button key={m.filter} type="button" onClick={() => setFilter(m.filter)}
                                className="bg-panel px-4 py-4 text-left transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70 sm:px-5">
                                <span className="block text-[13px] text-fg-muted">{m.label}</span>
                                <span className="mt-1.5 block text-2xl font-semibold tabular-nums tracking-tight text-fg">
                                    {loading
                                        ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-white/[0.06] align-middle" />
                                        : failed ? '—' : count(m.filter)}
                                </span>
                                <span className="sr-only">, show in list</span>
                            </button>
                        ))}
                    </section>

                    <section aria-labelledby="tournaments-heading">
                        <div className="mb-3 flex items-baseline gap-2">
                            <h2 id="tournaments-heading" className="text-base font-semibold text-fg">My tournaments</h2>
                            {hasTournaments && <span className="text-sm tabular-nums text-fg-subtle">{myTournaments.length}</span>}
                        </div>

                        <div className="overflow-hidden rounded-xl border border-line bg-panel">
                            {hasTournaments && !failed && (
                                <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div role="group" aria-label="Filter by status" className="flex rounded-lg bg-canvas p-0.5 ring-1 ring-inset ring-line">
                                        {FILTERS.map(f => (
                                            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
                                                className={cn(
                                                    'flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors sm:flex-none', FOCUS,
                                                    filter === f.key ? 'bg-white/10 text-fg' : 'text-fg-muted hover:text-fg',
                                                )}>
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                                            <span className="sr-only">Search tournaments</span>
                                            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
                                            <input type="search" value={query} onChange={e => setQuery(e.target.value)}
                                                placeholder="Search tournaments" className={cn(FIELD, 'w-full pl-8')} />
                                        </label>
                                        <label className="shrink-0">
                                            <span className="sr-only">Sort tournaments</span>
                                            <select value={sort} onChange={e => setSort(e.target.value as Sort)} className={cn(FIELD, 'text-fg-muted')}>
                                                {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            )}
                            {body}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default OrganizerHomePage;
