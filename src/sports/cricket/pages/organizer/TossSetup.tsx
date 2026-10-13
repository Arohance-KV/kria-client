import { useState } from 'react';
import { CircleAlert, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store/hooks';
import { BTN_PRIMARY } from '@/pages/organizer/shared';
import { CHOICE, Field, Notice, PANEL, Segmented, TeamLogo } from '@/pages/organizer/ui';
import { recordToss } from '@/sports/cricket/store/cricketLiveStateSlice';

interface Props {
    matchId: string;
    team1: { id: string; name: string };
    team2: { id: string; name: string };
}

export default function TossSetup({ matchId, team1, team2 }: Props) {
    const dispatch = useAppDispatch();
    const [winnerTeamId, setWinnerTeamId] = useState('');
    const [decision, setDecision] = useState<'bat' | 'bowl'>('bat');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const winner = winnerTeamId === team1.id ? team1 : team2;
    const other = winnerTeamId === team1.id ? team2 : team1;

    const submit = async () => {
        if (!winnerTeamId) return;
        setSaving(true); setError(null);
        try {
            await dispatch(recordToss({ matchId, winnerTeamId, decision })).unwrap();
        } catch (e: any) {
            setError(e?.message || 'Failed to record the toss.');
        } finally { setSaving(false); }
    };

    return (
        <section className={cn(PANEL, 'mx-auto max-w-xl overflow-hidden')}>
            <div className="grid gap-5 p-5 sm:p-6">
                <div>
                    <h1 className="text-lg font-semibold">Toss</h1>
                    <p className="mt-1 text-[13px] text-fg-muted">Record it before picking the playing XIs.</p>
                </div>
                <Field label="Who won the toss?">
                    <div role="radiogroup" aria-label="Toss winner" className="grid gap-2 sm:grid-cols-2">
                        {[team1, team2].map(t => (
                            <label key={t.id} className={cn(CHOICE, 'items-center')}>
                                <input type="radio" name="toss" className="sr-only" checked={winnerTeamId === t.id} onChange={() => setWinnerTeamId(t.id)} />
                                <TeamLogo name={t.name} />
                                <span className="text-sm font-medium">{t.name}</span>
                            </label>
                        ))}
                    </div>
                </Field>
                <Field label="They chose to">
                    <Segmented<'bat' | 'bowl'> name="toss-choice" label="Toss decision" value={decision} onChange={setDecision}
                        options={[{ value: 'bat', label: 'Bat first' }, { value: 'bowl', label: 'Bowl first' }]} />
                </Field>
                {winnerTeamId && (
                    <Notice tone="neutral" icon={Info}>
                        {decision === 'bat' ? winner.name : other.name} will bat first. The toss can&apos;t be changed after you record it.
                    </Notice>
                )}
                {error && <Notice tone="red" icon={CircleAlert}>{error}</Notice>}
            </div>
            <footer className="flex justify-end border-t border-line px-5 py-3">
                <button type="button" onClick={submit} disabled={!winnerTeamId || saving} className={BTN_PRIMARY}>
                    {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}Record toss
                </button>
            </footer>
        </section>
    );
}
