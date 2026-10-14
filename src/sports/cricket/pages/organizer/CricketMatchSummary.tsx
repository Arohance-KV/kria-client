import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store/hooks';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, ToneBadge } from '@/pages/organizer/shared';
import { CHOICE, ConfirmBar, Field, Notice, PANEL } from '@/pages/organizer/ui';
import { fetchMatchAndLive, resolveTie, undoLastBall } from '@/sports/cricket/store/cricketLiveStateSlice';
import { isDecidedFinal } from '@/lib/champion';
import { CricketTeamLogo, sidesOf, teamName } from './LiveScoreboardPanel';

interface Props {
    match: any;       // completed match (has inningsScores, winnerId, teams, result)
}

export default function CricketMatchSummary({ match }: Props) {
    const dispatch = useAppDispatch();
    const matchId = String(match?._id);
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [bracketWarning, setBracketWarning] = useState<string | null>(null);
    const [advancing, setAdvancing] = useState('');

    const team1 = { id: String(match?.teams?.team1Id), name: match?.teams?.team1Name || 'Team 1' };
    const team2 = { id: String(match?.teams?.team2Id), name: match?.teams?.team2Name || 'Team 2' };
    const winnerName = match?.winnerId ? teamName(match, match.winnerId) : null;
    const margin = match?.result?.marginOfVictory;
    const innings: any[] = match?.inningsScores || [];
    const firstBat = sidesOf(match, null);

    // A knockout cannot end level, but the engine records a tie honestly as no
    // winner — so nothing advanced and the bracket is stuck until the organizer
    // names who went through. Winning the final wins the category: "advanced in
    // the bracket" is meaningless there, there is no next round.
    const champions = isDecidedFinal(match);
    const isTie = innings.length >= 2 && innings[0]?.runs === innings[1]?.runs;
    const unresolvedTie = isTie && !match?.winnerId;

    const title = isTie ? 'Match tied'
        : winnerName ? `${winnerName} ${champions ? 'win the title,' : 'won'}${margin ? ` ${margin}` : ''}`
            : 'No winner was recorded';
    const sub = isTie ? `Both sides finished on ${innings[0]?.runs}.`
        : champions ? 'This was the final, so the category is decided.'
            : winnerName ? `${winnerName} advanced in the bracket automatically.` : null;

    const recordAdvance = async () => {
        if (!advancing) return;
        setBusy(true); setError(null);
        try { await dispatch(resolveTie({ matchId, winnerTeamId: advancing })).unwrap(); }
        catch (e: any) { setError(e?.message || 'Could not record who advanced.'); }
        finally { setBusy(false); }
    };

    // Correcting a completed cricket match means undoing its final delivery. The
    // server's undo already unwinds the whole completion — the career-stat ledger
    // rows, the per-player stats, the cached career profiles and the winner
    // advanced into the next round. Re-reading the match then reopens scoring at
    // that ball; a bracket warning holds the organizer here until they've read it.
    const reopen = () => dispatch(fetchMatchAndLive(matchId));
    const correct = async () => {
        setBusy(true); setError(null);
        try {
            const out = await dispatch(undoLastBall(matchId)).unwrap();
            setConfirm(false);
            if (out?.result?.bracketWarning) setBracketWarning(out.result.bracketWarning);
            else reopen();
        } catch (e: any) {
            // 'No balls to undo.' is the realistic refusal — a match completed
            // through the manual result endpoint has no deliveries. Say which.
            setError(e?.message || 'Failed to correct the result.');
            setConfirm(false);
        } finally { setBusy(false); }
    };

    return (
        <section className={cn(PANEL, 'mx-auto max-w-2xl overflow-hidden')}>
            <div className="p-5 sm:p-6">
                <ToneBadge label={champions ? 'Champions' : isTie ? 'Tied' : 'Completed'} tone={isTie && !champions ? 'amber' : 'green'} />
                <h1 className="mt-3 text-xl font-semibold">{title}</h1>
                {sub && <p className="mt-1 text-[13px] text-fg-muted">{sub}</p>}

                {innings.length > 0 && (
                    <ul className="mt-5 divide-y divide-line rounded-[10px] ring-1 ring-inset ring-line">
                        {innings.map((inn, i) => {
                            const id = inn.battingTeamId ?? (inn.inningsNumber === 2 ? firstBat.bowling : firstBat.batting);
                            const name = teamName(match, id);
                            return (
                                <li key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
                                    <CricketTeamLogo size="sm" id={id} name={name} />
                                    <span className="min-w-0 flex-1 truncate">{name}<span className="text-fg-subtle"> · {inn.inningsNumber === 2 ? '2nd' : '1st'} innings</span></span>
                                    <span className="font-semibold tabular-nums">{inn.runs}/{inn.wickets}</span>
                                    <span className="w-14 text-right text-xs tabular-nums text-fg-subtle">{inn.overs}.{inn.balls ?? 0} ov</span>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {unresolvedTie && (
                    <div className="mt-5 grid gap-3">
                        <Field label="Who went through?" help="However it was settled: bowl-out, boundary count or anything else. The match stays a tie in every player's record.">
                            <div role="radiogroup" aria-label="Team that advances" className="grid gap-2 sm:grid-cols-2">
                                {[team1, team2].map(t => (
                                    <label key={t.id} className={cn(CHOICE, 'items-center')}>
                                        <input type="radio" name="tie" className="sr-only" checked={advancing === t.id} disabled={busy} onChange={() => setAdvancing(t.id)} />
                                        <CricketTeamLogo size="sm" id={t.id} name={t.name} />
                                        <span className="text-sm font-medium">{t.name}</span>
                                    </label>
                                ))}
                            </div>
                        </Field>
                        <div>
                            <button type="button" disabled={!advancing || busy} onClick={recordAdvance} className={BTN_PRIMARY}>Record who advanced</button>
                        </div>
                    </div>
                )}
                {isTie && winnerName && <Notice tone="blue" icon={CircleCheck} className="mt-5">{winnerName} went through.</Notice>}

                {error && <Notice tone="red" icon={CircleAlert} className="mt-5">{error}</Notice>}
                {bracketWarning && (
                    <Notice tone="amber" icon={TriangleAlert} className="mt-5">
                        <p>{bracketWarning}</p>
                        <button type="button" onClick={reopen} className={cn(BTN_SECONDARY, BTN_SM, 'mt-2')}>Continue scoring</button>
                    </Notice>
                )}
            </div>
            {bracketWarning ? null : confirm ? (
                <ConfirmBar danger busy={busy} confirmLabel="Correct result" cancelLabel="Keep result"
                    onCancel={() => setConfirm(false)} onConfirm={correct}
                    message="Undo the final ball? The match reopens at that delivery, the career stats it credited are removed, and the winner comes back out of the next round." />
            ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
                    <button type="button" onClick={() => setConfirm(true)} className={cn(BTN_DANGER, BTN_SM)}>Correct result</button>
                    <Link to={`/organizer/tournament/${match?.tournamentId}?section=matches`} className={cn(BTN_SECONDARY, BTN_SM)}>Back to matches</Link>
                </div>
            )}
        </section>
    );
}
