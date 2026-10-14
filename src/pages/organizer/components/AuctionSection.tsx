// Auction desk: start a category's player auction, record bids live, sell, and review the results.
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
    ArrowRight, ArrowUpRight, Check, CircleAlert, Coins, Flag, Gavel, Info, ListTree, Loader2,
    Monitor, Pause, Play, Shield, Shuffle, TriangleAlert, Undo2,
} from 'lucide-react';
import API from '@/api/axios';
import { auctionApi, AuctionState, SoldLog } from '@/api/auction';
import { socket } from '@/lib/socket';
import { getAppLenis } from '@/context/LenisContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchRegistrationsByTournament, fetchTournamentCategories } from '@/store/slices/registrationSlice';
import type { Team } from '@/types';
import { cn } from '@/lib/utils';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS, initials, inr, Tone, ToneBadge } from '../shared';
import {
    Avatar, CategoryTabs, CHOICE, COLHEAD, ConfirmBar, Dialog, EmptyState, Field, MoneyInput, MoreMenu,
    Notice, PageHead, PANEL, SegTabs, Spinner, TeamLogo, useSectionNav,
} from '../ui';

type Cat = { _id: string; name: string; status?: string };

const PAST = ['groups_configured', 'bracket_configured', 'ongoing', 'completed'];
const WHOLE = /^\d+$/;
const ICON = 'h-4 w-4';
const SPIN = 'h-4 w-4 animate-spin';

const errText = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const cap = (s?: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : '');

/** Category card meta. The selected category uses its loaded auction; the rest go by category status. */
const metaFor = (status = '', a?: AuctionState['auction'] | null) =>
    a && a.status !== 'not_started' ? (a.status === 'completed' ? 'Auction over' : a.status === 'paused' ? 'Paused'
        : a.totalPlayers ? `Live · player ${Math.min(a.currentPlayerIndex + 1, a.totalPlayers)} of ${a.totalPlayers}` : 'Live')
        : status === 'registration' || (status === 'auction' && a !== undefined) ? 'Ready to start'
            : status === 'auction' ? 'Live'
                : status === 'setup' ? 'Registration not open'
                    : PAST.includes(status) ? 'Auction over' : '';

const TONE_OF_META: Record<string, { tone: Tone; live?: boolean }> = {
    Live: { tone: 'green', live: true }, Paused: { tone: 'amber' }, 'Ready to start': { tone: 'blue' },
    'Registration not open': { tone: 'neutral' }, 'Auction over': { tone: 'neutral' },
};

const Photo = ({ name, src }: { name: string; src?: string }) => <Avatar name={name} src={src} size="xl" />;

