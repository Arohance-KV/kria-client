import React, { useState } from 'react';
import { Trophy, Loader2, RotateCcw } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { undoLastBall } from '@/sports/cricket/store/cricketLiveStateSlice';

interface Props {
    match: any;       // completed match (has inningsScores, winnerId, teams, result)
}

export default function CricketMatchSummary({ match }: Props) {
    const dispatch = useDispatch<any>();
    const [undoing, setUndoing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const team1 = { id: match?.teams?.team1Id, name: match?.teams?.team1Name || 'Team 1' };
    const team2 = { id: match?.teams?.team2Id, name: match?.teams?.team2Name || 'Team 2' };
    const winnerName = String(match?.winnerId) === String(team1.id) ? team1.name
        : String(match?.winnerId) === String(team2.id) ? team2.name : 'Winner';
    const innings = match?.inningsScores || [];

    // Correcting a completed cricket match means undoing its final delivery. The
    // server's undo already unwinds the whole completion — the career-stat ledger
    // rows, the per-player cricket stats, the cached career profiles and the
    // winner advanced into the next round — so there is no separate reopen
    // endpoint to call. This is only the door to it, which the console had never
    // opened because a completed match renders this read-only summary instead of
    // the ball-entry panel that owns the Undo button.
    const correct = async () => {
        const ok = window.confirm(
            'Correct this result?\n\n'
            + 'This undoes the final delivery, un-completes the match, removes the '
            + 'career stats it credited, and un-advances the winner from the next '
            + 'round. You are returned to that ball to score it again.\n\n'
            + 'If the mistake was earlier than the last ball, undo again from the '
            + 'scoring panel.',
        );
        if (!ok) return;
        setUndoing(true);
        setError(null);
        try {
            const out = await dispatch(undoLastBall(String(match?._id))).unwrap();
            // The undo succeeded but the bracket still lists the undone winner, so
            // the organizer has manual work to do. Blocking, because a successful
            // undo swaps this whole phase out for the ball-entry panel and would
            // take an inline message with it.
            if (out?.result?.bracketWarning) window.alert(out.result.bracketWarning);
        } catch (e) {
            // 'No balls to undo.' is the realistic refusal — a match completed
            // through the manual result endpoint has no deliveries. Say which.
            setError(e?.response?.data?.message || e?.message || 'Failed to correct the result.');
        } finally {
            setUndoing(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto bg-black/30 border border-emerald-500/30 rounded-2xl p-6 flex flex-col gap-4 text-center">
            <Trophy className="h-10 w-10 text-emerald-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Match Complete</h3>
            <p className="text-emerald-400 font-semibold">{winnerName} won{match?.result?.marginOfVictory ? ` ${match.result.marginOfVictory}` : ''}.</p>
            <div className="flex flex-col gap-2">
                {innings.map((inn: any, i: number) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-200">
                        Innings {inn.inningsNumber}: {inn.runs}/{inn.wickets} ({inn.overs}{inn.balls ? `.${inn.balls}` : ''} ov)
                    </div>
                ))}
            </div>
            <p className="text-xs text-gray-500">Winner has advanced in the bracket automatically.</p>

            {error && <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{error}</div>}

            <div className="pt-2 border-t border-white/5 flex justify-center">
                <button
                    onClick={correct}
                    disabled={undoing}
                    className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {undoing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Correct Result
                </button>
            </div>
        </div>
    );
}
