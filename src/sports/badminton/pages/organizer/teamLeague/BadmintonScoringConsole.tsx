import React, { useEffect, useState } from 'react';
import { Loader2, X, Plus, Undo2, Trophy } from 'lucide-react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';

interface Props {
    match: any;
    onClose: () => void;
    onSaved: () => void;
    setError: (err: string | null) => void;
    // Injectable so the same console drives team-league sub-matches (default) or plain
    // bracket/knockout matches (pass badmintonMatchApi's live functions).
    startLiveScoring?: (matchId: string) => Promise<any>;
    recordLivePoint?: (matchId: string, body: { team: 1 | 2; delta: 1 | -1 }) => Promise<any>;
}

// Current game = last gameScores entry without a winnerId.
function currentGame(gameScores: any[]) {
    if (!gameScores || gameScores.length === 0) return { gameNumber: 1, team1Score: 0, team2Score: 0 };
    const open = [...gameScores].reverse().find(g => !g.winnerId);
    return open || gameScores[gameScores.length - 1];
}

export default function BadmintonScoringConsole({ match: initial, onClose, onSaved, setError, startLiveScoring, recordLivePoint }: Props) {
    const [match, setMatch] = useState<any>(initial);
    const [busy, setBusy] = useState(false);
    const [starting, setStarting] = useState(false);

    const startApi = startLiveScoring || teamLeagueApi.startLiveScoring;
    const pointApi = recordLivePoint || teamLeagueApi.recordLivePoint;

    // Per-game winnerId key: teamId for team-league sub-matches (they have a tieId) and
    // for team brackets; registrationId for player knockout matches — matching what the
    // backend stores, so the games-won pips below stay accurate.
    const isTeamKey = !!match.tieId || match.competitorType === 'team';
    const team1Id = isTeamKey ? (match.player1?.teamId || match.teams?.team1Id) : match.player1?.registrationId;
    const team2Id = isTeamKey ? (match.player2?.teamId || match.teams?.team2Id) : match.player2?.registrationId;
    const team1Name = match.player1?.name || match.teams?.team1Name || 'Team 1';
    const team2Name = match.player2?.name || match.teams?.team2Name || 'Team 2';

    const gameScores: any[] = match.gameScores || [];
    const cur = currentGame(gameScores);
    const gamesWonT1 = gameScores.filter(g => (g.winnerId?.toString?.() || g.winnerId) === team1Id).length;
    const gamesWonT2 = gameScores.filter(g => (g.winnerId?.toString?.() || g.winnerId) === team2Id).length;
    const completed = match.status === 'completed';

    // Ensure the sub-match is in live mode when the console opens.
    useEffect(() => {
        if (match.status !== 'in_progress' && match.status !== 'completed') {
            (async () => {
                try {
                    setStarting(true);
                    const updated = await startApi(match._id);
                    setMatch(updated);
                } catch (e: any) {
                    setError(e.response?.data?.message || 'Failed to start live scoring');
                } finally {
                    setStarting(false);
                }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const point = async (team: 1 | 2, delta: 1 | -1) => {
        if (busy || completed || starting) return;
        setBusy(true);
        setError(null);
        try {
            const updated = await pointApi(match._id, { team, delta });
            setMatch(updated);
            if (updated.status === 'completed') onSaved();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to record point');
        } finally {
            setBusy(false);
        }
    };

    const finish = () => { onSaved(); onClose(); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <h3 className="text-lg font-bold text-white">Live Scoring</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                </div>

                <div className="text-center text-xs uppercase tracking-widest text-gray-500 mb-2">
                    Game {cur.gameNumber} · Games {gamesWonT1}–{gamesWonT2}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {[{ n: 1 as const, name: team1Name, score: cur.team1Score }, { n: 2 as const, name: team2Name, score: cur.team2Score }].map(side => (
                        <div key={side.n} className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-sm font-semibold text-white text-center truncate w-full">{side.name}</div>
                            <div className="text-5xl font-extrabold text-white tabular-nums">{side.score}</div>
                            <button
                                onClick={() => point(side.n, 1)}
                                disabled={busy || completed || starting}
                                className="flex items-center gap-1 px-5 py-3 rounded-full bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" /> Point
                            </button>
                            <button
                                onClick={() => point(side.n, -1)}
                                disabled={busy || completed || starting}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-40"
                            >
                                <Undo2 className="h-3 w-3" /> Undo
                            </button>
                        </div>
                    ))}
                </div>

                {completed && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
                        <Trophy className="h-4 w-4" /> Match complete ({gamesWonT1}–{gamesWonT2})
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-white/10">
                    <button onClick={onClose} className="px-4 py-2 rounded-full border border-white/10 text-white text-sm hover:bg-white/5">
                        Close
                    </button>
                    <button
                        onClick={finish}
                        disabled={busy}
                        className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
