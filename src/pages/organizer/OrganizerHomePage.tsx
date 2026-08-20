import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
    PlusCircle, Trophy, Settings, LogOut,
    ChevronRight, Loader2, MapPin, AlertCircle, BarChart3,
    Activity, TrendingUp, User, ArrowUpRight,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import HoverFooter from '@/components/HoverFooter';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { fetchMyTournaments, Tournament } from '../../store/slices/tournamentSlice';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'active' | 'completed' | 'draft';

const STATUS_CONFIG: Record<string, {
    bg: string; text: string; dotColor: string; label: string; pulse: boolean;
}> = {
    draft: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', dotColor: '#71717A', label: 'Draft', pulse: false },
    registration_open: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dotColor: '#34D399', label: 'Registration Open', pulse: true },
    registration_closed: { bg: 'bg-amber-500/10', text: 'text-amber-400', dotColor: '#FBBF24', label: 'Reg. Closed', pulse: false },
    auction_in_progress: { bg: 'bg-blue-500/10', text: 'text-blue-400', dotColor: '#60A5FA', label: 'Auction Live', pulse: true },
    ongoing: { bg: 'bg-orange-500/10', text: 'text-orange-400', dotColor: '#F97316', label: 'Ongoing', pulse: true },
    completed: { bg: 'bg-teal-500/10', text: 'text-teal-400', dotColor: '#2DD4BF', label: 'Completed', pulse: false },
    cancelled: { bg: 'bg-red-500/10', text: 'text-red-400', dotColor: '#F87171', label: 'Cancelled', pulse: false },
};

const SPORT_CONFIG: Record<string, { label: string; color: string }> = {
    badminton: { label: 'Badminton', color: '#60A5FA' },
    cricket: { label: 'Cricket', color: '#34D399' },
    football: { label: 'Football', color: '#A3E635' },
    kabaddi: { label: 'Kabaddi', color: '#F87171' },
    table_tennis: { label: 'Table Tennis', color: '#22D3EE' },
    tennis: { label: 'Tennis', color: '#FBBF24' },
};

const FILTER_TABS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'draft', label: 'Drafts' },
];

const filterTournaments = (ts: Tournament[], f: FilterType) => {
    if (f === 'active') return ts.filter(t => ['registration_open', 'ongoing', 'auction_in_progress', 'registration_closed'].includes(t.status));
    if (f === 'completed') return ts.filter(t => t.status === 'completed');
    if (f === 'draft') return ts.filter(t => t.status === 'draft');
    return ts;
};

const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const getTournamentSports = (t: Tournament): string[] => {
    const sports = (t as any).sports;
    return sports?.length ? sports : [t.sport].filter(Boolean);
};

const getSportBreakdown = (ts: Tournament[]) => {
    const counts: Record<string, number> = {};
    // A tournament hosting multiple sports counts toward each of them.
    ts.forEach(t => getTournamentSports(t).forEach(s => { counts[s] = (counts[s] ?? 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};

// ─── Animated Counter ─────────────────────────────────────────────────────────

const AnimatedCounter = ({ value }: { value: number }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const isInView = useInView(ref, { once: true });
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        if (!isInView || value === 0) { setDisplay(value); return; }
        const steps = Math.min(value * 5, 45);
        const interval = 900 / steps;
        let step = 0;
        const timer = setInterval(() => {
            step++;
            setDisplay(Math.min(Math.round(value * (1 - Math.pow(1 - step / steps, 3))), value));
            if (step >= steps) { clearInterval(timer); setDisplay(value); }
        }, interval);
        return () => clearInterval(timer);
    }, [isInView, value]);

    return <span ref={ref}>{display}</span>;
};

// ─── Subtle dot-grid background ───────────────────────────────────────────────

const PageBackground = () => (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute inset-0"
            style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.016) 1px, transparent 1px)',
                backgroundSize: '36px 36px',
            }} />
    </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
    icon: React.ElementType;
    value?: number;
    label: string;
    accentColor: string;
    delay?: number;
}

