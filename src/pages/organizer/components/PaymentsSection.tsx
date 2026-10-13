import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { getTournamentPayments } from '@/api/payment';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchRegistrationsByTournament, Registration } from '@/store/slices/registrationSlice';
import { cn } from '@/lib/utils';
import { BTN_SECONDARY, FOCUS, inr, Tone, ToneBadge } from '../shared';
import { Avatar, COLHEAD, EmptyState, PageHead, PANEL, ROW, SearchInput, SegTabs, Spinner, Toolbar } from '../ui';

type PayStatus = 'created' | 'paid' | 'failed' | 'refunded';
type Payment = {
    _id: string; playerId: string; categoryId: string; registrationId?: string;
    razorpayOrderId: string; razorpayPaymentId?: string;
    amount: number; baseAmount?: number; feeBreakdown?: { razorpayFee: number; platformFee: number; gst: number };
    status: PayStatus; createdAt: string;
};

const PAY_STATUS: Record<PayStatus, { label: string; tone: Tone }> = {
    paid: { label: 'Paid', tone: 'green' },
    created: { label: 'Checkout started', tone: 'neutral' },
    failed: { label: 'Failed', tone: 'red' },
    refunded: { label: 'Refunded', tone: 'blue' },
};
const TABS: { key: 'all' | PayStatus; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'paid', label: 'Paid' }, { key: 'created', label: 'Checkout started' },
    { key: 'failed', label: 'Failed' }, { key: 'refunded', label: 'Refunded' },
];

const COLS = 'grid-cols-[minmax(0,1fr)_auto] @5xl:grid-cols-[minmax(0,1.4fr)_7.5rem_9.5rem_5rem_minmax(0,1fr)_2rem]';
const WIDE = 'hidden @5xl:block';
const NARROW = '@5xl:hidden';
const statusOf = (s: string) => PAY_STATUS[s as PayStatus] ?? { label: s, tone: 'neutral' as Tone };
const money = (n: number) => Math.round(n * 100) / 100;
const day = (d: string) => (d ? format(new Date(d), 'd MMM') : '—');
const playerName = (r: Registration) => [r.profile?.firstName, r.profile?.lastName].filter(Boolean).join(' ');

const CopyButton = ({ value, label }: { value: string; label: string }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* Clipboard blocked: the ID stays on screen to copy by hand. */ }
    };
    const Icon = copied ? Check : Copy;
    return (
        <button type="button" onClick={copy} aria-label={label}
            className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md align-middle text-fg-subtle hover:bg-white/[0.05] hover:text-fg', FOCUS)}>
            <Icon aria-hidden className="h-3.5 w-3.5" />
            <span className="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</span>
        </button>
    );
};

const Metric = ({ label, value, sub }: { label: string; value: string | number; sub: string }) => (
    <div className="bg-panel px-4 py-3.5 sm:px-5">
        <p className="text-[13px] text-fg-muted">{label}</p>
        <p className="mt-1.5 text-[22px] font-semibold leading-[30px] tracking-tight tabular-nums text-fg">{value}</p>
        <p className="mt-0.5 text-xs text-fg-subtle">{sub}</p>
    </div>
);

