import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchMatchAndLive, selectMatchEntry } from '@/sports/cricket/store/cricketLiveStateSlice';
import { cricketCategoryApi } from '@/sports/cricket/api/cricketCategory';
import { cricketMatchApi } from '@/sports/cricket/api/cricketMatch';
import TossSetup from './TossSetup';
import LineupSetup from './LineupSetup';
import LiveScoreboardPanel from './LiveScoreboardPanel';
import BallEntryPanel from './BallEntryPanel';
import StartInningsStep from './StartInningsStep';
import CricketMatchSummary from './CricketMatchSummary';
import { xiSlots } from '@/sports/cricket/lib/lineup';
import { useMatchSocket } from '@/sports/cricket/lib/useMatchSocket';

// ─── Shared styles injected once at the root ─────────────────────────────────
export const SCORER_STYLES = `
@keyframes scFadeIn  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes scBallPop { 0% { opacity:0; transform:scale(.4); } 65% { transform:scale(1.12); } 100% { opacity:1; transform:scale(1); } }
@keyframes scPillPulse { 0%,100% { box-shadow:0 0 0 0 rgba(249,115,22,.45); } 70% { box-shadow:0 0 0 6px rgba(249,115,22,0); } }

/* surfaces */
.sc-bg   { background:#07101e; min-height:100vh; color:#f9fafb; }
.sc-card { background:#0c1526; border:1px solid rgba(255,255,255,.07); border-radius:14px; }

/* progress pills */
.sc-pill-done   { background:rgba(16,185,129,.12); color:#34d399; border:1px solid rgba(16,185,129,.22); }
.sc-pill-active { background:rgba(249,115,22,.12); color:#F97316; border:1px solid rgba(249,115,22,.3); animation:scPillPulse 2s infinite; }
.sc-pill-todo   { background:rgba(255,255,255,.05); color:#4b5563; border:1px solid rgba(255,255,255,.07); }

/* run buttons */
.sc-run-btn {
    background:#101c30; border:1.5px solid rgba(255,255,255,.08); border-radius:12px;
    color:#fff; font-family:'Oswald',sans-serif; font-size:1.6rem; font-weight:700;
    transition:background .14s, border-color .14s, transform .09s; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
}
.sc-run-btn:hover:not(:disabled)  { background:rgba(249,115,22,.14); border-color:rgba(249,115,22,.45); }
.sc-run-btn:active:not(:disabled) { transform:scale(.92); }
.sc-run-btn.sc-btn-4  { background:rgba(37,99,235,.1);  border-color:rgba(37,99,235,.3);  color:#93c5fd; }
.sc-run-btn.sc-btn-4:hover:not(:disabled)  { background:rgba(37,99,235,.22); }
.sc-run-btn.sc-btn-6  { background:rgba(5,150,105,.1);  border-color:rgba(5,150,105,.3);  color:#6ee7b7; }
.sc-run-btn.sc-btn-6:hover:not(:disabled)  { background:rgba(5,150,105,.22); }
.sc-run-btn:disabled  { opacity:.3; cursor:not-allowed; }

/* extra type buttons */
.sc-extra-btn {
    border-radius:9px; font-size:.72rem; font-weight:700; letter-spacing:.06em;
    padding:.5rem .6rem; border:1.5px solid rgba(255,255,255,.07);
    background:#101c30; color:#6b7280; transition:all .14s; cursor:pointer;
}
.sc-extra-btn.sc-extra-active { background:rgba(245,158,11,.14); border-color:rgba(245,158,11,.45); color:#fbbf24; }
.sc-extra-btn:hover:not(.sc-extra-active):not(:disabled) { background:rgba(255,255,255,.07); color:#d1d5db; }
.sc-extra-btn:disabled { opacity:.3; cursor:not-allowed; }

/* run pip buttons (extra run picker) */
.sc-pip { width:36px; height:36px; border-radius:8px; border:1.5px solid rgba(255,255,255,.08);
    background:#101c30; color:#9ca3af; font-weight:700; font-size:.85rem;
    transition:all .12s; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.sc-pip.sc-pip-active { background:rgba(249,115,22,.18); border-color:rgba(249,115,22,.5); color:#F97316; }
.sc-pip:hover:not(.sc-pip-active) { background:rgba(255,255,255,.09); color:#fff; }

/* wicket / undo */
.sc-wicket-btn {
    background:#dc2626; border:none; border-radius:12px; color:#fff;
    font-family:'Oswald',sans-serif; font-size:1.05rem; font-weight:700; letter-spacing:.1em;
    width:100%; transition:background .14s, transform .09s; cursor:pointer;
}
.sc-wicket-btn:hover:not(:disabled) { background:#b91c1c; }
.sc-wicket-btn:active:not(:disabled) { transform:scale(.97); }
.sc-wicket-btn:disabled { opacity:.3; cursor:not-allowed; }
.sc-undo-btn {
    background:rgba(255,255,255,.05); border:1.5px solid rgba(255,255,255,.08);
    border-radius:12px; color:#6b7280; font-weight:600; font-size:.85rem;
    cursor:pointer; transition:all .14s; display:flex; align-items:center; justify-content:center; gap:.4rem;
}
.sc-undo-btn:hover:not(:disabled) { background:rgba(255,255,255,.1); color:#d1d5db; border-color:rgba(255,255,255,.15); }
.sc-undo-btn:disabled { opacity:.3; cursor:not-allowed; }

/* ball dots */
.sc-ball {
    animation:scBallPop .22s cubic-bezier(.34,1.56,.64,1) both;
    border-radius:6px; min-width:28px; height:28px; padding:0 5px;
    display:flex; align-items:center; justify-content:center;
    font-size:.68rem; font-weight:800; border:1.5px solid;
}
.sc-ball-0  { background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.1); color:#4b5563; }
.sc-ball-r  { background:rgba(255,255,255,.09); border-color:rgba(255,255,255,.18); color:#e5e7eb; }
.sc-ball-4  { background:rgba(37,99,235,.18); border-color:rgba(37,99,235,.45); color:#93c5fd; box-shadow:0 0 6px rgba(37,99,235,.18); }
.sc-ball-6  { background:rgba(5,150,105,.18); border-color:rgba(5,150,105,.45); color:#6ee7b7; box-shadow:0 0 6px rgba(5,150,105,.18); }
.sc-ball-w  { background:rgba(220,38,38,.2); border-color:rgba(220,38,38,.5); color:#fca5a5; box-shadow:0 0 6px rgba(220,38,38,.2); }
.sc-ball-ex { background:rgba(245,158,11,.14); border-color:rgba(245,158,11,.35); color:#fcd34d; }

/* player rows in lineup */
.sc-pr       { padding:.42rem .65rem; border-radius:8px; display:flex; align-items:center; gap:.5rem; }
.sc-pr-str   { background:rgba(249,115,22,.09); border-left:3px solid #F97316; }
.sc-pr-bat   { background:rgba(255,255,255,.03); }
.sc-pr-bowl  { background:rgba(37,99,235,.07);  border-left:3px solid #3b82f6; }
.sc-pr-out   { opacity:.4; }

/* tabs */
.sc-tab      { padding:.3rem .9rem; border-radius:7px; font-size:.7rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; transition:all .14s; border:1.5px solid transparent; background:transparent; }
.sc-tab-on   { background:rgba(249,115,22,.12); border-color:rgba(249,115,22,.3); color:#F97316; }
.sc-tab-off  { color:#4b5563; }
.sc-tab-off:hover { color:#9ca3af; }

.sc-fadein { animation:scFadeIn .35s ease both; }
`;