const StatCard = ({ icon: Icon, value, label, accentColor, delay = 0 }: StatCardProps) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -4, transition: { duration: 0.18, ease: 'easeOut' } }}
        className="relative rounded-2xl p-6 border border-white/8 flex flex-col gap-5 group"
        style={{ background: '#141414' }}
    >
        <div className="p-3 rounded-xl w-fit" style={{ backgroundColor: `${accentColor}18` }}>
            <Icon className="h-5 w-5" style={{ color: accentColor }} />
        </div>
        <div>
            <p className="text-4xl font-bold font-oswald text-white tracking-tight leading-none">
                {value !== undefined ? <AnimatedCounter value={value} /> : '—'}
            </p>
            <p className="text-sm text-zinc-400 mt-2 font-medium">{label}</p>
        </div>
        {/* Thin accent bottom line that appears on hover */}
        <div className="absolute bottom-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"
            style={{ backgroundColor: accentColor }} />
    </motion.div>
);

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

const FilterTabs = ({ active, onChange }: { active: FilterType; onChange: (f: FilterType) => void }) => (
    <div className="flex gap-1 p-1 rounded-xl border border-white/5" style={{ background: '#141414' }}>
        {FILTER_TABS.map((tab) => (
            <button key={tab.key} onClick={() => onChange(tab.key)}
                className={cn('relative px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 tracking-wide',
                    active === tab.key ? 'text-white' : 'text-zinc-400 hover:text-zinc-200')}>
                {active === tab.key && (
                    <motion.div layoutId="filter-pill"
                        className="absolute inset-0 rounded-lg bg-primary"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10">{tab.label}</span>
            </button>
        ))}
    </div>
);

// ─── Tournament Card ──────────────────────────────────────────────────────────

const TournamentCard = ({ tournament, index }: { tournament: Tournament; index: number }) => {
    const status = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.draft;
    const tournamentSports = getTournamentSports(tournament);
    const sportConfigs = tournamentSports.map(s => SPORT_CONFIG[s] ?? { label: s, color: '#F97316' });
    // Primary sport drives the accent bar/icon color; all sports get their own label pill below.
    const sport = sportConfigs[0] ?? { label: tournament.sport, color: '#F97316' };

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
            transition={{ duration: 0.42, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
            <Link
                to={`/organizer/tournament/${tournament._id}`}
                className="group relative flex w-full rounded-2xl overflow-hidden border border-white/7 hover:border-white/15 transition-all duration-300"
                style={{ background: '#141414' }}
            >
                {/* Left sport accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-0.75 group-hover:w-1 transition-all duration-300"
                    style={{ backgroundColor: sport.color }} />

                {/* Content */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 p-5 sm:p-6 w-full pl-7">
                    {/* Sport icon */}
                    <div className="h-13 w-13 rounded-xl shrink-0 flex items-center justify-center"
                        style={{ background: `${sport.color}12` }}>
                        <Trophy className="h-6 w-6" style={{ color: sport.color }} />
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <h3 className="text-base font-bold font-oswald text-white leading-tight truncate group-hover:text-white/90 transition-colors">
                            {tournament.name}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            {sportConfigs.map((cfg, i) => (
                                <span key={tournamentSports[i]} className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                    style={{ background: `${cfg.color}15`, color: cfg.color }}>
                                    {cfg.label}
                                </span>
                            ))}
                            {tournament.venue?.city && (
                                <>
                                    <span className="text-zinc-600 text-xs">•</span>
                                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                                        <MapPin className="h-3 w-3 shrink-0" />{tournament.venue.city}
                                    </span>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-zinc-500">
                            {new Date(tournament.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            <span className="mx-1 text-zinc-600">—</span>
                            {new Date(tournament.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>

                    {/* Status + arrow */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 shrink-0">
                        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', status.bg, status.text)}
                            style={{ borderColor: `${status.dotColor}25` }}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: status.dotColor, animation: status.pulse ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none' }} />
                            {status.label}
                        </div>
                        <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-all duration-200 group-hover:translate-x-0.5">
                            <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
};

// ─── Sport Breakdown ──────────────────────────────────────────────────────────

const SportBreakdown = ({ tournaments }: { tournaments: Tournament[] }) => {
    const breakdown = getSportBreakdown(tournaments);
    if (breakdown.length === 0) return null;
    const maxCount = Math.max(...breakdown.map(([, c]) => c), 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-white/7 p-5"
            style={{ background: '#141414' }}
        >
            <h3 className="text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase mb-4">Sport Breakdown</h3>
            <div className="flex flex-col gap-3">
                {breakdown.map(([sport, count], i) => {
                    const cfg = SPORT_CONFIG[sport] ?? { label: sport, color: '#F97316' };
                    return (
                        <div key={sport} className="flex items-center gap-3">
                            <span className="text-xs text-zinc-300 w-24 truncate shrink-0">{cfg.label}</span>
                            <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/6">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: cfg.color }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(count / maxCount) * 100}%` }}
                                    transition={{ duration: 0.8, delay: 0.7 + i * 0.08, ease: 'easeOut' }}
                                />
                            </div>
                            <span className="text-xs font-bold text-zinc-400 w-4 text-right shrink-0">{count}</span>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
};

// ─── Next Event Card ──────────────────────────────────────────────────────────

const NextEventCard = ({
    tournaments,
    onNavigate,
}: {
    tournaments: Tournament[];
    onNavigate: (id: string) => void;
}) => {
    const now = new Date();
    const upcoming = tournaments
        .filter(t => new Date(t.startDate) > now && t.status !== 'cancelled')
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const active = tournaments.filter(t =>
        ['registration_open', 'ongoing', 'auction_in_progress'].includes(t.status)
    );
    const featured = upcoming[0] ?? active[0] ?? null;
    if (!featured) return null;

    const featuredSports = getTournamentSports(featured);
    const featuredSportConfigs = featuredSports.map(s => SPORT_CONFIG[s] ?? { label: s, color: '#F97316' });
    // Primary sport drives the accent color; all sports get their own label pill below.
    const sport = featuredSportConfigs[0] ?? { label: featured.sport, color: '#F97316' };
    const status = STATUS_CONFIG[featured.status] ?? STATUS_CONFIG.draft;
    const isUpcoming = !!(upcoming[0]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
            <button
                onClick={() => onNavigate(featured._id)}
                className="relative w-full rounded-2xl p-5 overflow-hidden text-left cursor-pointer group border hover:border-white/15 transition-all duration-300"
                style={{ background: '#141414', borderColor: `${sport.color}20` }}
            >
                {/* Sport-colored top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: sport.color }} />

                <div className="flex flex-col gap-2">
                    {/* Label + arrow */}
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase">
                            {isUpcoming ? 'Upcoming' : 'Active Now'}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-200" />
                    </div>

                    {/* Sport badge(s) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {featuredSportConfigs.map((cfg, i) => (
                            <span key={featuredSports[i]} className="self-start px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{ background: `${cfg.color}18`, color: cfg.color }}>
                                {cfg.label}
                            </span>
                        ))}
                    </div>

                    {/* Name */}
                    <h4 className="font-oswald font-bold text-white text-lg leading-tight">
                        {featured.name}
                    </h4>

                    {/* Location */}
                    {featured.venue?.city && (
                        <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <MapPin className="h-3 w-3 shrink-0" />{featured.venue.city}
                        </p>
                    )}

                    {/* Dates */}
                    <p className="text-xs text-zinc-500">
                        {new Date(featured.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="mx-1 text-zinc-600">—</span>
                        {new Date(featured.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>

                    {/* Status */}
                    <div className={cn(
                        'self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border mt-1',
                        status.bg, status.text,
                    )}
                        style={{ borderColor: `${status.dotColor}25` }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: status.dotColor, animation: status.pulse ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none' }} />
                        {status.label}
                    </div>
                </div>
            </button>
        </motion.div>
    );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const Sidebar = ({
    onProfileClick,
    tournaments,
    activeTournaments,
    completedCount,
    draftCount,
    onNavigateTournament,
}: {
    onProfileClick: () => void;
    tournaments: Tournament[];
    activeTournaments: number;
    completedCount: number;
    draftCount: number;
    onNavigateTournament: (id: string) => void;
}) => (
    <div className="flex flex-col gap-4">
        {/* Next event highlight */}
        {tournaments.length > 0 && (
            <NextEventCard tournaments={tournaments} onNavigate={onNavigateTournament} />
        )}

        {/* Status overview */}
        {tournaments.length > 0 && (
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-white/7 p-5"
                style={{ background: '#141414' }}
            >
                <h3 className="text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase mb-4">Overview</h3>
                <div className="flex flex-col gap-3">
                    {[
                        { label: 'Active', value: activeTournaments, color: '#34D399' },
                        { label: 'Completed', value: completedCount, color: '#2DD4BF' },
                        { label: 'Drafts', value: draftCount, color: '#FBBF24' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-sm text-zinc-300">{label}</span>
                            </div>
                            <span className="font-oswald font-bold text-white text-lg leading-none">{value}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        )}

        {/* Sport breakdown */}
        {tournaments.length > 0 && <SportBreakdown tournaments={tournaments} />}

        {/* Quick links */}
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-white/7 overflow-hidden"
            style={{ background: '#141414' }}
        >
            <h3 className="text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase px-5 pt-5 mb-3">Quick Access</h3>
            <button onClick={onProfileClick}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors group border-t border-white/5">
                <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-zinc-500 group-hover:text-primary transition-colors" />
                    <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">My Profile</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
            </button>
        </motion.div>
    </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ onCreateClick }: { onCreateClick: () => void }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center justify-center py-20 text-center"
    >
        <div className="p-8 rounded-3xl border border-primary/15 mb-8" style={{ background: 'rgba(249,115,22,0.07)' }}>
            <Trophy className="h-14 w-14 text-primary/60" />
        </div>
        <h3 className="text-2xl font-oswald font-bold text-white mb-3 tracking-wide">No Tournaments Yet</h3>
        <p className="text-zinc-500 text-sm mb-10 max-w-xs leading-relaxed">
            Create your first tournament and start managing registrations, auctions, and brackets all in one place.
        </p>
        <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onCreateClick}
            className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-primary text-white font-bold font-oswald tracking-widest text-sm"
        >
            <PlusCircle className="h-4 w-4" />
            CREATE FIRST TOURNAMENT
        </motion.button>
    </motion.div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const OrganizerHomePage = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector(s => s.auth);
    const isStaff = user?.role === 'staff';
    const { myTournaments, isLoading, error } = useAppSelector(s => s.tournament);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

    useEffect(() => { dispatch(fetchMyTournaments()); }, [dispatch]);

    const handleLogout = () => { dispatch(logout()); navigate('/login'); };

    const firstName = user?.firstName ?? 'Organizer';
    const greeting = getGreeting();
    const activeTournaments = myTournaments.filter(t => ['registration_open', 'ongoing', 'auction_in_progress'].includes(t.status)).length;
    const completedCount = myTournaments.filter(t => t.status === 'completed').length;
    const draftCount = myTournaments.filter(t => t.status === 'draft').length;
    const filteredTournaments = filterTournaments(myTournaments, activeFilter);

    return (
        <div className="min-h-screen bg-[#0B0B0B] text-white font-montserrat relative">
            <PageBackground />

            {/* ── Sticky Navbar ──────────────────────────────────────── */}
            <motion.header
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="sticky top-0 z-50 w-full"
            >
                <div className="border-b border-white/5"
                    style={{ backdropFilter: 'blur(24px)', background: 'rgba(11,11,11,0.85)' }}>
                    <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-6 lg:px-10 py-4">
                        <Link to="/" className="flex items-center gap-3 group">
                            <img src={logo} alt="Kria Sports" className="h-9 w-auto" />
                            <span className="text-xl font-oswald font-bold tracking-[0.2em] text-white group-hover:text-primary transition-colors">
                                KRIA
                            </span>
                        </Link>

                        <div className="flex items-center gap-4">
                            {!isStaff && (
                            <motion.button
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/organizer/tournament/create')}
                                className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white text-xs font-bold font-oswald tracking-widest"
                            >
                                <PlusCircle className="h-3.5 w-3.5" />
                                CREATE TOURNAMENT
                            </motion.button>
                            )}

                            <Link to="/organizer/profile" className="flex items-center gap-3 group cursor-pointer">
                                <span className="hidden sm:block text-sm text-zinc-300 font-medium tracking-wide group-hover:text-white transition-colors">
                                    {firstName.toUpperCase()}
                                </span>
                                <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white border border-white/15 group-hover:border-primary/50 transition-all"
                                    style={{ background: '#1e1e1e' }}>
                                    {firstName[0].toUpperCase()}
                                </div>
                            </Link>

                            <button onClick={handleLogout}
                                className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 transition-colors">
                                <LogOut className="h-4 w-4" />
                                <span className="hidden sm:block font-oswald tracking-wider text-xs font-medium">LOGOUT</span>
                            </button>
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* ── Page Content ───────────────────────────────────────── */}
            <main className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-10 pt-12 pb-28">

                {/* Hero — full-width two-column */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center mb-14">
                    {/* Left: text */}
                    <div>
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: 0.15 }}
                            className="flex items-center gap-2 mb-4"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/80">{greeting}</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="text-5xl md:text-6xl xl:text-7xl font-oswald font-bold tracking-wide leading-none uppercase"
                        >
                            <span className="text-white">{firstName}</span>
                            <span className="text-primary">'s </span>
                            <span className="text-white">Dashboard</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="text-zinc-400 mt-4 text-sm max-w-md leading-relaxed"
                        >
                            {activeTournaments > 0
                                ? `${activeTournaments} active event${activeTournaments !== 1 ? 's' : ''} in progress — track registrations, run auctions & manage brackets.`
                                : 'Manage tournaments, view live registrations, and oversee your sporting events — all in one place.'}
                        </motion.p>
                    </div>

                    {/* Right: decorative trophy with orbits */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="hidden lg:flex items-center justify-center relative w-52 h-52 shrink-0"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-0 rounded-full border border-dashed border-white/8"
                        />
                        <motion.div
                            animate={{ rotate: -360 }}
                            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-8 rounded-full border border-dashed border-white/12"
                        />
                        {/* Orbit dot */}
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-0 rounded-full"
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary" />
                        </motion.div>
                        {/* Center */}
                        <div className="relative p-6 rounded-2xl border border-white/8 z-10" style={{ background: '#141414' }}>
                            <Trophy className="h-12 w-12 text-primary opacity-70" />
                        </div>
                        {/* Floating stat chips */}
                        <div className="absolute top-2 -right-6 px-2.5 py-1.5 rounded-full text-xs font-bold border border-emerald-500/20 text-emerald-400"
                            style={{ background: '#141414' }}>
                            {activeTournaments} active
                        </div>
                        <div className="absolute bottom-2 -left-6 px-2.5 py-1.5 rounded-full text-xs font-bold border border-blue-500/20 text-blue-400"
                            style={{ background: '#141414' }}>
                            {myTournaments.length} total
                        </div>
                    </motion.div>
                </div>

                {/* ── Stats Bento ────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    <StatCard icon={Activity} value={activeTournaments} label="Active Events" accentColor="#34D399" delay={0.35} />
                    <StatCard icon={BarChart3} value={myTournaments.length} label="Total Tournaments" accentColor="#60A5FA" delay={0.42} />
                    <StatCard icon={Settings} value={draftCount} label="In Draft" accentColor="#FBBF24" delay={0.49} />
                    <StatCard icon={TrendingUp} value={completedCount} label="Completed" accentColor="#2DD4BF" delay={0.56} />
                </div>

                {/* ── Two-Column: Tournaments + Sidebar ─────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8 items-start">

                    {/* Left — Tournament list */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="flex flex-col gap-6"
                    >
                        {/* Section header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-oswald font-bold tracking-wide text-white uppercase">
                                    My Tournaments
                                </h2>
                                {myTournaments.length > 0 && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-zinc-300 border border-white/10"
                                        style={{ background: '#141414' }}>
                                        {myTournaments.length}
                                    </span>
                                )}
                            </div>
                            {myTournaments.length > 0 && (
                                <FilterTabs active={activeFilter} onChange={setActiveFilter} />
                            )}
                        </div>

                        {/* Loading */}
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center py-24 gap-4">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-zinc-500 text-sm">Loading your tournaments…</p>
                            </div>
                        )}

                        {/* Error */}
                        {error && !isLoading && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex items-center gap-3 p-4 rounded-2xl border border-red-900/25 text-red-300 text-sm"
                                style={{ background: 'rgba(239,68,68,0.05)' }}>
                                <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        {/* Empty global */}
                        {!isLoading && !error && myTournaments.length === 0 && (
                            isStaff ? (
                                <div className="flex flex-col items-center py-14 text-center gap-3">
                                    <TrendingUp className="h-10 w-10 text-zinc-700" />
                                    <p className="text-zinc-500 text-sm">No tournaments assigned to you yet.</p>
                                </div>
                            ) : (
                                <EmptyState onCreateClick={() => navigate('/organizer/tournament/create')} />
                            )
                        )}

                        {/* Empty filtered */}
                        {!isLoading && !error && myTournaments.length > 0 && filteredTournaments.length === 0 && (
                            <div className="flex flex-col items-center py-14 text-center gap-3">
                                <TrendingUp className="h-10 w-10 text-zinc-700" />
                                <p className="text-zinc-500 text-sm">No tournaments in this category.</p>
                            </div>
                        )}

                        {/* List */}
                        <AnimatePresence mode="wait">
                            {!isLoading && filteredTournaments.length > 0 && (
                                <motion.div
                                    key={activeFilter}
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="flex flex-col gap-3"
                                >
                                    {filteredTournaments.map((t, i) => (
                                        <TournamentCard key={t._id} tournament={t} index={i} />
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Mobile CTA */}
                        {!isLoading && !isStaff && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.7 }}
                                className="xl:hidden mt-2"
                            >
                                <button onClick={() => navigate('/organizer/tournament/create')}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border border-primary/25 font-oswald font-bold tracking-widest text-sm text-primary hover:bg-primary/5 transition-colors"
                                    style={{ background: '#141414' }}>
                                    <PlusCircle className="h-4 w-4" />
                                    CREATE TOURNAMENT
                                </button>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Right — Sidebar (sticky) */}
                    <div className="hidden xl:block xl:sticky xl:top-24">
                        <Sidebar
                            onProfileClick={() => navigate('/organizer/profile')}
                            tournaments={myTournaments}
                            activeTournaments={activeTournaments}
                            completedCount={completedCount}
                            draftCount={draftCount}
                            onNavigateTournament={(id) => navigate(`/organizer/tournament/${id}`)}
                        />
                    </div>
                </div>
            </main>

            <HoverFooter />
        </div>
    );
};

export default OrganizerHomePage;