export default function PaymentsSection({ tournamentId }: { tournamentId: string }) {
    const dispatch = useAppDispatch();
    const { tournamentRegistrations: regs, categories } = useAppSelector(s => s.registration);
    const [payments, setPayments] = useState<Payment[] | null>(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'all' | PayStatus>('all');
    const [q, setQ] = useState('');
    const [open, setOpen] = useState<string | null>(null);

    const load = () => {
        setPayments(null);
        setError('');
        getTournamentPayments(tournamentId)
            .then(data => setPayments(Array.isArray(data) ? data : []))
            .catch(e => setError(e?.response?.data?.message || 'Check your connection and try again.'));
    };
    useEffect(() => {
        load();
        // Names come from the registrations list; a failure there only falls back to player IDs.
        dispatch(fetchRegistrationsByTournament({ tournamentId }));
    }, [dispatch, tournamentId]);

    // Paid payments carry their registration; unfinished checkouts don't, so fall back to the player's other entries.
    const rows = (payments ?? []).map(p => {
        const reg = regs.find(r => r._id === p.registrationId) ?? regs.find(r => r.playerId === p.playerId);
        const base = p.baseAmount ?? p.amount;
        return {
            ...p, base,
            name: (reg && playerName(reg)) || p.playerId,
            category: categories.find(c => c._id === p.categoryId)?.name ?? '',
        };
    });

    const paid = rows.filter(p => p.status === 'paid');
    const receive = money(paid.reduce((s, p) => s + p.base, 0));
    const gross = money(paid.reduce((s, p) => s + p.amount, 0));
    const count = (s: PayStatus) => rows.filter(p => p.status === s).length;

    const needle = q.trim().toLowerCase();
    const list = rows.filter(p => (tab === 'all' || p.status === tab)
        && (!needle || [p.name, p.razorpayOrderId, p.razorpayPaymentId].join(' ').toLowerCase().includes(needle)));

    const head = <PageHead title="Payments" desc="Entry fees players paid online for this tournament. Read-only." />;

    if (error) return (
        <div className="space-y-6">
            {head}
            <div className={PANEL}>
                <EmptyState title="Payments didn't load" text={error}
                    action={<button type="button" onClick={load} className={BTN_SECONDARY}>Try again</button>} />
            </div>
        </div>
    );
    if (!payments) return <div className="space-y-6">{head}<Spinner label="Loading payments" /></div>;

    return (
        <div className="@container space-y-6">
            {head}
            <section aria-label="Payment summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line @4xl:grid-cols-4">
                <Metric label="You receive" value={inr(receive)} sub={`Entry fees from ${paid.length} paid ${paid.length === 1 ? 'entry' : 'entries'}`} />
                <Metric label="Players paid" value={inr(gross)} sub="Including fees and GST" />
                <Metric label="Fees and GST" value={inr(money(gross - receive))} sub="Gateway 2% · platform 2% · 18% GST" />
                <Metric label="Not completed" value={count('created') + count('failed')} sub={`${count('created')} checkout started · ${count('failed')} failed`} />
            </section>

            <section aria-label="Payments" className={cn(PANEL, 'overflow-hidden')}>
                {rows.length === 0 ? (
                    <EmptyState title="No payments yet" text="Online entry fees show up here once players pay for a paid category." />
                ) : (
                    <>
                        <Toolbar>
                            <SegTabs<'all' | PayStatus> label="Status" value={tab} onChange={setTab}
                                items={TABS.map(t => ({ ...t, count: t.key === 'all' ? rows.length : count(t.key) }))} />
                            <SearchInput label="Search payments" placeholder="Search player or order ID" value={q} onChange={setQ} />
                        </Toolbar>
                        {list.length === 0 ? (
                            <EmptyState title="No payments match" text="Try another status, or clear the search."
                                action={<button type="button" onClick={() => { setTab('all'); setQ(''); }} className={BTN_SECONDARY}>Clear filters</button>} />
                        ) : (
                            <>
                                <div aria-hidden className={cn(COLHEAD, COLS, 'hidden @5xl:grid')}>
                                    <span>Player</span><span className="text-right">Amount</span><span>Status</span><span>Date</span><span>Order ID</span><span />
                                </div>
                                <ul className="divide-y divide-line">
                                    {list.map(p => {
                                        const isOpen = open === p._id;
                                        const fb = p.feeBreakdown;
                                        const lines: [string, number][] = fb
                                            ? [['Gateway fee (2%)', fb.razorpayFee], ['Platform fee (2%)', fb.platformFee], ['GST on fees (18%)', fb.gst]]
                                            : [['Fees and GST', money(p.amount - p.base)]];
                                        return (
                                            <li key={p._id}>
                                                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p._id)}
                                                    className={cn(ROW, COLS, 'w-full text-left transition-colors hover:bg-white/[0.025]', isOpen && 'bg-white/[0.025]', FOCUS)}>
                                                    <span className="flex min-w-0 items-center gap-2.5">
                                                        <Avatar name={p.name} />
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
                                                            <span className="mt-0.5 block truncate text-[13px] text-fg-subtle">
                                                                {p.category}<span className={NARROW}>{p.category && ' · '}{day(p.createdAt)}</span>
                                                            </span>
                                                            <span className={cn(NARROW, 'mt-1.5 block')}><ToneBadge {...statusOf(p.status)} /></span>
                                                        </span>
                                                    </span>
                                                    <span className="text-right text-[13.5px] tabular-nums text-fg">
                                                        {inr(p.amount)}<small className="block text-xs text-fg-subtle">{inr(p.base)} entry fee</small>
                                                    </span>
                                                    <span className={WIDE}><ToneBadge {...statusOf(p.status)} /></span>
                                                    <span className={cn(WIDE, 'text-[13.5px] tabular-nums text-fg-muted')}>{day(p.createdAt)}</span>
                                                    <span className={cn(WIDE, 'truncate font-mono text-[12.5px] text-fg-subtle')}>{p.razorpayOrderId}</span>
                                                    <span className={cn(WIDE, 'text-fg-subtle')}>
                                                        {isOpen ? <ChevronDown aria-hidden className="h-4 w-4" /> : <ChevronRight aria-hidden className="h-4 w-4" />}
                                                    </span>
                                                </button>
                                                {isOpen && (
                                                    <div className="grid gap-3 px-4 pb-4 pt-1 sm:px-5">
                                                        <dl className="grid max-w-[420px] gap-1.5 text-[13px]">
                                                            {[['Entry fee (you receive)', p.base] as [string, number], ...lines].map(([k, v]) => (
                                                                <div key={k} className="flex justify-between gap-4">
                                                                    <dt className="text-fg-muted">{k}</dt><dd className="tabular-nums text-fg">{inr(v)}</dd>
                                                                </div>
                                                            ))}
                                                            <div className="flex justify-between gap-4 border-t border-line pt-1.5 font-semibold">
                                                                <dt className="text-fg">Player paid</dt><dd className="tabular-nums text-fg">{inr(p.amount)}</dd>
                                                            </div>
                                                        </dl>
                                                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-fg-subtle">
                                                            <span className="break-all">Order <span className="font-mono">{p.razorpayOrderId}</span> <CopyButton value={p.razorpayOrderId} label="Copy order ID" /></span>
                                                            {p.razorpayPaymentId && (
                                                                <span className="break-all">Payment <span className="font-mono">{p.razorpayPaymentId}</span> <CopyButton value={p.razorpayPaymentId} label="Copy payment ID" /></span>
                                                            )}
                                                        </div>
                                                        {p.status === 'created' && (
                                                            <p className="text-[12.5px] text-fg-subtle">The player opened checkout but didn't finish paying. No money was taken.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
