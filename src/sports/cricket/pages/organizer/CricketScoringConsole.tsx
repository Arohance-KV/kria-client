import { ReactNode, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CircleAlert, Loader2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { BTN_GHOST, BTN_SM, MATCH_STATUS, ToneBadge } from '@/pages/organizer/shared';
import { Notice, SegTabs, Spinner } from '@/pages/organizer/ui';
import { fetchMatchAndLive, selectMatchEntry } from '@/sports/cricket/store/cricketLiveStateSlice';
import { cricketCategoryApi } from '@/sports/cricket/api/cricketCategory';
import { cricketMatchApi } from '@/sports/cricket/api/cricketMatch';
import { xiSlots } from '@/sports/cricket/lib/lineup';
import { useMatchSocket } from '@/sports/cricket/lib/useMatchSocket';
import TossSetup from './TossSetup';
import LineupSetup from './LineupSetup';
import BallEntryPanel from './BallEntryPanel';
import StartInningsStep, { InningsBreak } from './StartInningsStep';
import CricketMatchSummary from './CricketMatchSummary';
import { sidesOf, teamName } from './LiveScoreboardPanel';

const STEPS = ['Toss', 'Lineups', '1st innings', '2nd innings', 'Result'];

/** "12.3 · 4": the last delivery on the scorecard, so Undo can say what it removes. */
function lastBallOf(scorecard: any): string | null {
    const inn = scorecard?.innings2?.oversTimeline?.length ? scorecard.innings2 : scorecard?.innings1;
    const over = inn?.oversTimeline?.[inn.oversTimeline.length - 1];
    const ball = over?.balls?.[over.balls.length - 1];
    if (!ball) return null;
    const extra = (label: string) => /^(wd|nb)/.test(label);
    const legal = over.balls.filter((b: any) => !extra(b.label)).length;
    // A wide or no-ball is numbered as the legal ball it was meant to be.
    return `${over.overNumber - 1}.${extra(ball.label) ? legal + 1 : legal} · ${ball.label}`;
}

export default function CricketScoringConsole() {
    const { matchId = '' } = useParams<{ matchId: string }>();
    const dispatch = useAppDispatch();
    const entry = useAppSelector(selectMatchEntry(matchId));
    const socketStatus = useMatchSocket(matchId || undefined);
    const [category, setCategory] = useState<any>(null);
    const [openers, setOpeners] = useState<{ strikerId: string; nonStrikerId: string; bowlerId: string } | null>(null);
    const [sc, setSc] = useState<{ key: string; data: any } | null>(null);

    const match = entry?.match;
    const live = entry?.liveState;

    useEffect(() => { if (matchId) dispatch(fetchMatchAndLive(matchId)); }, [matchId, dispatch]);
    useEffect(() => { if (live?.strikerId) setOpeners(null); }, [live?.strikerId]);

    useEffect(() => {
        if (!match?.categoryId) return;
        cricketCategoryApi.getById(match.categoryId).then(setCategory).catch(() => {});
    }, [match?.categoryId]);

    // Any delivery or undo moves this key, dot balls included, and the scorecard follows.
    const tallyKey = `${live?.runs ?? 0}|${live?.wickets ?? 0}|${live?.completedOvers ?? 0}|${live?.ballsInCurrentOver ?? 0}|${live?.currentInnings ?? 1}|${live?.matchStatus ?? ''}`;
    useEffect(() => {
        if (!matchId) return;
        let active = true;
        cricketMatchApi.getScorecard(matchId)
            .then((data: any) => { if (active) setSc({ key: tallyKey, data }); })
            .catch(() => {});
        return () => { active = false; };
    }, [matchId, tallyKey]);

    // The final ball completes the match on the server; re-read the match so the
    // result has its winner, innings scores and margin without a reload.
    useEffect(() => {
        if (live?.matchStatus === 'completed' && match && match.status !== 'completed') dispatch(fetchMatchAndLive(matchId));
    }, [live?.matchStatus]);

    if (!matchId) return null;
    if (!match) {
        return (
            <div className="min-h-screen bg-canvas font-ui text-fg antialiased">
                {entry?.status === 'error'
                    ? <main className="mx-auto max-w-xl px-4 py-10"><Notice tone="red" icon={CircleAlert}>{entry.error || 'Match not found.'}</Notice></main>
                    : <Spinner label="Loading match" />}
            </div>
        );
    }

    const setup = match.cricketSetup || {};
    const team1 = { id: String(match.teams?.team1Id ?? ''), name: match.teams?.team1Name || 'Team 1' };
    const team2 = { id: String(match.teams?.team2Id ?? ''), name: match.teams?.team2Name || 'Team 2' };
    const tossDone = !!setup.toss?.recorded;
    const t1Done = !!setup.team1Lineup?.lineupSet;
    const t2Done = !!setup.team2Lineup?.lineupSet;
    const status = live?.matchStatus || 'awaiting_start';
    // A result entered by hand completes the match without the live state knowing.
    const completed = match.status === 'completed' || status === 'completed';

    // Same precedence as the server: the match's own snapshot, then the category.
    const cfg = category?.cricketConfig ?? {};
    const maxOvers: number = match.matchConfig?.maxOvers ?? cfg.maxOvers ?? 20;
    const maxOversPerBowler: number = match.matchConfig?.maxOversPerBowler ?? cfg.maxOversPerBowler ?? 4;
    const playersPerTeam: number = match.matchConfig?.playersPerTeam ?? 11;

    const { batting, bowling } = sidesOf(match, live);
    // Only name the ball once the scorecard has caught up with it.
    const lastBall = sc?.key === tallyKey ? lastBallOf(sc.data) : null;
    const offline = socketStatus === 'reconnecting';
    const openersFor = (inningsNumber: number, note?: string) => (
        <StartInningsStep inningsNumber={inningsNumber} note={note} onReady={setOpeners}
            battingTeam={teamName(match, batting)} bowlingTeam={teamName(match, bowling)}
            battingXI={xiSlots(match, batting)} bowlingXI={xiSlots(match, bowling)} />
    );

    let step: number;
    let body: ReactNode;
    if (completed) {
        step = STEPS.length;
        // The live state lands first; the summary waits for the re-read match.
        body = match.status === 'completed' ? <CricketMatchSummary match={match} /> : <Spinner label="Loading the result" />;
    } else if (!tossDone) {
        step = 0;
        body = <TossSetup matchId={matchId} team1={team1} team2={team2} />;
    } else if (!t1Done || !t2Done) {
        step = 1;
        const team = t1Done ? team2 : team1;
        body = (
            <div className="mx-auto max-w-3xl space-y-4">
                {/* Progress only: a saved lineup can't be edited (no server support). */}
                <SegTabs label="Team" value={team.id} onChange={() => {}}
                    items={[{ key: team1.id, label: `${team1.name}${t1Done ? ' ✓' : ''}` }, { key: team2.id, label: `${team2.name}${t2Done ? ' ✓' : ''}` }]} />
                <LineupSetup key={team.id} matchId={matchId} team={team} playersPerTeam={playersPerTeam} />
            </div>
        );
    } else if (status === 'innings_break' && !openers) {
        step = 3;
        body = (
            <div className="mx-auto grid max-w-2xl gap-4">
                <InningsBreak matchId={matchId} match={match} live={live} scorecard={sc?.data} lastBall={lastBall} maxOvers={maxOvers} offline={offline} />
                {openersFor(2)}
            </div>
        );
    } else if (status === 'awaiting_start' && !openers) {
        step = 2;
        const toss = setup.toss;
        body = openersFor(1, toss?.winnerTeamId ? `${teamName(match, toss.winnerTeamId)} won the toss and chose to ${toss.decision}.` : undefined);
    } else {
        step = live?.currentInnings === 2 ? 3 : 2;
        body = (
            <BallEntryPanel
                matchId={matchId}
                match={match}
                live={live}
                scorecard={sc?.data}
                initialStrikerId={openers?.strikerId}
                initialNonStrikerId={openers?.nonStrikerId}
                initialBowlerId={openers?.bowlerId}
                maxOversPerBowler={maxOversPerBowler}
                maxOvers={maxOvers}
                lastBall={lastBall}
                offline={offline}
            />
        );
    }

    const scoring = !completed && step >= 2;
    const badge = completed ? MATCH_STATUS.completed
        : live && status !== 'awaiting_start' ? MATCH_STATUS.in_progress : MATCH_STATUS.scheduled;
    const meta = [category?.name, match.bracketRound, `${maxOvers} overs`].filter(Boolean).join(' · ');

    return (
        <div className="min-h-screen bg-canvas font-ui text-fg antialiased">
            <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
                    <Link to={`/organizer/tournament/${match.tournamentId}?section=matches`} aria-label="Back to matches" className={cn(BTN_GHOST, BTN_SM, '-ml-2 px-2')}>
                        <ArrowLeft aria-hidden className="h-4 w-4" /><span className="hidden sm:inline">Matches</span>
                    </Link>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{team1.name} vs {team2.name}</p>
                        <p className="truncate text-xs text-fg-subtle">{meta}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {scoring && (
                            <span className={cn('hidden items-center gap-1.5 text-xs sm:flex', socketStatus === 'connected' ? 'text-fg-subtle' : 'text-amber-300')}>
                                {socketStatus === 'connected' ? <Wifi aria-hidden className="h-3.5 w-3.5" /> : <WifiOff aria-hidden className="h-3.5 w-3.5" />}
                                {socketStatus === 'connected' ? 'Synced' : socketStatus === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
                            </span>
                        )}
                        <ToneBadge label={badge.label} tone={badge.tone} live={badge.live} />
                    </div>
                </div>
                <ol aria-label="Match progress" className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto border-t border-line px-4 py-2 text-xs [scrollbar-width:none] sm:px-6">
                    {STEPS.map((l, i) => (
                        <li key={l} aria-current={i === step ? 'step' : undefined} className="flex shrink-0 items-center gap-1">
                            {i > 0 && <span aria-hidden className={cn('mx-1 h-px w-4 sm:w-8', i <= step ? 'bg-fg-subtle' : 'bg-line')} />}
                            <span className={cn('flex items-center gap-1.5 rounded-md px-1.5 py-1', i === step ? 'font-medium text-fg' : i < step ? 'text-fg-muted' : 'text-fg-subtle')}>
                                {i < step
                                    ? <Check aria-hidden className="h-3.5 w-3.5 text-emerald-400" />
                                    : <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', i === step ? 'bg-primary' : 'bg-line')} />}
                                {l}
                            </span>
                        </li>
                    ))}
                </ol>
            </header>
            {offline && scoring && (
                <div role="status" className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-[13px] text-amber-300 sm:px-6">
                    <div className="mx-auto flex max-w-[1400px] items-center gap-2">
                        <Loader2 aria-hidden className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        Reconnecting. Scoring is locked until the connection is back, so no ball gets lost.
                    </div>
                </div>
            )}
            <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:py-7">{body}</main>
        </div>
    );
}
