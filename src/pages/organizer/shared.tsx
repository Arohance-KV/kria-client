// Visual building blocks shared by the organizer dashboard and tournament workspace.
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronDown, LayoutGrid, LifeBuoy, LogOut, LucideIcon, Plus, UserRound } from 'lucide-react';
import logo from '@/assets/logo.png';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { sportRegistry } from '@/sports/registry';
import type { Tournament } from '@/store/slices/tournamentSlice';
import { cn } from '@/lib/utils';

// ─── Status model ─────────────────────────────────────────────────────────────

export type Tone = 'green' | 'blue' | 'amber' | 'neutral' | 'red';

// `rank` drives the dashboard's default sort: work that needs the organizer now comes first.
export const STATUS: Record<string, { label: string; tone: Tone; rank: number }> = {
    ongoing: { label: 'In progress', tone: 'green', rank: 0 },
    auction_in_progress: { label: 'Auction live', tone: 'green', rank: 1 },
    registration_open: { label: 'Registration open', tone: 'green', rank: 2 },
    registration_closed: { label: 'Registration closed', tone: 'blue', rank: 3 },
    draft: { label: 'Draft', tone: 'amber', rank: 4 },
    completed: { label: 'Completed', tone: 'neutral', rank: 5 },
    cancelled: { label: 'Cancelled', tone: 'red', rank: 6 },
    // Category statuses (server ICategoryStatus); `ongoing` and `completed` are shared with tournaments.
    setup: { label: 'Setup', tone: 'amber', rank: 4 },
    registration: { label: 'Registration open', tone: 'green', rank: 2 },
    auction: { label: 'Auction', tone: 'green', rank: 1 },
    groups_configured: { label: 'Groups set', tone: 'blue', rank: 3 },
    bracket_configured: { label: 'Bracket ready', tone: 'blue', rank: 3 },
};

