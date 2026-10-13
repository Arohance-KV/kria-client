import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Plus, Trophy, Undo2 } from 'lucide-react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM } from '@/pages/organizer/shared';
import { Dialog, Notice } from '@/pages/organizer/ui';
import { cn } from '@/lib/utils';

interface Props {
    match: any;
    onClose: () => void;
    /** Called on close when anything was recorded, so the host can refetch. */
    onSaved: () => void;
    /**
     * Kept for backward compatibility only. Errors now render inside the console:
     * pushed to the host they landed behind this dialog, where nobody saw them.
     */
    setError?: (err: string | null) => void;
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

const message = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

export default function BadmintonScoringConsole({ match: initial, onClose, onSaved, startLiveScoring, recordLivePoint }: Props) {
    const [match, setMatch] = useState<any>(initial);
    const [busy, setBusy] = useState(false);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const changed = useRef(false);
    const startRequested = useRef(false); // StrictMode runs mount effects twice in dev

    const startApi = startLiveScoring || teamLeagueApi.startLiveScoring;
    const pointApi = recordLivePoint || teamLeagueApi.recordLivePoint;

    // Per-game winnerId key: teamId for team-league sub-matches (they have a tieId) and
    // for team brackets; registrationId for player knockout matches — matching what the
    // backend stores, so the games-won count below stays accurate.
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

    // Opening the console puts the match into live mode; the host asks before opening it.
    useEffect(() => {
        if (match.status === 'in_progress' || match.status === 'completed' || startRequested.current) return;
        startRequested.current = true;
        (async () => {
            setStarting(true);
            try {
                setMatch(await startApi(match._id));
                changed.current = true;
            } catch (e) {
                setError(message(e, 'Failed to start live scoring.'));
            } finally {
                setStarting(false);
            }
        })();
    }, []);

    const point = async (team: 1 | 2, delta: 1 | -1) => {
        if (busy || completed || starting) return;
        setBusy(true);
        setError(null);
        try {
            setMatch(await pointApi(match._id, { team, delta }));
            changed.current = true;
        } catch (e) {
            setError(message(e, 'Failed to record the point.'));
        } finally {
            setBusy(false);
        }
    };

    // Refetch on the way out rather than on every point, so the host list never
    // re-renders (or filters this match away) underneath an open console.
    const close = () => {
        if (changed.current) onSaved();
        onClose();
    };

    const locked = busy || completed || starting;

    return (
        <Dialog
            title={`Live scoring${match.matchNumber ? ` · Match ${match.matchNumber}` : ''}`}
            onClose={close}
            footer={<button type="button" onClick={close} className={BTN_SECONDARY}>Close</button>}
        >
            <div className="grid gap-4">
                <p className="text-center text-[13px] text-fg-subtle" aria-live="polite">
                    {starting ? 'Starting live scoring…' : `Game ${cur.gameNumber} · games ${gamesWonT1}–${gamesWonT2}`}
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                    {[{ n: 1 as const, name: team1Name, score: cur.team1Score }, { n: 2 as const, name: team2Name, score: cur.team2Score }].map(side => (
                        <div key={side.n} className="grid gap-2 rounded-xl bg-canvas p-3.5 text-center ring-1 ring-inset ring-line">
                            <span className="truncate text-[13px] text-fg-muted" title={side.name}>{side.name}</span>
                            <span className="text-[44px] font-semibold leading-none tabular-nums text-fg" aria-label={`${side.name}: ${side.score ?? 0} points`}>{side.score ?? 0}</span>
                            <button type="button" onClick={() => point(side.n, 1)} disabled={locked} aria-label={`Point to ${side.name}`} className={BTN_PRIMARY}>
                                <Plus aria-hidden className="h-4 w-4" />Point
                            </button>
                            <button type="button" onClick={() => point(side.n, -1)} disabled={locked} aria-label={`Undo last point for ${side.name}`} className={cn(BTN_GHOST, BTN_SM)}>
                                <Undo2 aria-hidden className="h-3.5 w-3.5" />Undo
                            </button>
                        </div>
                    ))}
                </div>

                {completed && (
                    <Notice tone="neutral" icon={Trophy}>
                        Match complete, {gamesWonT1}–{gamesWonT2} in games.
                    </Notice>
                )}

                {error && (
                    <div role="alert">
                        <Notice tone="red" icon={CircleAlert}>{error}</Notice>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
