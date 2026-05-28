import React, { useEffect, useState } from 'react';
import { Loader2, Undo2, AlertCircle } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { recordBall, undoLastBall } from '@/sports/cricket/store/cricketLiveStateSlice';
import { type BallPayload } from '@/sports/cricket/api/cricketMatch';
import { buildPlayerNameMap, nameOf, xiSlots, type PlayerSlot } from '@/sports/cricket/lib/lineup';
import WicketDialog, { type WicketResult } from '@/sports/cricket/components/WicketDialog';
import NextPlayerPrompt from '@/sports/cricket/components/NextPlayerPrompt';

interface Props {
    matchId: string;
    match: any;
    live: any;
    scorecard?: any;          // provided by CricketScoringConsole — used for dismissed IDs
    initialStrikerId?: string;
    initialNonStrikerId?: string;
    initialBowlerId?: string;
}

const EXTRA_LABELS: Record<string, string> = {
    wide: 'Wide', no_ball: 'No-ball', bye: 'Bye', leg_bye: 'Leg-bye',
};

export default function BallEntryPanel({ matchId, match, live, scorecard, initialStrikerId, initialNonStrikerId, initialBowlerId }: Props) {
    const dispatch = useAppDispatch();
    const names = buildPlayerNameMap(match);

    const [strikerId,    setStrikerId]    = useState(live?.strikerId         || initialStrikerId    || '');
    const [nonStrikerId, setNonStrikerId] = useState(live?.nonStrikerId      || initialNonStrikerId || '');
    const [bowlerId,     setBowlerId]     = useState(live?.currentBowlerId   || initialBowlerId     || '');
    const [busy,         setBusy]         = useState(false);
    const [error,        setError]        = useState<string | null>(null);
    const [showWicket,   setShowWicket]   = useState(false);
    const [extra,        setExtra]        = useState<{ type: BallPayload['extrasType']; runs: number } | null>(null);
    const [awaitingBatsman, setAwaitingBatsman] = useState(false);
    const [awaitingBowler,  setAwaitingBowler]  = useState(false);
    const [lastBall, setLastBall] = useState<string | null>(null);

    useEffect(() => {
        if (live?.strikerId)        setStrikerId(live.strikerId);
        if (live?.nonStrikerId)     setNonStrikerId(live.nonStrikerId);
        if (live?.currentBowlerId)  setBowlerId(live.currentBowlerId);
    }, [live?.strikerId, live?.nonStrikerId, live?.currentBowlerId]);

    useEffect(() => { if (live?.nextBatsmanNeeded) setAwaitingBatsman(true); },  [live?.nextBatsmanNeeded]);
    useEffect(() => { if (live?.nextBowlerNeeded)  setAwaitingBowler(true); },   [live?.nextBowlerNeeded]);

    const battingXI: PlayerSlot[] = xiSlots(match, live?.battingTeamId);
    const bowlingXI: PlayerSlot[] = xiSlots(match, live?.bowlingTeamId);
    const battedOrActive = new Set([strikerId, nonStrikerId].filter(Boolean));

    // Derive dismissed IDs from the passed scorecard (no extra fetch needed).
    const dismissedIds: Set<string> = React.useMemo(() => {
        const innings = live?.currentInnings === 2 ? scorecard?.innings2 : scorecard?.innings1;
        return new Set<string>(
            (innings?.battingCard || [])
                .filter((b: any) => !!b.dismissal)
                .map((b: any) => b.registrationId as string),
        );
    }, [scorecard, live?.currentInnings]);

    const availableBatsmen = battingXI.filter(p =>
        !battedOrActive.has(p.registrationId) && !dismissedIds.has(p.registrationId),
    );

    const send = async (extraFields: Partial<BallPayload>) => {
        if (!strikerId || !nonStrikerId || !bowlerId) {
            setError('Striker, non-striker and bowler must all be set.');
            return;
        }
        setBusy(true); setError(null);
        try {
            const payload: BallPayload = { batsmanOnStrikeId: strikerId, nonStrikerId, bowlerId, runs: 0, ...extraFields };
            await dispatch(recordBall({ matchId, payload })).unwrap();
            // Quick visual feedback of what was just recorded
            const label = extraFields.extrasType
                ? `${EXTRA_LABELS[extraFields.extrasType!]} +${extraFields.extrasRuns ?? 0}`
                : extraFields.wicketType
                    ? 'W'
                    : `${extraFields.runs ?? 0}`;
            setLastBall(label);
            setTimeout(() => setLastBall(null), 1800);
            setExtra(null);
        } catch (e: any) {
            setError(e?.message || 'Failed to record ball.');
        } finally { setBusy(false); }
    };

    const undo = async () => {
        setBusy(true); setError(null);
        try { await dispatch(undoLastBall(matchId)).unwrap(); setLastBall('↩ Undone'); setTimeout(() => setLastBall(null), 1500); }
        catch (e: any) { setError(e?.message || 'Nothing to undo.'); }
        finally { setBusy(false); }
    };

    // ── Select next batsman ──────────────────────────────────────────────────
    if (awaitingBatsman) {
        return (
            <NextPlayerPrompt
                title="Select next batsman"
                candidates={availableBatsmen}
                onSelect={(id) => { setStrikerId(id); setAwaitingBatsman(false); }}
            />
        );
    }

    // ── Select next bowler ──────────────────────────────────────────────────
    if (awaitingBowler) {
        return (
            <NextPlayerPrompt
                title="Select next bowler (new over)"
                candidates={bowlingXI}
                onSelect={(id) => { setBowlerId(id); setAwaitingBowler(false); }}
            />
        );
    }

    // ── Run button helper ────────────────────────────────────────────────────
    const runBtn = (n: number) => {
        const extraClass = n === 6 ? 'sc-btn-6' : n === 4 ? 'sc-btn-4' : '';
        return (
            <button
                key={n}
                disabled={busy || !!extra}
                onClick={() => send({ runs: n })}
                className={`sc-run-btn ${extraClass}`}
                style={{ minHeight: 72 }}
                aria-label={`${n} runs`}
            >
                {n}
            </button>
        );
    };

    return (
        <div className="sc-card p-4 flex flex-col gap-3 sc-fadein">

            {/* ── Context strip ── */}
            <div className="flex items-center justify-between gap-2 px-1">
                <div className="text-xs text-gray-500 leading-5">
                    <span className="text-gray-400 font-semibold">{nameOf(names, strikerId)}</span>
                    <span className="text-gray-600"> ★ vs </span>
                    <span className="text-gray-400 font-semibold">{nameOf(names, bowlerId)}</span>
                </div>
                {lastBall && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${lastBall === '↩ Undone' ? 'bg-white/8 text-gray-400' : lastBall === 'W' ? 'bg-red-500/20 text-red-400' : 'bg-[#F97316]/15 text-[#F97316]'}`}>
                        {lastBall === '↩ Undone' ? lastBall : `+${lastBall}`}
                    </span>
                )}
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Run buttons 3×2 ── */}
            <div className="grid grid-cols-3 gap-2.5">
                {[0, 1, 2, 3, 4, 6].map(runBtn)}
            </div>

            {/* ── Extras row ── */}
            <div>
                <div className="text-[9px] uppercase tracking-widest text-gray-600 font-bold mb-1.5 px-0.5">Extras</div>
                <div className="grid grid-cols-4 gap-2">
                    {(['wide', 'no_ball', 'bye', 'leg_bye'] as const).map(t => (
                        <button
                            key={t}
                            disabled={busy}
                            onClick={() => setExtra(prev => prev?.type === t ? null : { type: t, runs: 1 })}
                            className={`sc-extra-btn ${extra?.type === t ? 'sc-extra-active' : ''}`}
                        >
                            {EXTRA_LABELS[t]}
                        </button>
                    ))}
                </div>

                {/* Extra run picker */}
                {extra && (
                    <div className="mt-2 flex items-center gap-2 bg-white/3 border border-white/8 rounded-xl px-3 py-2.5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold shrink-0">
                            {EXTRA_LABELS[extra.type!]} runs:
                        </span>
                        <div className="flex gap-1.5 flex-1 flex-wrap">
                            {[0, 1, 2, 3, 4].map(r => (
                                <button
                                    key={r}
                                    onClick={() => setExtra({ ...extra, runs: r })}
                                    className={`sc-pip ${extra.runs === r ? 'sc-pip-active' : ''}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <button
                            disabled={busy}
                            onClick={() => send({ runs: 0, extrasType: extra.type, extrasRuns: extra.runs })}
                            className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 transition-colors"
                        >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-white/5" />

            {/* ── WICKET + Undo ── */}
            <div className="flex gap-2.5">
                <button
                    disabled={busy}
                    onClick={() => setShowWicket(true)}
                    className="sc-wicket-btn"
                    style={{ minHeight: 56 }}
                >
                    {busy
                        ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        : 'WICKET'}
                </button>
                <button
                    disabled={busy}
                    onClick={undo}
                    className="sc-undo-btn shrink-0 px-4"
                    style={{ minHeight: 56, width: 80 }}
                    title="Undo last ball"
                >
                    {busy
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <><Undo2 className="h-4 w-4" /><span className="text-xs">Undo</span></>}
                </button>
            </div>

            {/* ── Wicket dialog ── */}
            {showWicket && (
                <WicketDialog
                    strikerId={strikerId}
                    nonStrikerId={nonStrikerId}
                    nameOf={(id) => nameOf(names, id)}
                    fieldingXI={bowlingXI}
                    onCancel={() => setShowWicket(false)}
                    onConfirm={(r: WicketResult) => {
                        setShowWicket(false);
                        send({ runs: r.runs, wicketType: r.wicketType, dismissedPlayerId: r.dismissedPlayerId, fielderId: r.fielderId });
                    }}
                />
            )}
        </div>
    );
}