export const TONE: Record<Tone, { badge: string; dot: string }> = {
    green: { badge: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20', dot: 'bg-emerald-400' },
    blue: { badge: 'bg-sky-400/10 text-sky-300 ring-sky-400/20', dot: 'bg-sky-400' },
    amber: { badge: 'bg-amber-400/10 text-amber-300 ring-amber-400/20', dot: 'bg-amber-400' },
    neutral: { badge: 'bg-white/[0.04] text-fg-muted ring-white/10', dot: 'bg-zinc-500' },
    red: { badge: 'bg-red-400/10 text-red-300 ring-red-400/20', dot: 'bg-red-400' },
};

const LIVE_STATUSES = ['ongoing', 'auction_in_progress'];

export const statusOf = (status: string) => STATUS[status] ?? { label: status, tone: 'neutral' as Tone, rank: 99 };

// Match status (server: scheduled | in_progress | completed | cancelled | walkover). A match
// still missing a competitor reads as "Waiting" whatever its stored status.
export const MATCH_STATUS: Record<string, { label: string; tone: Tone; live?: boolean }> = {
    scheduled: { label: 'Upcoming', tone: 'neutral' },
    in_progress: { label: 'Live', tone: 'red', live: true },
    completed: { label: 'Done', tone: 'green' },
    walkover: { label: 'Walkover', tone: 'neutral' },
    cancelled: { label: 'Cancelled', tone: 'neutral' },
    waiting: { label: 'Waiting', tone: 'neutral' },
};

// ─── Formatting ───────────────────────────────────────────────────────────────

export const sportsOf = (t: Pick<Tournament, 'sport' | 'sports'>) => (t.sports?.length ? t.sports : [t.sport]).filter(Boolean);

export const sportLabel = (key: string) =>
    sportRegistry.get(key)?.displayName ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const formatRange = (start: string, end: string) => {
    const a = new Date(start), b = new Date(end);
    if (a.getFullYear() !== b.getFullYear()) return `${format(a, 'd MMM yyyy')} – ${format(b, 'd MMM yyyy')}`;
    if (a.getMonth() !== b.getMonth()) return `${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}`;
    return a.getDate() === b.getDate() ? format(a, 'd MMM yyyy') : `${format(a, 'd')}–${format(b, 'd MMM yyyy')}`;
};

export const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

/** Indian-grouped rupees; keeps paise only when there are any. */
export const inr = (n: number) =>
    `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;

export const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

// ─── Styles ───────────────────────────────────────────────────────────────────

export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
const BTN = cn('inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', FOCUS);
export const BTN_PRIMARY = cn(BTN, 'bg-primary font-semibold text-canvas hover:bg-orange-400');
export const BTN_SECONDARY = cn(BTN, 'border border-line bg-raised text-fg hover:bg-white/[0.08]');
export const BTN_GHOST = cn(BTN, 'text-fg-muted hover:bg-white/[0.05] hover:text-fg');
export const BTN_DANGER = cn(BTN, 'text-red-300 ring-1 ring-inset ring-red-400/25 hover:bg-red-400/10');
export const BTN_DANGER_SOLID = cn(BTN, 'bg-red-600 font-semibold text-white hover:bg-red-700');
/** Add to any BTN_* for the compact row/toolbar size. */
export const BTN_SM = 'h-8 px-3 text-[13px]';

// ─── Components ───────────────────────────────────────────────────────────────

/** Coloured status pill: a dot plus a readable label, so status never relies on colour alone. */
export const ToneBadge = ({ label, tone, live, className }: { label: string; tone: Tone; live?: boolean; className?: string }) => (
    <span className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE[tone].badge, className,
    )}>
        <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TONE[tone].dot, live && 'animate-pulse')} />
        {label}
    </span>
);

export const StatusBadge = ({ status, className }: { status: string; className?: string }) => {
    const s = statusOf(status);
    return <ToneBadge label={s.label} tone={s.tone} live={LIVE_STATUSES.includes(status)} className={className} />;
};

const Avatar = ({ name, src }: { name: string; src?: string }) => src ? (
    <img src={src} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-line" />
) : (
    <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-raised text-xs font-semibold text-fg ring-1 ring-line">
        {name[0]?.toUpperCase()}
    </span>
);

export const Brand = ({ className }: { className?: string }) => (
    <Link to="/" aria-label="KRIA home" className={cn('flex items-center gap-2.5 rounded-md', FOCUS, className)}>
        <img src={logo} alt="" className="h-7 w-auto" />
        <span className="font-oswald text-[15px] font-semibold tracking-[0.22em] text-fg">KRIA</span>
    </Link>
);

const SideLink = ({ to, icon: Icon, label, end }: { to: string; icon: LucideIcon; label: string; end?: boolean }) => (
    <NavLink to={to} end={end} title={label}
        className={({ isActive }) => cn(
            'relative flex h-9 items-center justify-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors lg:justify-start',
            FOCUS, isActive ? 'bg-white/[0.06] text-fg' : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg',
        )}>
        {({ isActive }) => (
            <>
                {isActive && <span aria-hidden className="absolute -left-2.5 top-2 bottom-2 w-0.5 rounded-full bg-primary" />}
                <Icon aria-hidden className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                <span className="sr-only lg:not-sr-only">{label}</span>
            </>
        )}
    </NavLink>
);

/** Left rail of the organizer's own pages (dashboard, new tournament, profile). Hidden on phones; the account menu covers them. */
export const OrganizerSidebar = ({ isStaff }: { isStaff: boolean }) => (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r border-line bg-canvas md:flex lg:w-60">
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-line lg:justify-start lg:px-5">
            <Brand className="[&>span]:hidden lg:[&>span]:inline" />
        </div>
        <nav aria-label="Organizer" className="flex-1 space-y-0.5 p-2.5">
            <SideLink to="/organizer/home" icon={LayoutGrid} label="Overview" end />
            {!isStaff && <SideLink to="/organizer/tournament/create" icon={Plus} label="New tournament" />}
            <SideLink to="/organizer/profile" icon={UserRound} label="Profile" />
        </nav>
        <div className="border-t border-line p-2.5">
            <SideLink to="/support" icon={LifeBuoy} label="Help & support" />
        </div>
    </aside>
);

export const AccountMenu = ({ name, email, image, onLogout }: {
    name: string; email?: string; image?: string; onLogout: () => void;
}) => {
    const [open, setOpen] = useState(false);
    const item = cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg-muted transition-colors',
        'hover:bg-white/[0.05] hover:text-fg focus-visible:bg-white/[0.06] focus-visible:text-fg focus-visible:outline-none',
    );
    const close = () => setOpen(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger aria-label="Account menu"
                className={cn('flex shrink-0 items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-white/[0.05]', FOCUS)}>
                <Avatar name={name} src={image} />
                <span className="hidden max-w-40 truncate text-sm text-fg sm:block">{name}</span>
                <ChevronDown aria-hidden className="h-3.5 w-3.5 text-fg-subtle" />
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-64 rounded-xl border-line bg-panel p-1.5 font-ui">
                <div className="mb-1 border-b border-line px-2.5 pb-2.5 pt-1.5">
                    <p className="truncate text-sm font-medium text-fg">{name}</p>
                    {email && <p className="truncate text-xs text-fg-subtle">{email}</p>}
                </div>
                <Link to="/organizer/home" onClick={close} className={cn(item, 'md:hidden')}>
                    <LayoutGrid aria-hidden className="h-4 w-4" />All tournaments
                </Link>
                <Link to="/organizer/profile" onClick={close} className={item}>
                    <UserRound aria-hidden className="h-4 w-4" />Profile
                </Link>
                <Link to="/support" onClick={close} className={item}>
                    <LifeBuoy aria-hidden className="h-4 w-4" />Help & support
                </Link>
                <div className="my-1 h-px bg-line" />
                <button type="button" onClick={onLogout} className={cn(item, 'hover:text-red-300')}>
                    <LogOut aria-hidden className="h-4 w-4" />Log out
                </button>
            </PopoverContent>
        </Popover>
    );
};