export default function AuctionSection({ tournamentId, categories }: { tournamentId: string; categories: Cat[] }) {
    const dispatch = useAppDispatch();
    const goTo = useSectionNav();
    const regs = useAppSelector(s => s.registration.tournamentRegistrations);

    const [catId, setCatId] = useState('');
    /** undefined while loading, null when the category has no auction yet (404). */
    const [state, setState] = useState<AuctionState | null | undefined>(undefined);
    const [loadError, setLoadError] = useState('');
    const [log, setLog] = useState<SoldLog | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [err, setErr] = useState<{ at: string; msg: string } | null>(null);
    const [confirm, setConfirm] = useState<'undo' | 'end' | null>(null);
    const [dialog, setDialog] = useState<'manual' | 'tie' | null>(null);
    const root = useRef<HTMLDivElement>(null);

    // Open the live auction first, else one ready to start. Categories can arrive after mount.
    useEffect(() => {
        if (categories.some(c => c._id === catId)) return;
        setCatId((categories.find(c => c.status === 'auction') ?? categories.find(c => c.status === 'registration') ?? categories[0])?._id ?? '');
    }, [categories, catId]);
    const cat = categories.find(c => c._id === catId);

    // A slow response for a category the organizer has already left must not land.
    const shown = useRef(catId);
    shown.current = catId;

    const load = useCallback(async () => {
        const id = catId;
        try {
            const d = await auctionApi.getStatus(tournamentId, id);
            if (shown.current === id) { setState(d); setLoadError(''); }
            return d;
        } catch (e) {
            if (shown.current !== id) return;
            if ((e as { response?: { status?: number } })?.response?.status === 404) { setState(null); setLoadError(''); }
            else setLoadError(errText(e, 'Check your connection and try again.'));
        }
    }, [tournamentId, catId]);

    useEffect(() => {
        setState(undefined); setLoadError(''); setLog(null); setErr(null); setConfirm(null); setDialog(null);
        if (!catId) return;
        // A tie-break left open (say, by a reload) comes back with its spin result.
        load().then(d => { if (d?.auction.status === 'in_progress' && d.auction.liveBid?.tieBreakerActive) setDialog('tie'); });

        const room = { tournamentId, categoryId: catId };
        const join = () => socket.emit('join:auction', room);
        const onUpdate = (d: AuctionState) => { if (!d.category || String(d.category._id) === catId) setState(d); };
        socket.on('connect', join); // rooms don't survive a reconnect
        socket.on('auction:update', onUpdate);
        socket.connect();
        if (socket.connected) join();
        return () => {
            socket.off('connect', join);
            socket.off('auction:update', onUpdate);
            socket.emit('leave:auction', room);
            socket.disconnect();
        };
    }, [tournamentId, catId, load]);

    const logsCount = state?.auction.logsCount;
    useEffect(() => {
        if (logsCount == null) return;
        let live = true;
        auctionApi.getSoldLog(tournamentId, catId).then(d => { if (live) setLog(d); }).catch(() => { /* the list just stays as it was */ });
        return () => { live = false; };
    }, [tournamentId, catId, logsCount]);

    const status = state?.auction.status;
    useEffect(() => {
        if (status === 'completed') dispatch(fetchRegistrationsByTournament({ tournamentId })); // who is left unassigned
    }, [status, tournamentId, dispatch]);

    // A sale collapses the bidding grid; keep the result in view rather than wherever the shorter page clamps.
    useEffect(() => {
        const el = root.current;
        if (status !== 'sold' || !el) return;
        const lenis = getAppLenis();
        if (lenis) lenis.scrollTo(el, { offset: -20 });
        else el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }, [status]);

    /** Runs an organizer action, then reloads (the socket may lag or be down). Failures show at `at`. */
    const run = async (key: string, at: string, action: () => Promise<unknown>, fallback: string) => {
        setBusy(key); setErr(null);
        try {
            await action();
            setConfirm(null);
            await load();
        } catch (e) {
            setErr({ at, msg: errText(e, `${fallback} Check your connection and try again.`) });
        } finally { setBusy(null); }
    };
    const errAt = (at: string, className?: string) => err?.at === at && (
        <div role="alert" className={className}><Notice tone="red" icon={CircleAlert}>{err.msg}</Notice></div>
    );

    const start = async (bidIncrement: number, hardLimit: number) => {
        try {
            // Categories → "Start auction" may already have moved it to Auction; only Registration needs the step.
            if (cat?.status === 'registration') await API.post(`/categories/${catId}/start-auction`);
            await auctionApi.start(tournamentId, catId, { bidIncrement, hardLimit });
        } finally {
            dispatch(fetchTournamentCategories(tournamentId)); // sidebar and overview show the new status
        }
        await load(); // the server doesn't broadcast a start
    };
    const assign = async () => {
        const res = await auctionApi.distribute(tournamentId, catId);
        await load();
        return res;
    };

    const goButton = (section: string, label: string) => (
        <button type="button" onClick={() => goTo(section)} className={BTN_SECONDARY}>
            {section === 'teams' ? <Shield aria-hidden className={ICON} /> : <ListTree aria-hidden className={ICON} />}{label}
        </button>
    );

    const renderLive = (s: AuctionState) => {
        const a = s.auction;
        const lb = a.liveBid ?? { currentPrice: 0, highestBidderId: '', highestBidderName: '', bidHistory: [], tiedTeams: [], tieBreakerActive: false, spinWinnerId: null, spinStartedAt: null };
        const teams = s.teams ?? [];
        const teamOf = (id?: string) => teams.find(t => t._id === id);
        const paused = a.status === 'paused';
        const sold = a.status === 'sold';
        const limit = a.settings?.hardLimit || 0;
        const price = lb.currentPrice || 0;
        const nextPrice = price + (a.settings?.minBidIncrement || 0);
        const atLimit = limit > 0 && price >= limit;
        const tied = lb.tiedTeams ?? [];
        const p = s.currentPlayer;
        const name = p ? `${p.profile.firstName} ${p.profile.lastName}` : '';
        const base = p?.auctionData?.basePrice ?? 0;
        const last = !a.remainingCount && !a.unsoldCount;
        const lastLog = log?.logs[log.logs.length - 1];
        const left = (a.remainingCount || 0) + (a.unsoldCount || 0) + (sold ? 0 : 1);

        const bid = (teamId: string) => run(`bid-${teamId}`, 'grid', () => auctionApi.bid(tournamentId, catId, teamId), "Couldn't record the bid.");
        const undo = (at: string) => run('undo', at, () => auctionApi.undo(tournamentId, catId), "Couldn't undo the sale.");

        const strip = (
            <div className={cn(PANEL, 'overflow-hidden')}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                    <ToneBadge label={paused ? 'Paused' : 'Live'} tone={paused ? 'amber' : 'green'} live={!paused} />
                    <p className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-muted">
                        {a.rotationCount > 0 && <span>Round {a.rotationCount + 1}</span>}
                        <span>Player <span className="tabular-nums text-fg">{a.currentPlayerIndex + 1}</span> of {a.totalPlayers}</span>
                        {a.unsoldCount > 0 && <span>{a.unsoldCount} unsold, back in round {a.rotationCount + 2}</span>}
                        <span>Bids rise by {inr(a.settings?.minBidIncrement || 0)}</span>
                        {limit > 0 && <span>Limit {inr(limit)}</span>}
                    </p>
                    <div className="flex items-center gap-1">
                        <button type="button" disabled={sold || !!busy} className={cn(paused ? BTN_PRIMARY : BTN_SECONDARY, BTN_SM)}
                            onClick={() => run('pause', 'strip', () => auctionApi.pause(tournamentId, catId), paused ? "Couldn't resume." : "Couldn't pause.")}>
                            {busy === 'pause' ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : paused ? <Play aria-hidden className="h-3.5 w-3.5" /> : <Pause aria-hidden className="h-3.5 w-3.5" />}
                            {paused ? 'Resume' : 'Pause'}
                        </button>
                        <MoreMenu items={[
                            { label: 'Sell manually…', icon: Coins, onSelect: () => setDialog('manual'), disabled: paused || sold || !p },
                            // Undo sets the auction back to in progress, so it would silently resume a pause.
                            { label: 'Undo last sale', icon: Undo2, onSelect: () => setConfirm('undo'), disabled: !a.logsCount || paused },
                            'separator',
                            { label: 'End auction', icon: Flag, danger: true, onSelect: () => setConfirm('end') },
                        ]} />
                    </div>
                </div>
                {confirm === 'end' && (
                    <ConfirmBar danger confirmLabel="End auction" cancelLabel="Keep going" busy={busy === 'end'} onCancel={() => setConfirm(null)}
                        onConfirm={() => run('end', 'strip', () => auctionApi.end(tournamentId, catId), "Couldn't end the auction.")}
                        message={`End the auction now? ${plural(left, 'player')} ${left === 1 ? "hasn't" : "haven't"} been sold and stay unassigned. It can't be restarted.`} />
                )}
                {confirm === 'undo' && !sold && (
                    <ConfirmBar confirmLabel="Undo sale" busy={busy === 'undo'} onCancel={() => setConfirm(null)} onConfirm={() => undo('strip')}
                        message={lastLog
                            ? `Undo the last sale? ${lastLog.playerName} goes back on the block and ${lastLog.teamName} gets ${inr(lastLog.finalPrice)} back.`
                            : 'Undo the last sale? That player goes back on the block and their team gets the money back.'} />
                )}
            </div>
        );

        const r = a.lastSoldResult;
        const up = s.upcoming?.[0];
        const block = !p && !sold ? (
            <section className={PANEL}><EmptyState title="Waiting for the next player" text="The next player shows here as soon as the server has them on the block." /></section>
        ) : sold ? (
            <section aria-label="Sale" className={cn(PANEL, 'overflow-hidden')}>
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                    <Photo name={r?.playerName ?? name} src={p?.profile.photo} />
                    <div className="min-w-0 flex-1">
                        <ToneBadge label="Sold" tone="green" />
                        <h2 className="mt-1.5 text-lg font-semibold text-fg">{r?.playerName ?? name}</h2>
                        {r && (
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-fg-muted">
                                to <TeamLogo size="sm" name={r.teamName} color={teamOf(r.teamId)?.primaryColor ?? r.teamColor} />
                                <span className="text-fg">{r.teamName}</span> for <span className="font-semibold tabular-nums text-fg">{inr(r.soldPrice)}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={!!busy || !a.logsCount} onClick={() => setConfirm('undo')} className={BTN_SECONDARY}>
                            <Undo2 aria-hidden className={ICON} />Undo sale
                        </button>
                        <button type="button" disabled={!!busy} className={BTN_PRIMARY}
                            onClick={() => run('next', 'sold', () => auctionApi.next(tournamentId, catId), "Couldn't move on.")}>
                            {last ? 'Finish auction' : 'Next player'}
                            {busy === 'next' ? <Loader2 aria-hidden className={SPIN} /> : <ArrowRight aria-hidden className={ICON} />}
                        </button>
                    </div>
                </div>
                {confirm === 'undo' && (
                    <ConfirmBar confirmLabel="Undo sale" busy={busy === 'undo'} onCancel={() => setConfirm(null)} onConfirm={() => undo('sold')}
                        message={r
                            ? `Undo this sale? ${r.playerName} goes back on the block and ${r.teamName} gets ${inr(r.soldPrice)} back.`
                            : 'Undo this sale? The player goes back on the block and their team gets the money back.'} />
                )}
                {errAt('sold', 'px-4 pb-4 sm:px-5')}
                <p className="border-t border-line px-4 py-3 text-[13px] text-fg-muted sm:px-5">
                    {up ? <>Next up: <span className="text-fg">{up.playerName}</span>{` · ${[cap(up.skillLevel), `base ${inr(up.basePrice)}`].filter(Boolean).join(' · ')}`}</>
                        : a.unsoldCount ? `Next: round ${a.rotationCount + 2} with the ${plural(a.unsoldCount, 'unsold player')}.`
                            : 'That was the last player.'}
                </p>
            </section>
        ) : (() => {
            const leaderName = lb.highestBidderId ? teamOf(lb.highestBidderId)?.name ?? lb.highestBidderName : '';
            const history = lb.bidHistory ?? [];
            const firstAtLimit = limit ? history.findIndex(b => b.amount >= limit) : -1;
            const pct = limit > base ? Math.min(100, Math.max(0, ((price - base) / (limit - base)) * 100)) : 100;
            const cs = p.careerStats;
            return (
                <section aria-label="On the block" className={PANEL}>
                    <div className="flex items-start gap-4 p-4 sm:p-5">
                        <Photo name={name} src={p.profile.photo} />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-fg-subtle">On the block</p>
                            <h2 className="mt-0.5 truncate text-lg font-semibold text-fg">{name}</h2>
                            <p className="text-[13px] text-fg-muted">{[p.profile.age, cap(p.profile.gender), cap(p.profile.skillLevel)].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-fg-subtle">Base price</p>
                            <p className="text-sm font-medium tabular-nums text-fg">{inr(base)}</p>
                        </div>
                    </div>
                    {cs && (
                        <dl className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
                            {([['Matches', cs.matchesPlayed], ['Won', cs.matchesWon], ['Tournaments', cs.tournamentsPlayed]] as const).map(([k, v]) => (
                                <div key={k} className="px-2 py-2.5"><dt className="text-xs text-fg-subtle">{k}</dt><dd className="text-sm font-medium tabular-nums text-fg">{v ?? 0}</dd></div>
                            ))}
                        </dl>
                    )}
                    <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5">
                        <div>
                            <p className="text-xs font-medium text-fg-subtle">{lb.highestBidderId ? 'Current bid' : 'Opening price'}</p>
                            <p className="mt-1 text-[40px] font-semibold leading-none tracking-tight tabular-nums text-fg">{inr(price)}</p>
                            <p className="mt-2 flex items-center gap-2 text-sm text-fg-muted">
                                {leaderName ? <>
                                    <TeamLogo size="sm" name={leaderName} color={teamOf(lb.highestBidderId)?.primaryColor} />
                                    <span className="text-fg">{leaderName}</span>{atLimit && tied.length > 1 ? ` and ${tied.length - 1} more at the limit` : ' leads'}
                                </> : 'No bids yet'}
                            </p>
                        </div>
                        {limit > 0 && (
                            <div className="sm:w-56">
                                <div className="flex justify-between text-xs text-fg-subtle"><span className="tabular-nums">{inr(base)}</span><span>Limit {inr(limit)}</span></div>
                                <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                                    <div className={cn('h-full rounded-full', atLimit ? 'bg-amber-400' : 'bg-primary')} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="border-t border-line px-4 py-3 sm:px-5">
                        <p className="mb-2 text-xs font-medium text-fg-subtle">Bids <span className="tabular-nums">{history.length}</span></p>
                        {history.length ? (
                            <ol data-lenis-prevent className="max-h-[148px] space-y-1.5 overflow-y-auto">
                                {history.map((b, i) => ({ b, i })).reverse().map(({ b, i }, n) => (
                                    <li key={i} className="flex items-center gap-2.5 text-[13px]">
                                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: teamOf(b.teamId)?.primaryColor || '#71717A' }} />
                                        <span className={cn('min-w-0 flex-1 truncate', n === 0 ? 'text-fg' : 'text-fg-muted')}>{b.teamName}{firstAtLimit >= 0 && i > firstAtLimit ? ' matched' : ''}</span>
                                        <span className="tabular-nums text-fg">{inr(b.amount)}</span>
                                        <span className="w-16 text-right text-xs tabular-nums text-fg-subtle">{new Date(b.timestamp).toLocaleTimeString('en-GB')}</span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="text-[13px] text-fg-muted">{atLimit ? `Waiting for a team to match ${inr(limit)}.` : `Waiting for the first bid. It will be ${inr(nextPrice)}.`}</p>
                        )}
                    </div>
                </section>
            );
        })();

        const teamButton = (t: Team) => {
            const leading = lb.highestBidderId === t._id && !atLimit;
            const matched = atLimit && tied.includes(t._id);
            let note: string;
            let can = false;
            if (paused) note = 'Paused';
            else if (leading) note = 'Leading';
            else if (matched) note = 'Matched';
            else if (t.budget < (atLimit ? limit : nextPrice)) note = "Can't afford";
            else if (!atLimit && limit > 0 && nextPrice > limit) note = 'Over limit';
            else { can = true; note = atLimit ? `Match ${inr(limit)}` : `Bid ${inr(nextPrice)}`; }
            return (
                <button key={t._id} type="button" disabled={!can || !!busy} onClick={() => bid(t._id)}
                    className={cn('flex min-h-[60px] items-center gap-3 rounded-[10px] p-3 text-left ring-1 ring-inset transition-colors disabled:cursor-not-allowed', FOCUS,
                        leading || matched ? 'bg-primary/[0.06] ring-primary/60' : can ? 'bg-canvas ring-line hover:bg-white/[0.03] hover:ring-white/25' : 'bg-canvas ring-line opacity-55')}>
                    <TeamLogo name={t.name} color={t.primaryColor} />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{t.name}</span>
                        <span className="block text-xs tabular-nums text-fg-subtle">{inr(t.budget)} left · {plural(t.playersCount ?? 0, 'player')}</span>
                    </span>
                    <span className={cn('flex shrink-0 items-center gap-1 text-[13px] font-medium tabular-nums', leading || matched ? 'text-primary' : can ? 'text-fg' : 'text-fg-subtle')}>
                        {busy === `bid-${t._id}` ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : matched && <Check aria-hidden className="h-3.5 w-3.5" />}{note}
                    </span>
                </button>
            );
        };

        const grid = (
            <section aria-label="Bidding" className={PANEL}>
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
                    <h3 className="text-sm font-semibold text-fg">{atLimit ? 'Match the limit' : 'Record a bid'}</h3>
                    <p className="text-[13px] text-fg-muted">{atLimit ? `Tap every team that will pay ${inr(limit)}.` : `Tap the team that bid. The price goes to ${inr(nextPrice)}.`}</p>
                </header>
                {teams.length ? <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">{teams.map(teamButton)}</div>
                    : <EmptyState title="No teams to bid" text="Add teams first. Each team bids from its own purse." action={goButton('teams', 'Go to Teams')} />}
                {errAt('grid', 'px-3 pb-3')}
            </section>
        );

        // At the limit, one team alone is sold at the limit; two or more spin for it.
        const winnerId = atLimit ? tied[0] : lb.highestBidderId;
        const winnerName = teamOf(winnerId)?.name ?? (winnerId === lb.highestBidderId ? lb.highestBidderName : '');
        const primary = atLimit && tied.length >= 2 ? (
            <button type="button" disabled={paused || !!busy} className={cn(BTN_PRIMARY, 'min-w-0 basis-full sm:basis-auto')}
                onClick={() => run('tie', 'bar', async () => {
                    // Restarting a running tie-break would clear its spin result.
                    if (!lb.tieBreakerActive) await auctionApi.startTieBreaker(tournamentId, catId);
                    setDialog('tie');
                }, "Couldn't start the tie-break.")}>
                {busy === 'tie' ? <Loader2 aria-hidden className={SPIN} /> : <Shuffle aria-hidden className={ICON} />}Break the tie · {tied.length} teams
            </button>
        ) : (
            <button type="button" disabled={!winnerId || paused || !!busy} className={cn(BTN_PRIMARY, 'min-w-0 basis-full sm:basis-auto')}
                onClick={() => run('sell', 'bar', () => atLimit
                    ? auctionApi.resolveHardLimit(tournamentId, catId, winnerId)
                    : auctionApi.sell(tournamentId, catId, winnerId, price), "Couldn't record the sale.")}>
                {busy === 'sell' ? <Loader2 aria-hidden className={SPIN} /> : <Gavel aria-hidden className={ICON} />}
                <span className="truncate">{winnerId ? `Sell to ${winnerName} · ${inr(atLimit ? limit : price)}` : 'Sell · waiting for a bid'}</span>
            </button>
        );

        const bar = (
            <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-raised p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-line">
                {primary}
                <button type="button" disabled={paused || !p || !!busy} className={BTN_SECONDARY}
                    onClick={() => run('skip', 'bar', () => auctionApi.skip(tournamentId, catId), "Couldn't mark the player unsold.")}>
                    {busy === 'skip' && <Loader2 aria-hidden className={SPIN} />}Mark unsold
                </button>
                <button type="button" disabled={paused || !p || !!busy} onClick={() => setDialog('manual')} className={cn(BTN_GHOST, 'sm:ml-auto')}>Sell manually…</button>
            </div>
        );

        const tiedTeams = tied.map(teamOf).filter(Boolean);
        return (
            <div className="space-y-4">
                {strip}
                {errAt('strip')}
                {paused && <Notice tone="amber" icon={Pause}>Bidding is paused. Teams can't bid and nothing can be sold until you resume.</Notice>}
                {atLimit && !sold && !paused && (
                    <Notice tone="amber" icon={TriangleAlert}>The {inr(limit)} limit is reached. Teams that will pay the limit can match it. If more than one matches, a spin decides.</Notice>
                )}
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                    <div className="min-w-0 space-y-4">
                        {block}
                        {!sold && grid}
                        {!sold && errAt('bar')}
                        {!sold && bar}
                    </div>
                    <aside className="space-y-4" aria-label="Teams and sales">
                        <Purses teams={teams} flash={sold ? r?.teamId : undefined} />
                        <SalesLog log={log} upcoming={s.upcoming ?? []} unsold={s.unsold ?? []} remaining={a.remainingCount} />
                    </aside>
                </div>

                {dialog === 'manual' && p && (
                    <ManualSell name={name} base={base} teams={teams} defaultTeam={lb.highestBidderId} defaultPrice={lb.highestBidderId ? price : base}
                        onClose={() => setDialog(null)}
                        onSell={async (teamId, soldPrice) => { await auctionApi.sell(tournamentId, catId, teamId, soldPrice); setDialog(null); await load(); }} />
                )}
                {dialog === 'tie' && !sold && tiedTeams.length >= 2 && (
                    <TieBreak teams={tiedTeams} limit={limit} winnerId={lb.spinWinnerId} onClose={() => setDialog(null)}
                        onSpin={() => auctionApi.triggerSpinWheel(tournamentId, catId)}
                        onSell={async teamId => { await auctionApi.resolveHardLimit(tournamentId, catId, teamId); setDialog(null); await load(); }} />
                )}
            </div>
        );
    };

    let body: ReactNode;
    if (!categories.length) {
        body = <section className={PANEL}><EmptyState title="No categories yet" text="Add a category and open registration. Each category runs its own auction." action={goButton('categories', 'Go to Categories')} /></section>;
    } else if (state === undefined) {
        body = loadError
            ? <section className={PANEL}><EmptyState title="The auction didn't load" text={loadError} action={<button type="button" onClick={load} className={BTN_SECONDARY}>Try again</button>} /></section>
            : <Spinner label="Loading the auction" />;
    } else if (state === null || state.auction.status === 'not_started') {
        const st = cat?.status ?? '';
        body = st === 'setup' ? (
            <section className={PANEL}>
                <EmptyState title={`${cat?.name} isn't ready for an auction`} action={goButton('categories', 'Go to Categories')}
                    text="The auction sells approved registrations. Open registration for this category and approve players, then come back here." />
            </section>
        ) : PAST.includes(st) ? (
            <section className={PANEL}>
                <EmptyState title={`No auction was run for ${cat?.name}`} text="This category is past the auction stage. Its players were placed on teams without one." />
            </section>
        ) : (
            <StartPanel key={catId} name={cat?.name ?? ''} opensCategory={st === 'registration'} onStart={start} onAssign={assign} />
        );
    } else if (state.auction.status === 'completed') {
        const unsold = regs.filter(r => r.categoryId === catId && r.status === 'approved' && !r.teamId).length;
        body = <DonePanel teams={state.teams ?? []} log={log} unsold={unsold} />;
    } else {
        body = renderLive(state);
    }

    return (
        <div ref={root} className="space-y-6">
            <PageHead title="Auction" desc="Sell approved players to teams, one category at a time."
                actions={state && (
                    <a href={`/auction/${tournamentId}/${catId}`} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
                        <Monitor aria-hidden className={ICON} />Public display<ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-fg-subtle" />
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                )} />
            {categories.length > 0 && (
                <CategoryTabs value={catId} onChange={setCatId}
                    categories={categories.map(c => {
                        const meta = metaFor(c.status, c._id === catId ? state && state.auction : undefined);
                        return { _id: c._id, name: c.name, meta, ...TONE_OF_META[meta.split(' · ')[0]] };
                    })} />
            )}
            {state && loadError && (
                <div role="alert"><Notice tone="red" icon={CircleAlert}>Couldn't refresh the auction. {loadError}</Notice></div>
            )}
            {body}
        </div>
    );
}

// ─── Side panels ──────────────────────────────────────────────────────────────

function Purses({ teams, flash }: { teams: Team[]; flash?: string }) {
    return (
        <section aria-label="Team purses" className={PANEL}>
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <h3 className="text-sm font-semibold text-fg">Teams</h3><span className="text-xs text-fg-subtle">Purse left</span>
            </header>
            <ul className="divide-y divide-line">
                {teams.map(t => {
                    const pct = t.initialBudget ? Math.min(100, Math.max(0, (t.budget / t.initialBudget) * 100)) : 0;
                    const low = pct < 15;
                    return (
                        <li key={t._id} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors', flash === t._id && 'bg-primary/[0.06]')}>
                            <TeamLogo size="sm" name={t.name} color={t.primaryColor} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-fg">{t.name}</p>
                                <div aria-hidden className="mt-1 h-1 overflow-hidden rounded-full bg-line">
                                    <div className={cn('h-full rounded-full', low ? 'bg-amber-400' : 'bg-fg-subtle')} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={cn('text-[13px] font-medium tabular-nums', low ? 'text-amber-300' : 'text-fg')}>{inr(t.budget)}</p>
                                <p className="text-[11px] text-fg-subtle">{plural(t.playersCount ?? 0, 'player')}</p>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <p className="border-t border-line px-4 py-2.5 text-xs leading-relaxed text-fg-subtle">Purses are shared across all categories. Player counts include captains and icon players.</p>
        </section>
    );
}

/** Sold players and pre-assigned captains/icons; with `upcoming`, also the queue and the unsold. */
function SalesLog({ log, upcoming, unsold, remaining }: { log: SoldLog | null; upcoming?: AuctionState['upcoming']; unsold?: AuctionState['unsold']; remaining?: number }) {
    const [tab, setTab] = useState<'sold' | 'next' | 'unsold'>('sold');
    const sold = [...(log?.logs ?? [])].reverse();
    const pre = log?.preAssigned ?? [];
    const queued = remaining ?? upcoming?.length ?? 0;
    const row = (key: string, name: string, sub: string, right: ReactNode, photo?: string | null) => (
        <li key={key} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar name={name} src={photo || undefined} size="sm" />
            <div className="min-w-0 flex-1"><p className="truncate text-[13px] text-fg">{name}</p><p className="truncate text-xs text-fg-subtle">{sub}</p></div>
            <span className="shrink-0 text-[13px] tabular-nums text-fg">{right}</span>
        </li>
    );
    const note = (text: string) => <li className="px-4 py-2.5 text-xs text-fg-subtle">{text}</li>;
    return (
        <section aria-label="Sales" className={PANEL}>
            {upcoming ? (
                <div className="border-b border-line p-2.5">
                    <SegTabs<'sold' | 'next' | 'unsold'> label="Lists" value={tab} onChange={setTab}
                        items={[{ key: 'sold', label: 'Sold', count: sold.length }, { key: 'next', label: 'Up next', count: queued }, { key: 'unsold', label: 'Unsold', count: unsold?.length ?? 0 }]} />
                </div>
            ) : (
                <header className="flex items-baseline gap-2 border-b border-line px-4 py-3">
                    <h3 className="text-sm font-semibold text-fg">Sold</h3><span className="text-[13px] tabular-nums text-fg-subtle">{sold.length}</span>
                </header>
            )}
            <ul data-lenis-prevent className="max-h-[360px] divide-y divide-line overflow-y-auto">
                {tab === 'sold' && <>
                    {sold.map((l, i) => row(l._id ?? `s${i}`, l.playerName, l.teamName, inr(l.finalPrice), l.playerPhoto))}
                    {pre.length > 0 && <li className="bg-white/[0.02] px-4 py-2 text-xs font-medium text-fg-subtle">Pre-assigned · {pre.length}</li>}
                    {pre.map(x => row(`p${x.registrationId}`, x.playerName, `${x.teamName} · ${x.role === 'captain' ? 'Captain' : 'Icon'}`, <span className="text-fg-subtle">Free</span>, x.playerPhoto))}
                    {!sold.length && !pre.length && <li className="px-4 py-6 text-center text-[13px] text-fg-muted">No sales yet.</li>}
                </>}
                {tab === 'next' && <>
                    {upcoming?.map(x => row(x.registrationId, x.playerName, cap(x.skillLevel), <span className="text-fg-muted">base {inr(x.basePrice)}</span>, x.playerPhoto))}
                    {!upcoming?.length && note('No one else is queued in this round.')}
                    {queued > (upcoming?.length ?? 0) && note(`${queued - (upcoming?.length ?? 0)} more after these.`)}
                    {note('Players marked unsold come back in the next round.')}
                </>}
                {tab === 'unsold' && <>
                    {unsold?.map(x => row(x.registrationId, x.playerName, cap(x.skillLevel), <span className="text-fg-muted">base {inr(x.basePrice)}</span>, x.playerPhoto))}
                    {unsold?.length ? note('They open the next round, in this order.') : note('No one has gone unsold this round.')}
                </>}
            </ul>
        </section>
    );
}

// ─── Not started & finished ───────────────────────────────────────────────────

function StartPanel({ name, opensCategory, onStart, onAssign }: {
    name: string; opensCategory: boolean;
    onStart: (bidIncrement: number, hardLimit: number) => Promise<void>;
    onAssign: () => Promise<{ assigned: number; teams: number }>;
}) {
    const [inc, setInc] = useState('1000');
    const [limit, setLimit] = useState('');
    const [busy, setBusy] = useState<'start' | 'assign' | null>(null);
    const [error, setError] = useState<{ at: 'start' | 'assign'; msg: string } | null>(null);
    const [asking, setAsking] = useState(false);
    const [assigned, setAssigned] = useState<{ assigned: number; teams: number } | null>(null);

    const incErr = !WHOLE.test(inc) || Number(inc) < 1 ? 'Use a whole number of rupees, at least ₹1.' : null;
    const limErr = limit !== '' && (!WHOLE.test(limit) || Number(limit) <= Number(inc)) ? 'Leave blank for no limit, or use a whole number above the increment.' : null;

    const act = async (at: 'start' | 'assign', fn: () => Promise<unknown>, fallback: string) => {
        setBusy(at); setError(null);
        try { await fn(); } catch (e) { setError({ at, msg: errText(e, `${fallback} Check your connection and try again.`) }); } finally { setBusy(null); }
    };
    const errorAt = (at: 'start' | 'assign') => error?.at === at && <div role="alert" className="mt-4"><Notice tone="red" icon={CircleAlert}>{error.msg}</Notice></div>;

    if (assigned) return (
        <Notice tone="blue" icon={Info}>
            Assigned {plural(assigned.assigned, 'player')} across {plural(assigned.teams, 'team')}. {name} has no one left to auction. See the squads in Teams.
        </Notice>
    );
    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <section className={PANEL}>
                <div className="p-5 sm:p-6">
                    <h2 className="text-base font-semibold text-fg">Start the auction for {name}</h2>
                    <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-fg-muted">
                        Approved players come up one at a time in random order. Players already on a team from another category join that team automatically.
                    </p>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <Field id="a-inc" label="Bid increment" error={incErr} help="Each bid raises the price by this much.">
                            <MoneyInput id="a-inc" value={inc} onChange={setInc} step={100} invalid={!!incErr} />
                        </Field>
                        <Field id="a-cap" label="Price limit" error={limErr} help="Optional. At the limit teams match instead of outbidding, and a spin breaks ties.">
                            <MoneyInput id="a-cap" value={limit} onChange={setLimit} step={1000} placeholder="No limit" invalid={!!limErr} />
                        </Field>
                    </div>
                    <Notice tone="blue" icon={Info} className="mt-5">
                        {opensCategory && `Starting closes registration for ${name}. `}These settings can't be changed after the auction starts.
                    </Notice>
                    {errorAt('start')}
                </div>
                <footer className="flex justify-end border-t border-line px-5 py-3">
                    <button type="button" disabled={!!(incErr || limErr) || !!busy} className={BTN_PRIMARY}
                        onClick={() => act('start', () => onStart(Number(inc), Number(limit) || 0), "Couldn't start the auction.")}>
                        {busy === 'start' ? <Loader2 aria-hidden className={SPIN} /> : <Gavel aria-hidden className={ICON} />}Start auction
                    </button>
                </footer>
            </section>
            <section className={cn(PANEL, 'overflow-hidden')}>
                <div className="p-5">
                    <h3 className="text-sm font-semibold text-fg">Skip the auction</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">Split approved, unassigned players evenly across all teams at ₹0. Good for friendly events without bidding.</p>
                    <button type="button" disabled={!!busy} onClick={() => setAsking(true)} className={cn(BTN_SECONDARY, 'mt-4')}>
                        <Shuffle aria-hidden className={ICON} />Assign evenly
                    </button>
                    {errorAt('assign')}
                </div>
                {asking && (
                    <ConfirmBar confirmLabel="Assign players" busy={busy === 'assign'} onCancel={() => setAsking(false)}
                        message="Assign every approved, unassigned player evenly across the teams? This can't be undone."
                        onConfirm={() => act('assign', async () => setAssigned(await onAssign()), "Couldn't assign the players.")} />
                )}
            </section>
        </div>
    );
}

function DonePanel({ teams, log, unsold }: { teams: Team[]; log: SoldLog | null; unsold: number }) {
    const logs = log?.logs ?? [];
    const spent = logs.reduce((s, l) => s + (l.finalPrice || 0), 0);
    const top = logs.reduce((m, l) => Math.max(m, l.finalPrice || 0), 0);
    const cols = 'grid-cols-[minmax(0,1fr)_70px_90px] sm:grid-cols-[minmax(0,1fr)_80px_110px_110px]';
    return (
        <div className="space-y-4">
            <dl className={cn(PANEL, 'grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x [&>div]:px-5 [&>div]:py-4')}>
                {([['Sold', logs.length], ['Unsold', unsold], ['Spent', inr(spent)], ['Top sale', logs.length ? inr(top) : '—']] as const).map(([k, v]) => (
                    <div key={k}><dt className="text-xs text-fg-subtle">{k}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-fg">{v}</dd></div>
                ))}
            </dl>
            {unsold > 0 && (
                <Notice tone="neutral" icon={Info}>
                    The auction ended with {plural(unsold, 'player')} unsold. They stay unassigned. You can place them on teams from Registrations.
                </Notice>
            )}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                <section aria-label="Team spending" className={PANEL}>
                    <div aria-hidden className={cn(COLHEAD, 'grid', cols)}>
                        <span>Team</span><span className="text-right">Bought</span><span className="text-right">Spent</span><span className="hidden text-right sm:block">Purse left</span>
                    </div>
                    <ul className="divide-y divide-line">
                        {teams.map(t => (
                            <li key={t._id} className={cn('grid items-center gap-x-4 px-5 py-3 text-[13px] text-fg', cols)}>
                                <span className="flex min-w-0 items-center gap-2.5"><TeamLogo size="sm" name={t.name} color={t.primaryColor} /><span className="truncate font-medium">{t.name}</span></span>
                                <span className="text-right tabular-nums">{logs.filter(l => l.teamId === t._id).length}</span>
                                <span className="text-right tabular-nums">{inr(t.totalSpent || 0)}</span>
                                <span className="hidden text-right tabular-nums text-fg-muted sm:block">{inr(t.budget)}</span>
                            </li>
                        ))}
                    </ul>
                </section>
                <SalesLog log={log} />
            </div>
        </div>
    );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function ManualSell({ name, base, teams, defaultTeam, defaultPrice, onSell, onClose }: {
    name: string; base: number; teams: Team[]; defaultTeam?: string; defaultPrice: number;
    onSell: (teamId: string, price: number) => Promise<void>; onClose: () => void;
}) {
    const [teamId, setTeamId] = useState(defaultTeam || '');
    const [price, setPrice] = useState(String(defaultPrice));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const t = teams.find(x => x._id === teamId);
    const n = Number(price);
    const invalid = price === '' ? 'Enter a price.' : !WHOLE.test(price) ? 'Use a whole number of rupees.'
        : t && n > t.budget ? `${t.name} has only ${inr(t.budget)} left.` : null;
    const sell = async () => {
        setBusy(true); setError('');
        try { await onSell(teamId, n); } catch (e) {
            setError(errText(e, "Couldn't record the sale. Check your connection and try again."));
            setBusy(false);
        }
    };
    return (
        <Dialog title="Sell manually" description={`${name} · base ${inr(base)}`} onClose={onClose} footer={<>
            <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
            <button type="button" disabled={!t || !!invalid || busy} onClick={sell} className={BTN_PRIMARY}>
                {busy && <Loader2 aria-hidden className={SPIN} />}Sell for {price && !invalid ? inr(n) : '…'}
            </button>
        </>}>
            <div className="grid gap-4">
                <p className="text-[13px] leading-relaxed text-fg-muted">Records a sale without bidding, for picks agreed off the system. The team's purse goes down by the price.</p>
                <Field label="Team">
                    <div role="radiogroup" aria-label="Team" className="grid gap-1.5">
                        {teams.map(x => (
                            <label key={x._id} className={cn(CHOICE, 'items-center p-2.5')}>
                                <input type="radio" name="ms-team" className="accent-primary" checked={teamId === x._id} onChange={() => setTeamId(x._id)} />
                                <TeamLogo size="sm" name={x.name} color={x.primaryColor} />
                                <span className="min-w-0 flex-1 truncate text-sm text-fg">{x.name}</span>
                                <span className="text-xs tabular-nums text-fg-subtle">{inr(x.budget)} left</span>
                            </label>
                        ))}
                    </div>
                </Field>
                <Field id="ms-price" label="Price" error={invalid}>
                    <MoneyInput id="ms-price" value={price} onChange={setPrice} step={100} invalid={!!invalid} />
                </Field>
                {error && <div role="alert"><Notice tone="red" icon={CircleAlert}>{error}</Notice></div>}
            </div>
        </Dialog>
    );
}

/** Spin for teams tied at the limit. The server picks the winner; the wheel just lands on them. */
function TieBreak({ teams, limit, winnerId, onSpin, onSell, onClose }: {
    teams: Team[]; limit: number; winnerId?: string | null;
    onSpin: () => Promise<string>; onSell: (teamId: string) => Promise<void>; onClose: () => void;
}) {
    const seg = 360 / teams.length;
    // Rotation that brings a team's segment under the pointer at the top.
    const stopAt = (id: string) => 360 - (teams.findIndex(t => t._id === id) * seg + seg / 2);
    const known = teams.some(t => t._id === winnerId) ? winnerId : null;
    const [angle, setAngle] = useState(() => (known ? stopAt(known) : 0));
    const [winner, setWinner] = useState(known);
    const [busy, setBusy] = useState<'spin' | 'sell' | null>(null);
    const [error, setError] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(timer.current), []);
    const w = teams.find(t => t._id === winner);

    const spin = async () => {
        setBusy('spin'); setError('');
        try {
            const id = await onSpin();
            const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            setAngle(a => a - (a % 360) + 360 * 6 + stopAt(id));
            timer.current = setTimeout(() => { setWinner(id); setBusy(null); }, still ? 0 : 3700);
        } catch (e) {
            setError(errText(e, "Couldn't spin. Check your connection and try again."));
            setBusy(null);
        }
    };
    const sell = async () => {
        setBusy('sell'); setError('');
        try { await onSell(winner); } catch (e) {
            setError(errText(e, "Couldn't record the sale. Check your connection and try again."));
            setBusy(null);
        }
    };
    const gradient = `conic-gradient(${teams.map((t, i) => `${t.primaryColor || '#71717A'} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ')})`;

    return (
        <Dialog title="Break the tie" onClose={onClose}
            description={`${teams.length} teams matched the ${inr(limit)} limit. The spin also plays on the public display.`}
            footer={w ? <>
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Not now</button>
                <button type="button" disabled={!!busy} onClick={sell} className={BTN_PRIMARY}>
                    {busy === 'sell' ? <Loader2 aria-hidden className={SPIN} /> : <Gavel aria-hidden className={ICON} />}Sell to {w.name} · {inr(limit)}
                </button>
            </> : <>
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" disabled={!!busy} onClick={spin} className={BTN_PRIMARY}>
                    {busy === 'spin' ? <><Loader2 aria-hidden className={SPIN} />Spinning…</> : <><Shuffle aria-hidden className={ICON} />Spin</>}
                </button>
            </>}>
            <div className="grid justify-items-center gap-4 py-2">
                <div className="relative h-52 w-52">
                    <span aria-hidden className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[14px] border-x-transparent border-t-fg" />
                    <div aria-hidden style={{ background: gradient, transform: `rotate(${angle}deg)` }}
                        className="relative h-full w-full rounded-full ring-4 ring-raised transition-transform duration-[3600ms] ease-[cubic-bezier(.15,.7,.2,1)] motion-reduce:transition-none">
                        {teams.map((t, i) => (
                            <span key={t._id} className="absolute left-1/2 top-1/2 text-[13px] font-bold text-canvas"
                                style={{ transform: `translate(-50%,-50%) rotate(${i * seg + seg / 2}deg) translateY(-62px)` }}>{initials(t.name)}</span>
                        ))}
                    </div>
                </div>
                <ul className="flex flex-wrap justify-center gap-2">
                    {teams.map(t => (
                        <li key={t._id} className={cn('flex items-center gap-2 rounded-md px-2 py-1 text-[13px] ring-1 ring-inset', winner === t._id ? 'bg-primary/[0.08] text-fg ring-primary/60' : 'text-fg-muted ring-line')}>
                            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: t.primaryColor || '#71717A' }} />{t.name}
                        </li>
                    ))}
                </ul>
                <p role="status" className="min-h-5 text-sm font-medium text-fg">{w ? `${w.name} wins the spin.` : busy === 'spin' ? 'Spinning…' : ''}</p>
                {error && <div role="alert" className="w-full"><Notice tone="red" icon={CircleAlert}>{error}</Notice></div>}
            </div>
        </Dialog>
    );
}
