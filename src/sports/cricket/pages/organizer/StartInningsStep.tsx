import { useState } from 'react';
import { CircleAlert, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store/hooks';
import { BTN_GHOST, BTN_PRIMARY, BTN_SM, ToneBadge } from '@/pages/organizer/shared';
import { ConfirmBar, Field, Notice, PANEL } from '@/pages/organizer/ui';
import { undoLastBall } from '@/sports/cricket/store/cricketLiveStateSlice';
import type { PlayerSlot } from '@/sports/cricket/lib/lineup';
import { PickChips } from '@/sports/cricket/components/NextPlayerPrompt';
import { CricketTeamLogo, teamName } from './LiveScoreboardPanel';

interface Props {
    inningsNumber: number;
    battingTeamId?: string;
    battingTeam: string;
    bowlingTeam: string;
    battingXI: PlayerSlot[];
    bowlingXI: PlayerSlot[];
    /** Line above the pickers, e.g. who won the toss. */
    note?: string;
    onReady: (openers: { strikerId: string; nonStrikerId: string; bowlerId: string }) => void;
}

/** Openers and the first bowler. Local only: they are posted with the first ball. */
export default function StartInningsStep({ inningsNumber, battingTeamId, battingTeam, bowlingTeam, battingXI, bowlingXI, note, onReady }: Props) {
    const [strikerId, setStrikerId] = useState('');
    const [nonStrikerId, setNonStrikerId] = useState('');
    const [bowlerId, setBowlerId] = useState('');
    const valid = !!strikerId && !!nonStrikerId && !!bowlerId && strikerId !== nonStrikerId;

    return (
        <section className={cn(PANEL, 'mx-auto w-full max-w-2xl overflow-hidden')}>
            <div className="grid gap-5 p-5 sm:p-6">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-semibold">
                        <CricketTeamLogo size="sm" id={battingTeamId} name={battingTeam} />{inningsNumber === 2 ? '2nd' : '1st'} innings: {battingTeam} bat
                    </h1>
                    <p className="mt-1 text-[13px] text-fg-muted">{note ? `${note} ` : ''}Pick the openers and who bowls the first over.</p>
                </div>
                <Field label="On strike">
                    <PickChips label="On strike" options={battingXI} value={strikerId} onChange={setStrikerId}
                        disabledReason={id => id === nonStrikerId && 'At the other end'} />
                </Field>
                <Field label="Non-striker">
                    <PickChips label="Non-striker" options={battingXI} value={nonStrikerId} onChange={setNonStrikerId}
                        disabledReason={id => id === strikerId && 'On strike'} />
                </Field>
                <Field label={`Opening bowler · ${bowlingTeam}`}>
                    <PickChips label="Opening bowler" options={bowlingXI} value={bowlerId} onChange={setBowlerId} />
                </Field>
            </div>
            <footer className="flex justify-end border-t border-line px-5 py-3">
                <button type="button" disabled={!valid} onClick={() => onReady({ strikerId, nonStrikerId, bowlerId })} className={BTN_PRIMARY}>
                    Start scoring
                </button>
            </footer>
        </section>
    );
}

/** First-innings score, the target and the top performers, with an undo back into the 1st innings. */
export function InningsBreak({ matchId, match, live, scorecard, lastBall, maxOvers, offline }: {
    matchId: string; match: any; live: any; scorecard?: any; lastBall?: string | null; maxOvers: number; offline?: boolean;
}) {
    const dispatch = useAppDispatch();
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The engine has already swapped sides: the team now bowling batted first.
    const s = live?.innings1Summary ?? {};
    const target = live?.target ?? (s.runs ?? 0) + 1;
    const inn1 = scorecard?.innings1;
    const bats = [...(inn1?.battingCard ?? [])].sort((a: any, b: any) => b.runs - a.runs).slice(0, 2);
    const bowls = [...(inn1?.bowlingCard ?? [])].sort((a: any, b: any) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 2);
    const top = [
        bats[0] && [bats[0].name, `${bats[0].runs} (${bats[0].ballsFaced})`],
        bowls[0] && [bowls[0].name, `${bowls[0].wickets}/${bowls[0].runs} (${bowls[0].overs})`],
        bats[1] && [bats[1].name, `${bats[1].runs} (${bats[1].ballsFaced})`],
        bowls[1] && [bowls[1].name, `${bowls[1].wickets}/${bowls[1].runs} (${bowls[1].overs})`],
    ].filter(Boolean) as string[][];

    const undo = async () => {
        setBusy(true); setError(null);
        try { await dispatch(undoLastBall(matchId)).unwrap(); }
        catch (e: any) { setError(e?.message || 'Nothing to undo.'); }
        finally { setBusy(false); setConfirm(false); }
    };

    return (
        <section className={cn(PANEL, 'overflow-hidden')}>
            <div className="p-5 sm:p-6">
                <ToneBadge label="Innings break" tone="blue" />
                <p className="mt-3 text-sm text-fg-muted">{teamName(match, live?.bowlingTeamId)}</p>
                <p className="flex items-baseline gap-2">
                    <span className="text-[36px] font-semibold leading-none tracking-tight tabular-nums">{s.runs ?? 0}/{s.wickets ?? 0}</span>
                    <span className="text-sm text-fg-muted">{s.completedOvers ?? 0}{s.ballsInCurrentOver ? `.${s.ballsInCurrentOver}` : ''} ov</span>
                </p>
                <p className="mt-3 text-[15px]">
                    <span className="font-semibold">{teamName(match, live?.battingTeamId)} need {target}</span>{' '}
                    <span className="text-fg-muted">from {maxOvers * 6} balls · {(target / maxOvers).toFixed(2)} an over</span>
                </p>
                {top.length > 0 && (
                    <dl className="mt-4 grid gap-1.5 border-t border-line pt-4 text-[13px] sm:grid-cols-2 sm:gap-x-6">
                        {top.map(([name, fig]) => (
                            <div key={name} className="flex justify-between gap-3"><dt className="text-fg-muted">{name}</dt><dd className="tabular-nums">{fig}</dd></div>
                        ))}
                    </dl>
                )}
                {error && <Notice tone="red" icon={CircleAlert} className="mt-4">{error}</Notice>}
            </div>
            {confirm ? (
                <ConfirmBar confirmLabel="Undo last ball" busy={busy} onCancel={() => setConfirm(false)} onConfirm={undo}
                    message={`Undo ${lastBall ?? 'the last ball'}? The 1st innings reopens.`} />
            ) : (
                <div className="flex justify-end border-t border-line px-5 py-2.5">
                    <button type="button" disabled={offline} onClick={() => setConfirm(true)} className={cn(BTN_GHOST, BTN_SM)}>
                        <Undo2 aria-hidden className="h-3.5 w-3.5" />Undo last ball
                    </button>
                </div>
            )}
        </section>
    );
}
