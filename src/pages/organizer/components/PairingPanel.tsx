import React, { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Info } from 'lucide-react';
import { changePartner, getPairs, pairPlayers, unpairPlayer } from '@/api/pairs';
import { pairSummary, teamCards, type PairingPlayer, type PairingState } from '@/lib/pairs';
import { cn } from '@/lib/utils';
import { BTN_GHOST, BTN_SECONDARY, BTN_SM, FOCUS } from '../shared';
import { Avatar, Notice, PANEL, Spinner, TeamLogo } from '../ui';

const messageOf = (err: any, fallback: string): string =>
    err?.response?.data?.message || err?.response?.data?.data?.message || fallback;

interface Props {
    categoryId: string;
    readOnly: boolean;
    /** Every state the panel loads or a write returns, so the page can gate Generate and spot a stale draw. */
    onChange: (state: PairingState) => void;
    /** After a pair edit lands. A drawn category reloads its bracket here: a partner change renames sides. */
    onWrite?: () => void;
}

/**
 * Doubles pairing for one category: each team's players, paired the way the
 * team told the organiser. The first pick is the player who stays; the second
 * is their partner. Two unpaired players pair up; picking a paired player (or
 * a paired teammate second) changes that player's partner, which keeps the
 * pair's place in a draw. A pick on another team just moves the pick.
 */
const PairingPanel: React.FC<Props> = ({ categoryId, readOnly, onChange, onWrite }) => {
    const [state, setState] = useState<PairingState | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState<PairingPlayer | null>(null);
    const [busy, setBusy] = useState(false);

    const take = useCallback((next: PairingState) => { setState(next); onChange(next); }, [onChange]);

    const load = useCallback(async () => {
        setLoadError(null);
        try { take(await getPairs(categoryId)); } catch (err) { setLoadError(messageOf(err, 'Could not load the pairs.')); }
    }, [categoryId, take]);

    useEffect(() => { setState(null); setPicked(null); setError(null); load(); }, [load]);

    const run = async (write: () => Promise<PairingState>) => {
        setBusy(true); setError(null);
        try { take(await write()); onWrite?.(); } catch (err) { setError(messageOf(err, 'Could not change the pairs.')); } finally { setBusy(false); }
    };

    const pick = (p: PairingPlayer) => {
        const first = picked;
        if (!first || first.teamId !== p.teamId) return setPicked(p);
        setPicked(null);
        if (first.registrationId === p.registrationId) return;
        if (!first.partnerRegistrationId && !p.partnerRegistrationId) run(() => pairPlayers(categoryId, first.registrationId, p.registrationId));
        else if (first.partnerRegistrationId) run(() => changePartner(first.registrationId, p.registrationId));
        else run(() => changePartner(p.registrationId, first.registrationId));
    };

    if (loadError) {
        return (
            <section className={cn(PANEL, 'p-4')}>
                <div role="alert"><Notice tone="red" icon={CircleAlert}>{loadError}</Notice></div>
                <button type="button" onClick={load} className={cn(BTN_SECONDARY, 'mt-3')}>Try again</button>
            </section>
        );
    }
    if (!state) return <section className={PANEL}><Spinner label="Loading pairs" /></section>;

    const editable = !readOnly && !state.locked;
    const { pairs, unpaired } = pairSummary(state);
    const hint = !editable ? null : picked ? `Now pick ${picked.name}'s partner on the same team` : 'Pick a player, then their partner';

    const name = (p: PairingPlayer) => editable ? (
        <button type="button" onClick={() => pick(p)} disabled={busy} aria-pressed={picked?.registrationId === p.registrationId}
            className={cn('rounded px-0.5 hover:text-primary', FOCUS, picked?.registrationId === p.registrationId && 'text-primary')}>
            {p.name}
        </button>
    ) : <span>{p.name}</span>;

    return (
        <div className="flex flex-col gap-4">
            <Notice tone="blue" icon={Info}>
                Pair each team's players the way the team told you, then generate the draw. Partners must be on the same team.
                Each pair plays as one side, and both partners get the result and any title.
            </Notice>
            {error && <div role="alert"><Notice tone="red" icon={CircleAlert}>{error}</Notice></div>}

            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2.5">
                    <h2 className="text-[15px] font-semibold text-fg">Pairs</h2>
                    <span className="text-[13px] text-fg-muted">{pairs} {pairs === 1 ? 'pair' : 'pairs'} · {unpaired.length} unpaired</span>
                </div>
                {hint && <span className="text-[12.5px] text-fg-subtle">{hint}</span>}
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3">
                {teamCards(state).map(card => (
                    <section key={card.team._id} aria-label={card.team.name} className={cn(PANEL, 'flex flex-col')}>
                        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
                            <TeamLogo name={card.team.name} logo={card.team.logo} color={card.team.primaryColor} size="sm" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-fg">{card.team.name}</p>
                                <p className="text-xs text-fg-subtle">
                                    {card.pairs.length * 2 + card.unpaired.length} players · {card.pairs.length} {card.pairs.length === 1 ? 'pair' : 'pairs'}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col px-2 py-1.5">
                            {card.pairs.map(([x, y], i) => (
                                <div key={x.registrationId} className="flex items-center gap-2.5 p-2">
                                    <span className="w-4 text-xs tabular-nums text-fg-subtle">{i + 1}</span>
                                    <span className="flex">
                                        <Avatar name={x.name} size="sm" />
                                        <span className="-ml-1.5"><Avatar name={y.name} size="sm" /></span>
                                    </span>
                                    <span className="min-w-0 flex-1 text-[13.5px] text-fg">{name(x)} / {name(y)}</span>
                                    {editable && (
                                        <button type="button" onClick={() => run(() => unpairPlayer(x.registrationId))} disabled={busy}
                                            aria-label={`Unpair ${x.name} and ${y.name}`} className={cn(BTN_GHOST, BTN_SM)}>
                                            Unpair
                                        </button>
                                    )}
                                </div>
                            ))}
                            {card.pairs.length === 0 && <p className="p-2 text-[13px] text-fg-subtle">No pairs yet.</p>}
                        </div>

                        {card.unpaired.length > 0 && (
                            <div className="flex flex-col gap-2 border-t border-line px-4 pb-3.5 pt-3">
                                <span className="text-xs font-medium text-fg-subtle">Unpaired</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {card.unpaired.map(p => editable ? (
                                        <button key={p.registrationId} type="button" onClick={() => pick(p)} disabled={busy}
                                            aria-pressed={picked?.registrationId === p.registrationId}
                                            className={cn('inline-flex h-8 items-center gap-1.5 rounded-full bg-raised pl-1 pr-2.5 text-[13px] text-fg ring-1 ring-inset', FOCUS,
                                                picked?.registrationId === p.registrationId ? 'bg-primary/[0.12] ring-primary' : 'ring-line hover:ring-white/20')}>
                                            <Avatar name={p.name} size="sm" />{p.name}
                                        </button>
                                    ) : (
                                        <span key={p.registrationId} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-raised pl-1 pr-2.5 text-[13px] text-fg ring-1 ring-inset ring-line">
                                            <Avatar name={p.name} size="sm" />{p.name}
                                        </span>
                                    ))}
                                </div>
                                {card.unpaired.length === 1 && (
                                    <span className="text-[12.5px] text-amber-300">Odd one out: sits out the draw unless the team bought another player.</span>
                                )}
                            </div>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
};

export default PairingPanel;