export default function CricketScoringConsole() {
    const { matchId } = useParams<{ matchId: string }>();
    const dispatch = useAppDispatch();
    const entry = useAppSelector(selectMatchEntry(matchId || ''));
    const [playersPerTeam, setPlayersPerTeam] = useState(11);
    const [maxOversPerBowler, setMaxOversPerBowler] = useState<number | undefined>(undefined);
    const [openers, setOpeners] = useState<{ strikerId: string; nonStrikerId: string; bowlerId: string } | null>(null);
    const [scorecard, setScorecard] = useState<any>(null);

    useEffect(() => { if (matchId) dispatch(fetchMatchAndLive(matchId)); }, [matchId, dispatch]);
    useMatchSocket(matchId);

    useEffect(() => { if (entry?.liveState?.strikerId) setOpeners(null); }, [entry?.liveState?.strikerId]);

    const match = entry?.match;
    const live = entry?.liveState;

    useEffect(() => {
        if (match?.categoryId) {
            cricketCategoryApi.getById(match.categoryId)
                .then((c: any) => {
                    setPlayersPerTeam(c?.cricketConfig?.playersPerTeam ?? 11);
                    setMaxOversPerBowler(c?.cricketConfig?.maxOversPerBowler);
                })
                .catch(() => {});
        }
    }, [match?.categoryId]);

    // Fetch scorecard on every meaningful tally change — shared by both child panels.
    const tallyKey = `${live?.runs ?? 0}|${live?.wickets ?? 0}|${live?.completedOvers ?? 0}|${live?.currentInnings ?? 1}`;
    useEffect(() => {
        if (!matchId) return;
        let active = true;
        cricketMatchApi.getScorecard(matchId)
            .then((sc: any) => { if (active) setScorecard(sc); })
            .catch(() => {});
        return () => { active = false; };
    }, [matchId, tallyKey]);

    if (!matchId) return null;
    if (!entry || entry.status === 'loading') {
        return (
            <>
                <style>{SCORER_STYLES}</style>
                <div className="sc-bg flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
                        <p className="text-[11px] text-gray-600 uppercase tracking-widest">Loading match…</p>
                    </div>
                </div>
            </>
        );
    }
    if (entry.status === 'error' || !match) {
        return (
            <>
                <style>{SCORER_STYLES}</style>
                <div className="sc-bg flex items-center justify-center text-red-400 font-montserrat text-sm">
                    {entry.error || 'Match not found.'}
                </div>
            </>
        );
    }

    const setup = match.cricketSetup || {};
    const team1 = { id: match.teams?.team1Id, name: match.teams?.team1Name || 'Team 1' };
    const team2 = { id: match.teams?.team2Id, name: match.teams?.team2Name || 'Team 2' };
    const matchStatus = live?.matchStatus || 'awaiting_start';

    const tossDone      = !!setup.toss?.recorded;
    const t1LineupDone  = !!setup.team1Lineup?.lineupSet;
    const t2LineupDone  = !!setup.team2Lineup?.lineupSet;
    const setupComplete = !!setup.setupComplete || (tossDone && t1LineupDone && t2LineupDone);

    const steps = [
        { label: 'Toss',            done: tossDone,      active: !tossDone },
        { label: `${team1.name} XI`, done: t1LineupDone, active: tossDone && !t1LineupDone },
        { label: `${team2.name} XI`, done: t2LineupDone, active: t1LineupDone && !t2LineupDone },
        { label: 'Ready',           done: setupComplete,  active: t2LineupDone && !setupComplete },
    ];

    let phase: React.ReactNode;

    if (!tossDone) {
        phase = <TossSetup matchId={matchId} team1={team1} team2={team2} />;
    } else if (!t1LineupDone) {
        phase = <LineupSetup key={team1.id} matchId={matchId} team={team1} playersPerTeam={playersPerTeam} />;
    } else if (!t2LineupDone) {
        phase = <LineupSetup key={team2.id} matchId={matchId} team={team2} playersPerTeam={playersPerTeam} />;
    } else if (matchStatus === 'completed') {
        phase = <CricketMatchSummary match={match} />;
    } else {
        const needOpeners = !live || live.matchStatus === 'awaiting_start' || live.matchStatus === 'innings_break';
        if (needOpeners && !openers) {
            const battingTeamId = live?.battingTeamId
                ?? (setup.toss?.decision === 'bat' ? setup.toss?.winnerTeamId
                    : (setup.toss?.winnerTeamId === team1.id ? team2.id : team1.id));
            const bowlingTeamId = battingTeamId === team1.id ? team2.id : team1.id;
            const inningsNo = live?.matchStatus === 'innings_break' ? 2 : 1;
            phase = (
                <div className="flex flex-col gap-4">
                    {live?.matchStatus === 'innings_break' && (
                        <LiveScoreboardPanel match={match} live={live} scorecard={scorecard} />
                    )}
                    <StartInningsStep
                        inningsNumber={inningsNo}
                        battingXI={xiSlots(match, battingTeamId)}
                        bowlingXI={xiSlots(match, bowlingTeamId)}
                        onReady={setOpeners}
                    />
                </div>
            );
        } else {
            phase = (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px] gap-4 items-start">
                    <LiveScoreboardPanel match={match} live={live} scorecard={scorecard} />
                    <BallEntryPanel
                        matchId={matchId}
                        match={match}
                        live={live}
                        scorecard={scorecard}
                        initialStrikerId={openers?.strikerId}
                        initialNonStrikerId={openers?.nonStrikerId}
                        initialBowlerId={openers?.bowlerId}
                        maxOversPerBowler={maxOversPerBowler}
                    />
                </div>
            );
        }
    }

    return (
        <>
            <style>{SCORER_STYLES}</style>
            <div className="sc-bg font-montserrat">

                {/* ── Sticky header ── */}
                <div className="sticky top-0 z-20 bg-[#07101e]/90 backdrop-blur-md border-b border-white/5 px-4 md:px-8 lg:px-12 py-3 flex items-center gap-3">
                    <Link
                        to={`/organizer/tournament/${match.tournamentId}`}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-sm font-oswald font-bold tracking-wide text-white">Cricket Scoring</h1>
                            {live && matchStatus !== 'completed' && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F97316]/10 border border-[#F97316]/25 text-[10px] font-bold text-[#F97316] uppercase tracking-wider">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#F97316] animate-pulse" />
                                    Live
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-gray-600 truncate">{team1.name} vs {team2.name}</p>
                    </div>

                    {/* Progress pills — hidden on very small screens, shown in body instead */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        {steps.map(s => (
                            <span key={s.label} className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${s.done ? 'sc-pill-done' : s.active ? 'sc-pill-active' : 'sc-pill-todo'}`}>
                                {s.done ? '✓ ' : ''}{s.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── Page body ── */}
                <div className="px-4 md:px-8 lg:px-12 py-5 flex flex-col gap-4">

                    {/* Mobile progress pills */}
                    <div className="sm:hidden flex items-center gap-1.5 flex-wrap">
                        {steps.map(s => (
                            <span key={s.label} className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${s.done ? 'sc-pill-done' : s.active ? 'sc-pill-active' : 'sc-pill-todo'}`}>
                                {s.done ? '✓ ' : ''}{s.label}
                            </span>
                        ))}
                    </div>

                    {phase}
                </div>
            </div>
        </>
    );
}
