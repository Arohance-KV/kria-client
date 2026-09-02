import React, { useState } from 'react';
import { Loader2, CheckCircle2, X, Radio } from 'lucide-react';
import { badmintonMatchApi } from '@/sports/badminton/api/badmintonMatch';
import BadmintonScoringConsole from './teamLeague/BadmintonScoringConsole';
import type { MatchResultSectionProps } from '@/sports/_contracts/SportPlugin';

function competitor(match: any, slot: 1 | 2, competitorType: 'player' | 'team') {
    if (competitorType === 'player' && match[`player${slot}`]) {
        const p = match[`player${slot}`];
        return { id: p.registrationId, name: p.name, isTBD: p.registrationId === 'TBD' };
    }
    const id = match.teams?.[`team${slot}Id`] || '';
    const name = match.teams?.[`team${slot}Name`] || 'TBD';
    return { id, name, isTBD: name === 'TBD' };
}

export default function BadmintonMatchResultSection({ match, competitorType, onRecorded }: MatchResultSectionProps) {
    const c1 = competitor(match, 1, competitorType);
    const c2 = competitor(match, 2, competitorType);
    const isBye = match.status === 'walkover' && match.winReason === 'bye';
    const isCompleted = match.status === 'completed' || (match.status === 'walkover' && !isBye);
    const canScore = !isCompleted && !isBye && !c1.isTBD && !c2.isTBD;

    const bestOf = match.matchConfig?.bestOf || 1;
    const [open, setOpen] = useState(false);
    const [liveOpen, setLiveOpen] = useState(false);
    const [games, setGames] = useState(
        Array.from({ length: bestOf }, (_, i) => ({ gameNumber: i + 1, team1Score: 0, team2Score: 0 })),
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!canScore) return null;

    const setScore = (idx: number, team: 'team1Score' | 'team2Score', val: number) =>
        setGames(prev => prev.map((g, i) => (i === idx ? { ...g, [team]: Math.max(0, val) } : g)));

    const gamesWon1 = games.filter(g => g.team1Score > g.team2Score).length;
    const gamesWon2 = games.filter(g => g.team2Score > g.team1Score).length;
    const winnerId = gamesWon1 > gamesWon2 ? c1.id : gamesWon2 > gamesWon1 ? c2.id : null;

    const submit = async () => {
        if (!winnerId) return;
        setSaving(true);
        setError(null);
        try {
            await badmintonMatchApi.recordResult(match._id, winnerId, games);
            setOpen(false);
            onRecorded();
        } catch (e: any) {
            setError(e.response?.data?.message || e.message || 'Failed to record result.');
        } finally {
            setSaving(false);
        }
    };

    // The trigger stays a small fixed-height row inside the bracket card; the score
    // form opens as a fixed overlay (out of layout flow) so it never grows the card
    // and disrupts the absolutely-positioned bracket tree. Mirrors SubMatchResultModal.
    return (
        <>
            <div className="px-4 py-2 border-t border-white/5 flex justify-end gap-2">
                <button onClick={() => setLiveOpen(true)} className="flex items-center gap-1 px-3 py-1 rounded text-[11px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
                    <Radio className="h-3 w-3" /> Live Score
                </button>
                <button onClick={() => setOpen(true)} className="px-3 py-1 rounded text-[11px] font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                    Record Result
                </button>
            </div>

            {liveOpen && (
                <BadmintonScoringConsole
                    match={match}
                    startLiveScoring={badmintonMatchApi.startLiveScoring}
                    recordLivePoint={badmintonMatchApi.recordLivePoint}
                    onClose={() => setLiveOpen(false)}
                    onSaved={onRecorded}
                    setError={setError}
                />
            )}

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-primary uppercase tracking-wider">Score Entry (Best of {bestOf})</span>
                            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 text-gray-500"><X className="h-4 w-4" /></button>
                        </div>

                        {error && <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{error}</div>}

                        {games.map((g, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <span className="text-[10px] text-gray-600 w-4 shrink-0">G{g.gameNumber}</span>
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-xs text-gray-400 truncate w-20">{c1.name}</span>
                                    <input type="number" min={0} value={g.team1Score} onChange={e => setScore(idx, 'team1Score', parseInt(e.target.value) || 0)} className="w-14 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-center text-sm font-bold focus:outline-none focus:border-primary" />
                                    <span className="text-[10px] text-gray-600">:</span>
                                    <input type="number" min={0} value={g.team2Score} onChange={e => setScore(idx, 'team2Score', parseInt(e.target.value) || 0)} className="w-14 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-center text-sm font-bold focus:outline-none focus:border-primary" />
                                    <span className="text-xs text-gray-400 truncate w-20 text-right">{c2.name}</span>
                                </div>
                            </div>
                        ))}

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <div className="text-xs text-gray-500">
                                {winnerId ? (
                                    <span>Winner: <strong className="text-emerald-400">{winnerId === c1.id ? c1.name : c2.name}</strong> ({gamesWon1}-{gamesWon2})</span>
                                ) : (
                                    <span className="text-amber-400">No winner yet — scores tied.</span>
                                )}
                            </div>
                            <button onClick={submit} disabled={!winnerId || saving} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Confirm Result
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
