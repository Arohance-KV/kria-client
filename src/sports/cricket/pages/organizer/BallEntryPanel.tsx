import { useEffect, useState } from 'react';
import { CircleAlert, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store/hooks';
import { BTN_SECONDARY, FOCUS } from '@/pages/organizer/shared';
import { ConfirmBar, Notice, PANEL } from '@/pages/organizer/ui';
import { recordBall, undoLastBall } from '@/sports/cricket/store/cricketLiveStateSlice';
import { type BallPayload } from '@/sports/cricket/api/cricketMatch';
import { buildPlayerNameMap, nameOf, xiSlots } from '@/sports/cricket/lib/lineup';
import WicketDialog from '@/sports/cricket/components/WicketDialog';
import NextPlayerPrompt from '@/sports/cricket/components/NextPlayerPrompt';
import LiveScoreboardPanel, { sidesOf } from './LiveScoreboardPanel';

interface Props {
    matchId: string;
    match: any;
    live: any;
    scorecard?: any;          // provided by CricketScoringConsole
    initialStrikerId?: string;
    initialNonStrikerId?: string;
    initialBowlerId?: string;
    maxOversPerBowler?: number;
    maxOvers?: number;
    /** "12.3 · 4": the delivery Undo would remove, when the scorecard is current. */
    lastBall?: string | null;
    /** Socket down: lock the pad so no ball is recorded blind. */
    offline?: boolean;
}

type Extra = '' | NonNullable<BallPayload['extrasType']>;

const EXTRAS: Array<[Exclude<Extra, ''>, string]> = [['wide', 'Wide'], ['no_ball', 'No-ball'], ['bye', 'Bye'], ['leg_bye', 'Leg-bye']];
const HINT: Record<Extra, string> = {
    '': 'Runs off the bat.',
    wide: 'Wide: 1 run is added. Tap the runs they ran, 0 if none.',
    no_ball: 'No-ball: 1 run is added. Tap the runs off the bat.',
    bye: 'Byes: tap the runs they ran.',
    leg_bye: 'Leg-byes: tap the runs they ran.',
};
const SUB: Record<Exclude<Extra, ''>, string> = { wide: '+1 wd', no_ball: '+1 nb', bye: 'b', leg_bye: 'lb' };

/**
 * The server's extras contract. A wide's extrasRuns is the wide's whole value
 * (the 1 penalty plus what they ran); a no-ball's runs are off the bat and
 * credited to the batter, its extrasRuns the 1 penalty.
 */
function ballPayload(extra: Extra, n: number): Partial<BallPayload> {
    if (extra === 'wide') return { runs: 0, extrasType: 'wide', extrasRuns: 1 + n };
    if (extra === 'no_ball') return { runs: n, extrasType: 'no_ball', extrasRuns: 1 };
    if (extra) return { runs: 0, extrasType: extra, extrasRuns: n };
    return { runs: n };
}

export default function BallEntryPanel({ matchId, match, live, scorecard, initialStrikerId, initialNonStrikerId, initialBowlerId, maxOversPerBowler, maxOvers, lastBall, offline }: Props) {
    const dispatch = useAppDispatch();
    const names = buildPlayerNameMap(match);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extra, setExtra] = useState<Extra>('');
    const [showWicket, setShowWicket] = useState(false);
    const [confirmUndo, setConfirmUndo] = useState(false);
    const [newBatter, setNewBatter] = useState('');
    const [newBowler, setNewBowler] = useState('');

    // Picks answer the prompt for ONE delivery. Any ball — ours, another
    // device's, or an undo — moves the tally, and the picks start over, so a
    // second wicket in a row never reuses the batter who just got out.
    const ballKey = `${live?.currentInnings}|${live?.completedOvers}|${live?.ballsInCurrentOver}|${live?.runs}|${live?.wickets}`;
    useEffect(() => { setNewBatter(''); setNewBowler(''); }, [ballKey]);

    // The ends as the scorer has them. The server's names win; an empty end is
    // the normal state while the organizer is still choosing — at an innings
    // start (openers are posted with the first ball) and between a wicket and
    // its replacement. After a wicket the engine empties whichever end the
    // dismissed batter occupied, and that empty is the only signal saying which
    // end to fill: a non-striker run-out, or a dismissal on the last ball of an
    // over, leaves the NON-striker end empty. Neither end empty is a wicket
    // recorded before the engine cleared ends, where the striker is replaced.
    const vacated = live?.nextBatsmanNeeded ? (!live.strikerId ? 'striker' : !live.nonStrikerId ? 'non' : 'striker') : null;
    const strikerId = vacated === 'striker' ? newBatter : (live?.strikerId || initialStrikerId || '');
    const nonStrikerId = vacated === 'non' ? newBatter : (live?.nonStrikerId || initialNonStrikerId || '');
    // While a new over waits for its bowler the server still names the last
    // over's bowler, who must not bowl again.
    const prevBowler = live?.nextBowlerNeeded ? live.currentBowlerId : undefined;
    const bowlerId = live?.nextBowlerNeeded ? newBowler : (live?.currentBowlerId || initialBowlerId || '');

    const { batting, bowling } = sidesOf(match, live);
    const battingXI = xiSlots(match, batting);
    const bowlingXI = xiSlots(match, bowling);

    // Mirrors the server: the match's own config, then the category's, then 4.
    const maxPerBowler = match?.matchConfig?.maxOversPerBowler ?? maxOversPerBowler ?? 4;
    const oversBy = (id: string): number => live?.bowlerStats?.[id]?.completedOvers ?? 0;

    // Retired hurt is not out for good: the laws let him resume.
    const inningsCard = live?.currentInnings === 2 ? scorecard?.innings2 : scorecard?.innings1;
    const dismissed = new Set<string>([
        ...(live?.dismissedIds ?? []).map(String),
        ...(inningsCard?.battingCard ?? []).filter((b: any) => b.dismissal && b.dismissal.type !== 'retired_hurt').map((b: any) => b.registrationId),
    ]);
    const atCrease = new Set([live?.strikerId, live?.nonStrikerId].filter(Boolean).map(String));
    const nextBatters = battingXI.filter(p => !atCrease.has(p.registrationId) && !dismissed.has(p.registrationId));

    const needPick = (!!live?.nextBatsmanNeeded && !newBatter) || (!!live?.nextBowlerNeeded && !newBowler);
    const locked = busy || !!offline || needPick;

    const send = async (fields: Partial<BallPayload>) => {
        if (!strikerId || !nonStrikerId || !bowlerId) {
            setError('Striker, non-striker and bowler must all be set.');
            return;
        }
        setBusy(true); setError(null); setConfirmUndo(false);
        try {
            const payload: BallPayload = { batsmanOnStrikeId: strikerId, nonStrikerId, bowlerId, runs: 0, ...fields };
            await dispatch(recordBall({ matchId, payload })).unwrap();
            setExtra('');
        } catch (e: any) {
            setError(e?.message || 'Failed to record the ball.');
        } finally { setBusy(false); }
    };

    const undo = async () => {
        setBusy(true); setError(null);
        try {
            await dispatch(undoLastBall(matchId)).unwrap();
            setConfirmUndo(false);
            setExtra('');
        } catch (e: any) {
            setError(e?.message || 'Nothing to undo.');
            setConfirmUndo(false);
        } finally { setBusy(false); }
    };

    // Both can be pending at once (a wicket on the last ball of an over); the
    // server clears neither until the next ball posts, so both stay re-pickable.
    const prompts = (
        <>
            {live?.nextBatsmanNeeded && (
                <NextPlayerPrompt title="Wicket. Who comes in?" label="Next batter" options={nextBatters} value={newBatter} onChange={setNewBatter} />
            )}
            {live?.nextBowlerNeeded && (
                <NextPlayerPrompt title={`Over ${live.completedOvers} done. Who bowls the next one?`} label="Next bowler" options={bowlingXI}
                    value={newBowler} onChange={setNewBowler}
                    note={id => `${oversBy(id)} of ${maxPerBowler} overs`}
                    disabledReason={id => (id === prevBowler ? 'Bowled the last over'
                        : oversBy(id) >= maxPerBowler ? `${maxPerBowler} of ${maxPerBowler} · done` : false)} />
            )}
        </>
    );

    const pad = (
        <section aria-label="Record a ball" className={cn(PANEL, 'overflow-hidden')}>
            <div className="grid gap-3 p-3 sm:p-4">
                {prompts}
                {error && <Notice tone="red" icon={CircleAlert}>{error}</Notice>}
                <div role="group" aria-label="Extras" className="grid grid-cols-4 gap-1.5">
                    {EXTRAS.map(([k, l]) => (
                        <button key={k} type="button" aria-pressed={extra === k} disabled={locked} onClick={() => setExtra(e => (e === k ? '' : k))}
                            className={cn('h-10 rounded-lg text-[13px] font-medium ring-1 ring-inset transition-colors disabled:opacity-40', FOCUS,
                                extra === k ? 'bg-amber-400/15 text-amber-200 ring-amber-400/50' : 'bg-canvas text-fg-muted ring-line hover:text-fg')}>
                            {l}
                        </button>
                    ))}
                </div>
                <p className={cn('text-xs', extra ? 'text-amber-200' : 'text-fg-subtle')}>{HINT[extra]}</p>
                <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2, 3, 4, 6].map(r => {
                        // Byes need a run to exist; a wide is worth at most 1 + 4.
                        const off = ((extra === 'bye' || extra === 'leg_bye') && r === 0) || (extra === 'wide' && r === 6);
                        const boundary = !extra && (r === 4 || r === 6);
                        return (
                            <button key={r} type="button" disabled={locked || off} onClick={() => send(ballPayload(extra, r))}
                                aria-label={`${r} ${r === 1 ? 'run' : 'runs'}${extra ? ` with ${EXTRAS.find(e => e[0] === extra)![1]}` : ''}`}
                                className={cn('flex h-16 flex-col items-center justify-center rounded-xl text-2xl font-semibold tabular-nums ring-1 ring-inset transition active:scale-[0.97] disabled:opacity-35', FOCUS,
                                    boundary && r === 4 ? 'bg-sky-400/10 text-sky-200 ring-sky-400/25 hover:bg-sky-400/15'
                                        : boundary ? 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/25 hover:bg-emerald-400/15'
                                            : 'bg-raised text-fg ring-line hover:bg-white/[0.08]')}>
                                {r}
                                {extra && <span className="text-[10px] font-medium text-amber-200/80">{SUB[extra]}</span>}
                            </button>
                        );
                    })}
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                    <button type="button" disabled={locked} onClick={() => setShowWicket(true)}
                        className={cn('h-12 rounded-xl bg-red-600 text-[15px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40', FOCUS)}>
                        Wicket
                    </button>
                    <button type="button" disabled={busy || !!offline} onClick={() => setConfirmUndo(true)} className={cn(BTN_SECONDARY, 'h-12 rounded-xl px-4')}>
                        <Undo2 aria-hidden className="h-4 w-4" />Undo
                    </button>
                </div>
                {lastBall && <p className="text-xs text-fg-subtle">Last ball: <span className="text-fg-muted">{lastBall}</span></p>}
            </div>
            {confirmUndo && (
                <ConfirmBar confirmLabel="Undo ball" busy={busy} onCancel={() => setConfirmUndo(false)} onConfirm={undo}
                    message={lastBall ? `Undo ${lastBall}?` : 'Undo the last ball?'} />
            )}
        </section>
    );

    return (
        <>
            <LiveScoreboardPanel match={match} live={live} scorecard={scorecard} maxOvers={maxOvers}
                strikerId={strikerId} nonStrikerId={nonStrikerId} bowlerId={bowlerId} pad={pad} />
            {showWicket && (
                <WicketDialog
                    strikerId={strikerId}
                    nonStrikerId={nonStrikerId}
                    bowlerId={bowlerId}
                    ball={`${live?.completedOvers ?? 0}.${(live?.ballsInCurrentOver ?? 0) + 1}`}
                    nameOf={(id) => nameOf(names, id)}
                    fieldingXI={bowlingXI}
                    onCancel={() => setShowWicket(false)}
                    onConfirm={(r) => {
                        setShowWicket(false);
                        send({ runs: r.runs, wicketType: r.wicketType, dismissedPlayerId: r.dismissedPlayerId, fielderId: r.fielderId });
                    }}
                />
            )}
        </>
    );
}
