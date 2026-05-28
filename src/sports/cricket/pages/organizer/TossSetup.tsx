import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
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

    const submit = async () => {
        if (!winnerTeamId) return;
        setSaving(true); setError(null);
        try {
            await dispatch(recordToss({ matchId, winnerTeamId, decision })).unwrap();
        } catch (e: any) {
            setError(e?.message || 'Failed to record toss.');
        } finally { setSaving(false); }
    };

    return (
        <div className="max-w-md mx-auto bg-black/30 border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
            <h3 className="text-lg font-bold text-white">Toss</h3>
            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

            <div className="flex flex-col gap-2">
                <span className="text-sm text-gray-400">Toss winner</span>
                <div className="grid grid-cols-2 gap-3">
                    {[team1, team2].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setWinnerTeamId(t.id)}
                            className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${winnerTeamId === t.id ? 'bg-primary text-white border-primary' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'}`}
                        >
                            {t.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-sm text-gray-400">Decision</span>
                <div className="grid grid-cols-2 gap-3">
                    {(['bat', 'bowl'] as const).map(d => (
                        <button
                            key={d}
                            onClick={() => setDecision(d)}
                            className={`px-4 py-3 rounded-xl border text-sm font-semibold capitalize transition-colors ${decision === d ? 'bg-primary text-white border-primary' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'}`}
                        >
                            Chose to {d}
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={submit} disabled={!winnerTeamId || saving} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold disabled:opacity-40">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Record Toss
            </button>
        </div>
    );
}
