import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BTN_DANGER_SOLID, BTN_SECONDARY, FOCUS } from '@/pages/organizer/shared';
import { Dialog, Field, Segmented } from '@/pages/organizer/ui';
import type { PlayerSlot } from '@/sports/cricket/lib/lineup';
import { PickChips } from './NextPlayerPrompt';

export interface WicketResult {
    wicketType: 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket' | 'retired_hurt';
    dismissedPlayerId: string;
    fielderId?: string;
    runs: number;
}

interface Props {
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
    /** "12.3", the delivery being recorded. */
    ball: string;
    nameOf: (id: string) => string;
    fieldingXI: PlayerSlot[];
    onConfirm: (r: WicketResult) => void;
    onCancel: () => void;
}

type How = WicketResult['wicketType'];

const TYPES: Array<[How, string]> = [
    ['bowled', 'Bowled'], ['caught', 'Caught'], ['lbw', 'LBW'], ['run_out', 'Run out'],
    ['stumped', 'Stumped'], ['hit_wicket', 'Hit wicket'], ['retired_hurt', 'Retired hurt'],
];

const NEEDS_FIELDER = new Set<How>(['caught', 'run_out', 'stumped']);
// Every other dismissal can only happen to the batter on strike.
const EITHER_END = new Set<How>(['run_out', 'retired_hurt']);

export default function WicketDialog({ strikerId, nonStrikerId, bowlerId, ball, nameOf, fieldingXI, onConfirm, onCancel }: Props) {
    const [how, setHow] = useState<How>('caught');
    const [who, setWho] = useState(strikerId);
    const [fielderId, setFielderId] = useState('');
    const [runs, setRuns] = useState(0);

    const needsFielder = NEEDS_FIELDER.has(how);
    // Runs, fielder and batter all depend on the mode of dismissal, so a change
    // starts them over — a run-out's 2 runs must not ride along onto a catch.
    const changeHow = (h: How) => {
        setHow(h);
        setFielderId('');
        setRuns(0);
        if (!EITHER_END.has(h)) setWho(strikerId);
    };

    // Same wording as the server's scorecard (dismissalLineFor), so this is what it will print.
    const b = nameOf(bowlerId);
    const f = fielderId ? nameOf(fielderId) : '?';
    const line: Record<How, string> = {
        bowled: `b ${b}`, lbw: `lbw b ${b}`, caught: `c ${f} b ${b}`, stumped: `st ${f} b ${b}`,
        run_out: `run out (${f})`, hit_wicket: `hit wicket b ${b}`, retired_hurt: 'retired hurt',
    };

    // The bowler first and marked, so caught-and-bowled is one tap.
    const fielders = [
        ...fieldingXI.filter(p => p.registrationId === bowlerId),
        ...fieldingXI.filter(p => p.registrationId !== bowlerId),
    ];

    return (
        <Dialog title="Wicket" description={`${ball} · ${b} to ${nameOf(strikerId)}`} onClose={onCancel}
            footer={<>
                <button type="button" onClick={onCancel} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" disabled={needsFielder && !fielderId}
                    onClick={() => onConfirm({ wicketType: how, dismissedPlayerId: who, fielderId: needsFielder ? fielderId : undefined, runs: how === 'run_out' ? runs : 0 })}
                    className={BTN_DANGER_SOLID}>Record wicket</button>
            </>}>
            <div className="grid gap-5">
                <Field label="How out?">
                    <div role="radiogroup" aria-label="How out" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {TYPES.map(([v, l]) => (
                            <button key={v} type="button" role="radio" aria-checked={how === v} onClick={() => changeHow(v)}
                                className={cn('h-11 rounded-lg text-[13px] font-medium ring-1 ring-inset transition-colors', FOCUS,
                                    how === v ? 'bg-red-500/10 text-red-200 ring-red-400/50' : 'bg-canvas text-fg-muted ring-line hover:text-fg')}>
                                {l}
                            </button>
                        ))}
                    </div>
                </Field>

                <Field label="Who's out?" help={EITHER_END.has(how) ? 'Either batter can be out this way.' : 'Only the batter on strike can be out this way.'}>
                    <Segmented<string> name="wk-who" label="Batter out" value={who} onChange={setWho}
                        options={[
                            { value: strikerId, label: `${nameOf(strikerId)} (on strike)` },
                            ...(EITHER_END.has(how) ? [{ value: nonStrikerId, label: nameOf(nonStrikerId) }] : []),
                        ]} />
                </Field>

                {needsFielder && (
                    <Field label={how === 'stumped' ? 'Keeper' : 'Fielder'}>
                        <PickChips label="Fielder" options={fielders} value={fielderId} onChange={setFielderId}
                            note={id => (id === bowlerId ? 'Bowler' : undefined)} />
                    </Field>
                )}

                {how === 'run_out' && (
                    <Field label="Runs completed before the run-out">
                        <Segmented<number> name="wk-runs" label="Runs completed" value={runs} onChange={setRuns}
                            options={[0, 1, 2, 3].map(v => ({ value: v, label: String(v) }))} />
                    </Field>
                )}

                <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-fg-muted">
                    Scorecard reads: <span className="text-fg">{nameOf(who)} {line[how]}</span>
                </p>
            </div>
        </Dialog>
    );
}
