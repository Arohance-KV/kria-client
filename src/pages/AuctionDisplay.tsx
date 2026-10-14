// Public auction screen (no login), built for a TV or projector: the player on the block, the live bid,
// every team's purse, then the final squads. Follows the organizer's console through the shared socket.
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { auctionApi, AuctionState, SoldLog } from '@/api/auction';
import SpinTheWheel from '@/components/SpinTheWheel';
import { socket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import { BTN_SECONDARY, initials, inr } from './organizer/shared';

type Mark = { name: string; logo?: string; primaryColor?: string };

// Big screens (≥1100×640) fit the live board in one viewport; smaller ones stack and scroll.
const FIT = '[@media(min-width:1100px)_and_(min-height:640px)]:h-dvh [@media(min-width:1100px)_and_(min-height:640px)]:overflow-hidden';
const CARD = 'min-w-0 rounded-[14px] border border-line bg-panel';
const EYEBROW = 'text-[clamp(11px,.75vw,13px)] font-semibold uppercase tracking-[.12em] text-fg-subtle';
const PILL = 'inline-flex h-7 items-center gap-[7px] whitespace-nowrap rounded-full px-3 text-xs font-semibold uppercase tracking-[.08em]';
const AMBER = 'bg-[rgba(251,191,36,.12)] text-[#FBBF24]';
const CHIP = 'inline-flex h-[26px] items-center whitespace-nowrap rounded-full bg-[rgba(10,10,11,.75)] px-2.5 text-xs font-semibold text-fg shadow-[inset_0_0_0_1px_#2E2E33] backdrop-blur-[6px]';
const MINI = 'grid min-w-0 flex-[1_1_0] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 rounded-[10px] bg-white/[.03] px-2.5 py-2';
const MINI_SUB = 'flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[clamp(11.5px,.78vw,13.5px)] text-fg-muted';
const FACT_DD = 'm-0 font-oswald text-[clamp(22px,2vw,36px)] font-semibold leading-[1.1] tabular-nums';

const cap = (s?: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const orList = (names: string[]) => names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] ?? '';

/** An image URL until it fails to load; then undefined, so the caller shows initials instead. */
function useSrc(src?: string | null) {
    const [bad, setBad] = useState<string>();
    return [src && src !== bad ? src : undefined, () => setBad(src ?? undefined)] as const;
}

/** A team's logo, or its initials on the team colour (TeamLogo's rule in organizer/ui.tsx). */
function Logo({ t, className }: { t: Mark; className: string }) {
    const [src, onError] = useSrc(t.logo);
    return src
        ? <img src={src} alt="" onError={onError} className={cn('shrink-0 rounded-[22%] object-contain', className)} />
        : <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-[22%] font-oswald font-bold leading-none tracking-[.02em] text-canvas', className)}
            style={{ background: t.primaryColor || '#71717A' }}>{initials(t.name)}</span>;
}

/** A player's photo, or their initials. */
function Face({ name, src, className }: { name: string; src?: string | null; className: string }) {
    const [url, onError] = useSrc(src);
    return (
        <span aria-hidden className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full bg-raised font-semibold text-fg-muted shadow-[inset_0_0_0_1px_#2E2E33]', className)}>
            {url ? <img src={url} alt="" onError={onError} className="h-full w-full object-cover" /> : initials(name)}
        </span>
    );
}

function Photo({ name, src, skill }: { name: string; src?: string; skill: string }) {
    const [url, onError] = useSrc(src);
    return (
        <div aria-hidden className="relative grid aspect-square max-w-full place-items-center overflow-hidden rounded-[10px] bg-[linear-gradient(160deg,#26262B,#141416)] shadow-[inset_0_0_0_1px_#2E2E33] min-[700px]:aspect-[4/5] min-[700px]:rounded-xl min-[1100px]:max-h-[62vh]">
            {url
                ? <img src={url} alt="" onError={onError} className="absolute inset-0 h-full w-full object-cover" />
                : <span className="font-oswald text-[40px] font-semibold leading-none text-[rgba(244,242,238,.16)] min-[700px]:text-[clamp(64px,7vw,140px)]">{initials(name)}</span>}
            {skill && <span className={cn(CHIP, 'absolute bottom-3 left-3 hidden min-[700px]:inline-flex')}>{skill}</span>}
        </div>
    );
}

/** Scales the element up for a moment whenever `value` rises. */
function useBump(value: number) {
    const ref = useRef<HTMLParagraphElement>(null);
    const last = useRef(value);
    useEffect(() => {
        const rose = value > last.current;
        last.current = value;
        if (!rose || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const calm = { transform: 'scale(1)', textShadow: '0 0 0 transparent' };
        ref.current?.animate?.([calm, { transform: 'scale(1.06)', textShadow: '0 0 36px rgba(249,115,22,.55)', offset: 0.35 }, calm],
            { duration: 600, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }, [value]);
    return ref;
}

export default function AuctionDisplay() {
    const { tournamentId = '', categoryId = '' } = useParams();
    const [state, setState] = useState<AuctionState>();
    const [failed, setFailed] = useState<'missing' | 'error' | null>(null);
    const [log, setLog] = useState<SoldLog | null>(null);
    const [offline, setOffline] = useState(false);

    const load = useCallback(() => auctionApi.getStatus(tournamentId, categoryId)
        .then(d => {
            if (!d) throw new Error('Empty auction status');
            setState(d); setFailed(null);
        })
        .catch(e => setFailed((e as { response?: { status?: number } })?.response?.status === 404 ? 'missing' : 'error')),
    [tournamentId, categoryId]);
    const loadLog = useCallback(() => auctionApi.getSoldLog(tournamentId, categoryId)
        .then(setLog)
        .catch(() => { /* the lists stay as they were */ }),
    [tournamentId, categoryId]);

    // Same pattern as the organizer console (AuctionSection.tsx): join now and on every connect,
    // since rooms don't survive a reconnect; a reconnect also refetches what was missed.
    useEffect(() => {
        if (!tournamentId || !categoryId) return;
        load();
        const room = { tournamentId, categoryId };
        let seen = false;
        const onConnect = () => {
            socket.emit('join:auction', room);
            if (seen) { load(); loadLog(); }
            seen = true;
            setOffline(false);
        };
        const onDisconnect = () => { if (seen) setOffline(true); };
        const onUpdate = (d: AuctionState) => {
            if (!d.category || String(d.category._id) === categoryId) { setState(d); setFailed(null); }
        };
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('auction:update', onUpdate);
        socket.connect();
        if (socket.connected && !seen) { socket.emit('join:auction', room); seen = true; }
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('auction:update', onUpdate);
            socket.emit('leave:auction', room);
            socket.disconnect();
        };
    }, [tournamentId, categoryId, load, loadLog]);

    const logsCount = state?.auction.logsCount;
    useEffect(() => {
        if (logsCount != null) loadLog();
    }, [logsCount, loadLog]);

    const shell = (body: ReactNode, fit = false) => (
        <div className={cn('flex min-h-dvh flex-col bg-canvas font-ui text-[14px] leading-normal text-fg [color-scheme:dark]', fit && FIT)}>{body}</div>
    );

    if (!state) {
        if (!failed) return shell(
            <div role="status" className="grid flex-1 place-items-center">
                <span className="flex items-center gap-3 text-fg-muted"><Loader2 aria-hidden className="h-5 w-5 animate-spin" />Loading the auction…</span>
            </div>,
        );
        return shell(
            <main className="grid flex-1 place-content-center justify-items-center gap-3 p-6 text-center">
                <h1 className="font-oswald text-[clamp(32px,4vw,56px)] font-semibold uppercase leading-none">
                    {failed === 'missing' ? 'Auction not found' : "The auction didn't load"}
                </h1>
                <p className="max-w-[46ch] text-fg-muted">
                    {failed === 'missing' ? "Check the link. If the organizer hasn't set this auction up yet, try again once they have." : 'Check your connection and try again.'}
                </p>
                <button type="button" onClick={() => { setFailed(null); load(); }} className={cn(BTN_SECONDARY, 'mt-2')}>Try again</button>
            </main>,
        );
    }

    const status = state.auction.status;
    if (status === 'not_started') return shell(<><Header s={state} pill="soon" offline={offline} /><Lobby s={state} /></>);
    if (status === 'completed') return shell(<><Header s={state} pill="done" offline={offline} /><Final s={state} log={log} /></>);
    return shell(<><Header s={state} pill={status === 'paused' ? 'paused' : 'live'} offline={offline} /><Board s={state} log={log} /></>, true);
}

// ─── Header ───────────────────────────────────────────────────────────────────

const PILLS = {
    live: [cn(PILL, 'bg-[rgba(248,113,113,.10)] text-[#F87171] shadow-[inset_0_0_0_1px_rgba(248,113,113,.25)]'), 'Live'],
    paused: [cn(PILL, AMBER, 'shadow-[inset_0_0_0_1px_rgba(251,191,36,.25)]'), 'Paused'],
    soon: [cn(PILL, 'bg-white/5 text-fg-muted shadow-[inset_0_0_0_1px_#2E2E33]'), 'Starts soon'],
    done: [cn(PILL, 'bg-white/5 text-fg-muted shadow-[inset_0_0_0_1px_#2E2E33]'), 'Finished'],
} as const;

function Header({ s, pill, offline }: { s: AuctionState; pill: keyof typeof PILLS; offline: boolean }) {
    const a = s.auction;
    const [cls, label] = PILLS[pill];
    return (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-canvas px-4 py-2.5 min-[700px]:flex-nowrap min-[700px]:gap-4 min-[700px]:px-[clamp(16px,2vw,32px)] min-[700px]:py-3">
            <img src={logo} alt="KRIA" className="h-[26px] w-auto shrink-0" />
            <div className="min-w-0 flex-[1_1_60%] min-[700px]:flex-1">
                <p className="truncate text-[clamp(15px,1.1vw,20px)] font-semibold leading-[1.2]">{s.tournament?.name}</p>
                <p className="text-[clamp(12px,.8vw,14px)] text-fg-muted">{[s.category?.name, 'player auction'].filter(Boolean).join(' · ')}</p>
            </div>
            {(pill === 'live' || pill === 'paused') && (
                <p className="order-3 basis-full whitespace-nowrap text-[clamp(12px,.85vw,15px)] tabular-nums text-fg-muted min-[700px]:order-none min-[700px]:basis-auto min-[700px]:text-right">
                    Round {a.rotationCount + 1} · <b className="font-semibold text-fg">{Math.min(a.currentPlayerIndex + 1, a.totalPlayers)}</b> of {a.totalPlayers} · {a.remainingCount} left
                </p>
            )}
            {offline && <span role="status" className={cn(PILL, AMBER, 'font-medium normal-case tracking-[.02em]')}>Reconnecting…</span>}
            <span className={cls}>
                {pill === 'live' && <i aria-hidden className="h-2 w-2 rounded-full bg-[#F87171] motion-safe:animate-pulse" />}{label}
            </span>
        </header>
    );
}

// ─── Live board: stage, purses, band ──────────────────────────────────────────

/** Purse row tints; text says the same thing ("Leading", "Bought", "Can't reach ₹X"). */
const ROW_TONE = {
    lead: 'bg-primary/12 shadow-[inset_0_0_0_1px_rgba(249,115,22,.35)]',
    bought: 'bg-[rgba(134,239,172,.08)] shadow-[inset_0_0_0_1px_rgba(134,239,172,.3)]',
    out: 'opacity-45',
    '': '',
};
const TAG_TONE: Record<keyof typeof ROW_TONE, string> = { lead: 'font-semibold text-primary', bought: 'font-semibold text-[#86EFAC]', out: '', '': '' };

function Board({ s, log }: { s: AuctionState; log: SoldLog | null }) {
    const a = s.auction;
    const lb: Partial<AuctionState['auction']['liveBid']> = a.liveBid ?? {};
    const teams = s.teams ?? [];
    const teamOf = (id?: string | null) => teams.find(t => t._id === id);
    const p = s.currentPlayer;
    const name = p ? `${p.profile.firstName} ${p.profile.lastName}` : '';
    const base = p?.auctionData?.basePrice ?? 0;

    // Bid maths and "can't reach" are the organizer console's rule (AuctionSection.tsx, teamButton:
    // "Can't afford" when budget < (atLimit ? limit : nextPrice)), duplicated so that file stays untouched.
    const limit = a.settings?.hardLimit || 0;
    const price = lb.currentPrice || 0;
    const next = price + (a.settings?.minBidIncrement || 0);
    const atLimit = limit > 0 && price >= limit;
    const need = atLimit ? limit : next;
    const tied = lb.tiedTeams ?? [];
    const history = lb.bidHistory ?? [];
    const amount = price || base;
    const bump = useBump(amount);

    const paused = a.status === 'paused';
    const sold = a.status === 'sold';
    const r = sold ? a.lastSoldResult : undefined;
    const buyer = r ? teamOf(r.teamId) ?? teams.find(t => t.name === r.teamName) : undefined;
    const buyerColor = buyer?.primaryColor || r?.teamColor || '#F97316';
    const tie = !sold && !!lb.tieBreakerActive && tied.length >= 2;
    const leader = teamOf(lb.highestBidderId);
    const leaderName = leader?.name ?? lb.highestBidderName;
    const pct = limit > base ? Math.min(100, Math.max(0, ((amount - base) / (limit - base)) * 100)) : 0;

    const tagOf = (t: (typeof teams)[number]): [keyof typeof ROW_TONE, string] => {
        if (sold) return buyer?._id === t._id ? ['bought', 'Bought'] : ['', plural(t.playersCount ?? 0, 'player')];
        if (atLimit ? tied.includes(t._id) : lb.highestBidderId === t._id) return ['lead', atLimit && tied.length > 1 ? 'Matched' : 'Leading'];
        if (t.budget < need) return ['out', `Can’t reach ${inr(need)}`];
        return ['', plural(t.playersCount ?? 0, 'player')];
    };

    const veil = paused && (
        <div role="status" className="absolute inset-0 z-[3] grid place-items-center bg-[rgba(10,10,11,.74)]">
            <div className="grid gap-1.5 p-4 text-center">
                <b className="font-oswald text-[clamp(32px,3.2vw,60px)] font-semibold uppercase leading-none tracking-[.04em] text-[#FBBF24]">Bidding paused</b>
                <span className="text-[clamp(14px,1vw,18px)] text-fg-muted">Back shortly. This screen updates by itself.</span>
            </div>
        </div>
    );
    const STAGE = cn(CARD, 'relative grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3.5 overflow-hidden p-3.5 min-[700px]:grid-cols-[minmax(200px,.8fr)_minmax(0,1.25fr)] min-[700px]:items-center min-[700px]:gap-[clamp(16px,2vw,36px)] min-[700px]:p-[clamp(16px,1.8vw,32px)]');

    const stage = tie ? (
        <section aria-label="Tie-break" className={STAGE}>
            <div className="col-span-full grid grid-cols-1 items-center justify-center justify-items-center gap-[clamp(20px,3vw,56px)] text-center min-[700px]:grid-cols-[auto_minmax(0,1fr)] min-[700px]:justify-items-stretch min-[700px]:text-left">
                <SpinTheWheel
                    tiedTeams={tied.map(id => {
                        const t = teamOf(id);
                        return { id, name: t?.name || 'Unknown', color: t?.primaryColor || '#64748b' };
                    })}
                    hardLimit={limit}
                    interactive={false}
                    externalWinnerId={lb.spinWinnerId}
                    externalSpinStartedAt={lb.spinStartedAt}
                />
                <div>
                    <span className={EYEBROW}>Tie-break{name && ` · ${name}`}</span>
                    <h2 className="mt-1 font-oswald text-[clamp(32px,3.4vw,64px)] font-semibold uppercase leading-none">{orList(tied.map(id => teamOf(id)?.name ?? 'Unknown'))}</h2>
                    <p className="mt-2 max-w-[34ch] text-[clamp(15px,1.1vw,20px)] text-fg-muted">
                        {tied.length === 2 ? 'Both teams' : `All ${tied.length} teams`} bid the {inr(limit)} limit. The wheel decides who gets {p?.profile.firstName || 'this player'}.
                    </p>
                </div>
            </div>
            {veil}
        </section>
    ) : (
        <section aria-label="On the block" className={STAGE}>
            {p ? <>
                <Photo name={name} src={p.profile.photo} skill={cap(p.profile.skillLevel)} />
                <div className="contents min-[700px]:grid min-[700px]:min-w-0 min-[700px]:gap-[clamp(10px,1.2vh,18px)]">
                    <div className="grid content-start gap-2 max-[699px]:col-start-2">
                        <span className={EYEBROW}>On the block · #{a.currentPlayerIndex + 1}</span>
                        <h1 className="font-oswald text-[30px] font-semibold uppercase leading-[.98] text-balance wrap-anywhere min-[700px]:text-[clamp(38px,4.4vw,84px)]">{name}</h1>
                        <p className="text-[clamp(14px,1vw,18px)] text-fg-muted">{[p.profile.age, cap(p.profile.gender), cap(p.profile.skillLevel)].filter(Boolean).join(' · ')}</p>
                    </div>
                    {p.careerStats && (
                        <dl className="flex flex-wrap gap-x-[clamp(16px,1.6vw,28px)] gap-y-2 max-[699px]:col-span-full">
                            {([['Played', p.careerStats.matchesPlayed], ['Won', p.careerStats.matchesWon], ['Points', p.careerStats.pointsContributed], ['Tournaments', p.careerStats.tournamentsPlayed]] as const).map(([k, v]) => (
                                <div key={k} className="grid">
                                    <dt className="text-[clamp(11px,.72vw,13px)] text-fg-subtle">{k}</dt>
                                    <dd className="font-oswald text-[clamp(18px,1.5vw,28px)] font-semibold leading-[1.1] tabular-nums">{v ?? 0}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                    <div className="grid gap-2.5 border-t border-line pt-[clamp(12px,1.6vh,22px)] max-[699px]:col-span-full">
                        <div className="flex flex-wrap items-end justify-between gap-4 pb-[clamp(6px,1vh,14px)]">
                            <div>
                                <p className={EYEBROW}>{lb.highestBidderId || history.length ? 'Current bid' : 'Base price'}</p>
                                <p ref={bump} aria-live="polite" className="font-oswald text-[60px] font-bold leading-[.9] tracking-[-.01em] text-primary tabular-nums min-[700px]:text-[clamp(64px,7.4vw,148px)]">{inr(amount)}</p>
                            </div>
                            <div className="grid justify-items-start gap-1.5 text-left min-[700px]:justify-items-end min-[700px]:text-right">
                                {leaderName ? <>
                                    <span className="text-[clamp(12px,.8vw,14px)] text-fg-subtle">{atLimit && tied.length > 1 ? `Tied at the limit · ${tied.length} teams` : 'Highest bid'}</span>
                                    <span className="inline-flex items-center gap-2.5 font-oswald text-[clamp(18px,1.6vw,30px)] font-semibold uppercase leading-[1.1]">
                                        <Logo t={leader ?? { name: leaderName }} className="h-10 w-10 text-sm" />{leaderName}
                                    </span>
                                </> : <span className="text-[clamp(12px,.8vw,14px)] text-fg-subtle">Waiting for the first bid</span>}
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            {limit > 0 && (
                                <div aria-hidden className="relative h-2 rounded-full bg-white/[.06]">
                                    <span className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                                </div>
                            )}
                            <p className="flex justify-between gap-2 text-[clamp(12px,.8vw,14px)] tabular-nums text-fg-muted">
                                <span>Base {inr(base)}</span>
                                <span>{atLimit ? 'Limit reached' : <>Next bid <b className="font-semibold text-fg">{inr(next)}</b></>}</span>
                                <span>{limit ? `Limit ${inr(limit)}` : 'No limit'}</span>
                            </p>
                        </div>
                        {history.length > 0 && (
                            <ol aria-label="Recent bids" className="flex flex-wrap gap-1.5 [@media(min-width:1100px)_and_(max-height:820px)]:h-7 [@media(min-width:1100px)_and_(max-height:820px)]:overflow-hidden">
                                {history.slice(-5).reverse().map((b, i) => (
                                    <li key={`${b.teamId}${b.amount}`} className={cn('inline-flex h-7 items-center gap-[7px] whitespace-nowrap rounded-full bg-white/[.04] pl-1 pr-2.5 text-[12.5px] text-fg-muted',
                                        i === 0 && 'bg-primary/12 text-fg shadow-[inset_0_0_0_1px_rgba(249,115,22,.3)]', i > 2 && 'max-[699px]:hidden')}>
                                        <Logo t={teamOf(b.teamId) ?? { name: b.teamName }} className="h-5 w-5 rounded-full text-[8px]" />
                                        {b.teamName} <b className="font-semibold tabular-nums">{inr(b.amount)}</b>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            </> : (
                <p className="col-span-full py-16 text-center text-[clamp(16px,1.3vw,22px)] text-fg-muted">The next player comes up in a moment.</p>
            )}
            {r && (
                <div role="status" className="absolute inset-0 z-[3] grid place-items-center backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                    style={{ background: `color-mix(in srgb, ${buyerColor} 16%, rgba(10,10,11,.86))` }}>
                    <div className="grid justify-items-center gap-2.5 p-4 text-center motion-safe:animate-in motion-safe:zoom-in-125 motion-safe:duration-500">
                        <span className="-rotate-3 rounded-[14px] border-[length:clamp(4px,.45vw,8px)] px-[.28em] pb-[.02em] pt-[.06em] font-oswald text-[clamp(64px,9vw,170px)] font-bold leading-[.85] tracking-[.04em] text-fg"
                            style={{ borderColor: buyerColor }}>Sold</span>
                        <span className="mt-2.5 text-[clamp(14px,1vw,18px)] text-fg-muted">to</span>
                        <span className="inline-flex items-center gap-3.5 font-oswald text-[clamp(26px,3vw,56px)] font-semibold uppercase leading-none" style={{ color: buyerColor }}>
                            <Logo t={buyer ?? { name: r.teamName, primaryColor: buyerColor }} className="h-[clamp(48px,4.8vw,90px)] w-[clamp(48px,4.8vw,90px)] text-[clamp(16px,1.6vw,30px)]" />{r.teamName}
                        </span>
                        <span className="font-oswald text-[clamp(34px,3.6vw,68px)] font-bold leading-none tabular-nums">{inr(r.soldPrice)}</span>
                        <span className="text-[clamp(14px,1vw,18px)] text-fg-muted">{r.playerName}</span>
                    </div>
                </div>
            )}
            {veil}
        </section>
    );

    const purses = (
        <section aria-label="Team purses" className={cn(CARD, 'flex min-h-0 flex-col overflow-hidden')}>
            <header className="flex items-baseline justify-between border-b border-line px-4 pb-2.5 pt-3.5">
                <h2 className={EYEBROW}>Team purses</h2><span className={EYEBROW}>Left · squad</span>
            </header>
            <ul data-lenis-prevent className="grid gap-1 overflow-auto p-1.5 min-[700px]:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] min-[1100px]:grid-cols-1">
                {teams.map(t => {
                    const [kind, tag] = tagOf(t);
                    const pct = t.initialBudget ? Math.min(100, Math.max(0, (t.budget / t.initialBudget) * 100)) : 0;
                    return (
                        <li key={t._id} className={cn('grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-[10px] px-2.5 py-[clamp(8px,1vh,13px)] transition-[background-color,opacity] duration-[400ms]', ROW_TONE[kind])}>
                            <Logo t={t} className="row-span-2 h-[clamp(34px,2.4vw,46px)] w-[clamp(34px,2.4vw,46px)] text-[clamp(12px,.85vw,16px)]" />
                            <span className="truncate font-oswald text-[clamp(15px,1.05vw,20px)] font-semibold uppercase leading-[1.2]">{t.name}</span>
                            <span className="text-right font-oswald text-[clamp(16px,1.2vw,22px)] font-semibold leading-[1.1] tabular-nums">{inr(t.budget)}<span className="sr-only"> left</span></span>
                            <span aria-hidden className="flex min-w-0 items-center">
                                <span className="h-1 min-w-10 flex-1 overflow-hidden rounded-full bg-white/[.06]">
                                    <i className="block h-full rounded-full transition-[width] duration-[600ms] motion-reduce:transition-none" style={{ width: `${pct}%`, background: t.primaryColor || '#71717A' }} />
                                </span>
                            </span>
                            <span className={cn('whitespace-nowrap text-right text-[clamp(11px,.72vw,12.5px)] text-fg-subtle', TAG_TONE[kind])}>{tag}</span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );

    const BAND_CARD = cn(CARD, 'grid content-start gap-2.5 px-4 pb-3.5 pt-3');
    const ROW = 'flex gap-[clamp(8px,1vw,16px)] overflow-hidden max-[699px]:flex-col';
    const recent = (log?.logs ?? []).slice(-3).reverse();
    const upNext = (s.upcoming ?? []).slice(0, 3);
    const unsold = s.unsold ?? [];
    const band = (
        <div className="col-span-full grid gap-3 min-[700px]:grid-cols-2 min-[700px]:gap-[clamp(12px,1.2vw,20px)] min-[1100px]:grid-cols-[1.3fr_1.3fr_.8fr]">
            <section aria-label="Recently sold" className={BAND_CARD}>
                <h2 className={EYEBROW}>Recently sold</h2>
                {recent.length ? (
                    <ul className={ROW}>
                        {recent.map(l => {
                            const t = teamOf(l.teamId);
                            return (
                                <li key={l._id ?? l.registrationId} className={MINI}>
                                    <Face name={l.playerName} src={l.playerPhoto} className="row-span-2 h-9 w-9 text-xs" />
                                    <b className="truncate text-[clamp(13px,.95vw,16px)] font-semibold">{l.playerName}</b>
                                    <span className={MINI_SUB}>
                                        <Logo t={t ?? { name: l.teamName }} className="h-4 w-4 rounded-[4px] text-[7px]" />
                                        <span className="tabular-nums">{inr(l.finalPrice)}</span><span className="min-w-0 truncate">· {t?.name ?? l.teamName}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                ) : <p className="text-[13px] text-fg-muted">No one sold yet.</p>}
            </section>
            <section aria-label="Up next" className={BAND_CARD}>
                <h2 className={EYEBROW}>Up next</h2>
                {upNext.length ? (
                    <ul className={ROW}>
                        {upNext.map(u => (
                            <li key={u.registrationId} className={MINI}>
                                <Face name={u.playerName} src={u.playerPhoto} className="row-span-2 h-9 w-9 text-xs" />
                                <b className="truncate text-[clamp(13px,.95vw,16px)] font-semibold">{u.playerName}</b>
                                <span className={cn(MINI_SUB, 'block truncate tabular-nums')}>{[`base ${inr(u.basePrice)}`, cap(u.skillLevel)].filter(Boolean).join(' · ')}</span>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-[13px] text-fg-muted">{a.unsoldCount ? `Round ${a.rotationCount + 2} starts after this player.` : 'This is the last player.'}</p>}
            </section>
            <section aria-label="Unsold" className={cn(BAND_CARD, 'min-[700px]:col-span-full min-[1100px]:col-auto')}>
                <h2 className={EYEBROW}>Unsold</h2>
                <span className="font-oswald text-[clamp(28px,2.4vw,44px)] font-semibold leading-none tabular-nums">{unsold.length}</span>
                <p className="text-[clamp(12px,.8vw,14px)] text-fg-muted">
                    {unsold.length ? `${unsold.map(u => u.playerName).join(', ')}. Back in round ${a.rotationCount + 2}.` : 'No one has gone unsold this round.'}
                </p>
            </section>
        </div>
    );

    return (
        <main className="grid min-h-0 flex-1 content-start gap-3 px-4 pb-6 pt-3 min-[1100px]:content-normal min-[700px]:gap-[clamp(12px,1.2vw,20px)] min-[700px]:px-[clamp(16px,2vw,32px)] min-[700px]:py-[clamp(12px,1.2vw,20px)] min-[1100px]:grid-cols-[minmax(0,1fr)_clamp(300px,26vw,460px)] min-[1100px]:grid-rows-[minmax(0,1fr)_auto]">
            {stage}{purses}{band}
        </main>
    );
}

// ─── Before and after ─────────────────────────────────────────────────────────

function Lobby({ s }: { s: AuctionState }) {
    const a = s.auction;
    const teams = s.teams ?? [];
    const purse = new Set(teams.map(t => t.initialBudget)).size === 1 ? teams[0].initialBudget : 0;
    const facts = ([
        ['Players', a.totalPlayers || ''],
        ['Teams', teams.length],
        ['Purse per team', purse && inr(purse)],
        ['Bid increment', a.settings?.minBidIncrement && inr(a.settings.minBidIncrement)],
        ['Bid limit', a.settings?.hardLimit && inr(a.settings.hardLimit)],
    ] as const).filter(([, v]) => v !== '' && v !== 0 && v != null);
    return (
        <main className="grid flex-1 content-center justify-items-center gap-[clamp(20px,3vh,40px)] px-[clamp(16px,2vw,32px)] py-[clamp(24px,4vw,64px)] text-center">
            <div>
                <p className="inline-flex items-center gap-2.5 text-[clamp(13px,1vw,16px)] font-semibold uppercase tracking-[.14em] text-primary">
                    <i aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary motion-safe:animate-pulse" />Auction starts soon
                </p>
                <h1 className="mt-4 font-oswald text-[clamp(44px,6vw,112px)] font-semibold uppercase leading-[.95] text-balance">{s.category?.name || 'Player auction'}</h1>
                {s.tournament?.name && <p className="mt-3 text-[clamp(15px,1.3vw,22px)] text-fg-muted">{s.tournament.name}</p>}
            </div>
            <dl className="flex flex-wrap justify-center gap-x-[clamp(20px,3vw,48px)] gap-y-2.5">
                {facts.map(([k, v]) => (
                    <div key={k} className="grid"><dt className="text-[clamp(12px,.8vw,14px)] text-fg-subtle">{k}</dt><dd className={FACT_DD}>{v}</dd></div>
                ))}
            </dl>
            {teams.length > 0 && (
                <ul aria-label="Teams" className="grid w-[min(1200px,100%)] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-[clamp(10px,1vw,16px)]">
                    {teams.map(t => (
                        <li key={t._id} className="grid justify-items-center gap-2.5 rounded-[14px] border border-line bg-panel px-2.5 py-4">
                            <Logo t={t} className="h-[clamp(52px,4vw,76px)] w-[clamp(52px,4vw,76px)] text-[clamp(16px,1.3vw,24px)]" />
                            <span className="font-oswald text-[clamp(14px,1vw,18px)] font-semibold uppercase leading-[1.2]">{t.name}</span>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-[clamp(14px,1vw,18px)] text-fg-muted">Keep this page open. It updates by itself when bidding starts.</p>
        </main>
    );
}

type Row = { key: string; name: string; photo?: string | null; role?: 'captain' | 'icon'; price?: number };

function Final({ s, log }: { s: AuctionState; log: SoldLog | null }) {
    const teams = s.teams ?? [];
    const logs = log?.logs ?? [];
    const pre = log?.preAssigned ?? [];
    const spent = logs.reduce((n, l) => n + (l.finalPrice || 0), 0);
    const top = logs.reduce<(typeof logs)[number] | undefined>((m, l) => (!m || l.finalPrice > m.finalPrice ? l : m), undefined);
    const unsold = s.unsold ?? [];
    const squadOf = (id: string): Row[] => [
        ...pre.filter(x => x.teamId === id).sort((x, y) => Number(x.role !== 'captain') - Number(y.role !== 'captain'))
            .map(x => ({ key: `p${x.registrationId}`, name: x.playerName, photo: x.playerPhoto, role: x.role })),
        ...logs.filter(l => l.teamId === id).map(l => ({ key: l._id ?? l.registrationId, name: l.playerName, photo: l.playerPhoto, price: l.finalPrice })),
    ];
    return (
        <main className="grid flex-1 content-start gap-[clamp(16px,2vw,28px)] p-[clamp(16px,2vw,32px)] pb-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className={EYEBROW}>{[s.category?.name, 'final squads'].filter(Boolean).join(' · ')}</p>
                    <h1 className="font-oswald text-[clamp(36px,3.6vw,68px)] font-semibold uppercase leading-none">Auction complete</h1>
                </div>
                <dl className="flex flex-wrap gap-x-[clamp(20px,3vw,48px)] gap-y-2.5">
                    {([['Sold', logs.length], ['Total spent', inr(spent)], ['Top buy', top ? `${top.playerName} · ${inr(top.finalPrice)}` : '—'], ['Unsold', unsold.length]] as const).map(([k, v]) => (
                        <div key={k} className="grid"><dt className="text-[clamp(12px,.8vw,14px)] text-fg-subtle">{k}</dt><dd className={FACT_DD}>{v}</dd></div>
                    ))}
                </dl>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-[clamp(12px,1.2vw,20px)]">
                {teams.map(t => {
                    const squad = squadOf(t._id);
                    const paid = squad.reduce((n, x) => n + (x.price || 0), 0);
                    return (
                        <section key={t._id} aria-label={t.name} className={cn(CARD, 'overflow-hidden')}>
                            <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-t-4 border-b-line px-4 py-3.5"
                                style={{ borderTopColor: t.primaryColor || '#71717A' }}>
                                <Logo t={t} className="row-span-2 h-11 w-11 text-[15px]" />
                                <h2 className="font-oswald text-[21px] font-semibold uppercase leading-[1.15]">{t.name}</h2>
                                <span className="text-right font-oswald text-xl font-semibold leading-none tabular-nums">{inr(paid)}<span className="sr-only"> spent</span></span>
                                <span className="text-[12.5px] text-fg-subtle">{plural(squad.length, 'player')}</span>
                                <span className="text-right text-[12.5px] tabular-nums text-fg-subtle">{inr(t.budget)} left</span>
                            </header>
                            <ol className="grid px-4 pb-3 pt-1.5">
                                {squad.map(x => (
                                    <li key={x.key} className="flex items-center justify-between gap-3 border-b border-white/[.04] py-1.5 text-sm last:border-b-0">
                                        <span className="flex min-w-0 items-center gap-2.5">
                                            <Face name={x.name} src={x.photo} className="h-7 w-7 text-[10px]" />
                                            <span className="truncate">{x.name}</span>
                                            {x.role && <span className={cn('text-[11px] font-semibold uppercase tracking-[.06em]', x.role === 'icon' ? 'text-[#C4B5FD]' : 'text-[#FBBF24]')}>{x.role === 'icon' ? 'Icon' : 'Captain'}</span>}
                                        </span>
                                        <span className="whitespace-nowrap tabular-nums text-fg-muted">{x.price != null ? inr(x.price) : 'Free'}</span>
                                    </li>
                                ))}
                                {!squad.length && <li className="py-1.5 text-sm text-fg-muted">No players.</li>}
                            </ol>
                        </section>
                    );
                })}
            </div>
            {unsold.length > 0 && <p className="text-[clamp(14px,1vw,18px)] text-fg-muted">Unsold: {unsold.map(u => u.playerName).join(', ')}.</p>}
        </main>
    );
}
