import { cn } from '@/lib/utils';
import { FOCUS } from '@/pages/organizer/shared';
import type { PlayerSlot } from '@/sports/cricket/lib/lineup';

interface PickChipsProps {
    label: string;
    options: PlayerSlot[];
    value?: string;
    onChange: (registrationId: string) => void;
    /** A reason disables the option and is shown under its name. */
    disabledReason?: (registrationId: string) => string | false | undefined;
    /** Small line under an enabled option, e.g. "2 of 4 overs". */
    note?: (registrationId: string) => string | undefined;
    cols?: string;
}

/** One-tap player picker: a radio group of chips, big enough to hit on a phone. */
export function PickChips({ label, options, value, onChange, disabledReason, note, cols = 'grid-cols-2 sm:grid-cols-3' }: PickChipsProps) {
    return (
        <div role="radiogroup" aria-label={label} className={cn('grid gap-2', cols)}>
            {options.map(p => {
                const reason = disabledReason?.(p.registrationId);
                const sub = reason || note?.(p.registrationId);
                const on = value === p.registrationId;
                return (
                    <button key={p.registrationId} type="button" role="radio" aria-checked={on} disabled={!!reason}
                        onClick={() => onChange(p.registrationId)}
                        className={cn('flex min-h-11 flex-col items-start justify-center rounded-lg px-3 py-1.5 text-left ring-1 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-45', FOCUS,
                            on ? 'bg-primary/[0.08] ring-primary/60' : 'bg-canvas ring-line hover:ring-white/25')}>
                        <span className="text-[13px] font-medium text-fg">{p.name}</span>
                        {sub && <span className="text-[11px] text-fg-subtle">{sub}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/** Amber "action needed" box shown just above the ball pad (next batter, next bowler). */
export default function NextPlayerPrompt({ title, ...pick }: PickChipsProps & { title: string }) {
    return (
        <div className="rounded-lg bg-amber-400/[0.06] p-3 ring-1 ring-inset ring-amber-400/25">
            <p className="mb-2 text-[13px] font-medium text-amber-200">{title}</p>
            {pick.options.length
                ? <PickChips {...pick} />
                : <p className="text-[13px] text-fg-muted">No eligible players left.</p>}
        </div>
    );
}
