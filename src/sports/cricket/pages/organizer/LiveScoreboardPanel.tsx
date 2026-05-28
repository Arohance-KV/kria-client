import React, { useState } from 'react';
import { buildPlayerNameMap, nameOf, oversDisplay, xiSlots } from '@/sports/cricket/lib/lineup';

interface Props {
    match: any;
    live: any;
    scorecard?: any;
}

export default function LiveScoreboardPanel({ match, live, scorecard }: Props) {
    const [lineupTab, setLineupTab] = useState<'batting' | 'bowling'>('batting');
    const names = buildPlayerNameMap(match);
    const team1 = { id: match?.teams?.team1Id, name: match?.teams?.team1Name || 'Team 1' };
    const team2 = { id: match?.teams?.team2Id, name: match?.teams?.team2Name || 'Team 2' };

    if (!live) {
        return (
            <div className="sc-card p-5 text-gray-500 text-sm text-center sc-fadein">
                Innings not started yet.
            </div>
        );
    }

    const battingTeamId  = String(live.battingTeamId ?? '');
    const battingName    = battingTeamId === String(team1.id) ? team1.name : battingTeamId === String(team2.id) ? team2.name : 'Batting';
    const bowlingTeamId  = battingTeamId === String(team1.id) ? String(team2.id) : String(team1.id);
    const bowlingName    = bowlingTeamId === String(team1.id) ? team1.name : team2.name;

    const target       = live.target;
    const runs         = live.runs ?? 0;
    const wickets      = live.wickets ?? 0;
    const runsToWin    = target != null ? Math.max(0, target - runs) : null;
    const maxOvers     = match?.matchConfig?.maxOvers ?? 20;
    const compOvers    = live.completedOvers ?? 0;
    const ballsInOver  = live.ballsInCurrentOver ?? 0;
    const ballsUsed    = compOvers * 6 + ballsInOver;
    const ballsLeft    = maxOvers * 6 - ballsUsed;
    const progressPct  = Math.min(100, (compOvers / maxOvers) * 100);

    // scorecard helpers
    const inningsCard: any = live.currentInnings === 2 ? scorecard?.innings2 : scorecard?.innings1;
    const battingCard: any[]  = inningsCard?.battingCard  ?? [];
    const bowlingCard: any[]  = inningsCard?.bowlingCard  ?? [];
    const currentOverData = inningsCard?.oversTimeline?.find((o: any) => o.overNumber === compOvers + 1);
    const currentOverBalls: any[] = currentOverData?.balls ?? [];

    const strikerCard   = battingCard.find((b: any) => b.registrationId === live.strikerId);
    const nonStrikerCard = battingCard.find((b: any) => b.registrationId === live.nonStrikerId);
    const bowlerCard    = bowlingCard.find((b: any) => b.registrationId === live.currentBowlerId);

    // extras
    const ex        = live.extras ?? {};
    const exTotal   = (ex.wides ?? 0) + (ex.noBalls ?? 0) + (ex.byes ?? 0) + (ex.legByes ?? 0);

    // lineups
    const battingXI = xiSlots(match, live.battingTeamId);
    const bowlingXI = xiSlots(match, live.bowlingTeamId);

    const ballClass = (b: any) => {
        if (b.isWicket)                                             return 'sc-ball-w';
        if (b.label === '6')                                        return 'sc-ball-6';
        if (b.label === '4')                                        return 'sc-ball-4';
        if (b.label.startsWith('wd') || b.label.startsWith('nb')) return 'sc-ball-ex';
        if (b.label === '0')                                        return 'sc-ball-0';
        return 'sc-ball-r';
    };

    return (
        <div className="flex flex-col gap-3 sc-fadein">

            {/* ── Score header ── */}
            <div className="sc-card overflow-hidden">
                <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(135deg,#0e1f3c 0%,#091428 100%)' }}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-[9px] uppercase tracking-[.2em] text-gray-500 font-bold">
                                {battingName} · Innings {live.currentInnings ?? 1}
                            </div>
                            <div className="font-oswald font-black text-white leading-none mt-1.5 tabular-nums" style={{ fontSize: '3.2rem' }}>
                                {runs}<span className="text-[#F97316]">/</span><span style={{ fontSize: '2rem' }}>{wickets}</span>
                            </div>
                            <div className="text-sm text-gray-300 font-semibold mt-1.5">
                                {oversDisplay(live)} <span className="text-gray-500 font-normal">overs</span>
                            </div>
                        </div>

                        {runsToWin != null ? (
                            <div className="text-right shrink-0">
                                <div className="text-[9px] uppercase tracking-[.2em] text-gray-500 font-bold">Target</div>
                                <div className="font-oswald text-2xl font-black text-white tabular-nums mt-1">{target}</div>
                                <div className="text-xs font-bold text-[#F97316] mt-1">Need {runsToWin}</div>
                                <div className="text-[10px] text-gray-600 mt-0.5">in {ballsLeft} balls</div>
                            </div>
                        ) : (
                            <div className="text-right shrink-0">
                                <div className="text-[9px] uppercase tracking-[.2em] text-gray-500 font-bold">Over</div>
                                <div className="font-oswald text-3xl font-black text-gray-300 tabular-nums mt-1">{compOvers + 1}<span className="text-base text-gray-600">/{maxOvers}</span></div>
                            </div>
                        )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                            <div
                                className="h-full rounded-full"
                                style={{ width: `${progressPct}%`, background: 'linear-gradient(to right,#F97316,#f59e0b)', transition: 'width .7s' }}
                            />
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1.5">
                            <span>{ballsInOver}/6 balls bowled this over</span>
                            <span>{maxOvers * 6 - ballsUsed} balls remaining</span>
                        </div>
                    </div>
                </div>

                {/* Current over balls */}
                <div className="px-5 py-3 border-t border-white/5">
                    <div className="text-[9px] uppercase tracking-widest text-gray-600 font-bold mb-2">This over</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {currentOverBalls.map((b: any, i: number) => (
                            <span key={i} className={`sc-ball ${ballClass(b)}`} style={{ animationDelay: `${i * 0.04}s` }}>
                                {b.label}
                            </span>
                        ))}
                        {Array.from({ length: Math.max(0, 6 - currentOverBalls.length) }).map((_, i) => (
                            <span key={`ph-${i}`} className="sc-ball sc-ball-0" style={{ opacity: .25 }}>·</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── At the crease ── */}
            <div className="sc-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/5">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">At the Crease</span>
                </div>
                <div className="p-3 flex flex-col gap-1">

                    {/* Striker */}
                    <div className="sc-pr sc-pr-str">
                        <span className="text-[#F97316] font-black text-xs w-4 shrink-0">★</span>
                        <span className="font-bold text-white text-sm flex-1 truncate">{nameOf(names, live.strikerId)}</span>
                        {strikerCard && (
                            <span className="text-xs tabular-nums shrink-0 flex items-center gap-2 text-gray-300">
                                <span className="font-bold">{strikerCard.runs}</span>
                                <span className="text-gray-600">({strikerCard.ballsFaced})</span>
                                {strikerCard.fours > 0 && <span className="text-blue-400 font-bold">{strikerCard.fours}×4</span>}
                                {strikerCard.sixes > 0 && <span className="text-emerald-400 font-bold">{strikerCard.sixes}×6</span>}
                                <span className="text-gray-600 text-[10px]">SR {strikerCard.strikeRate.toFixed(0)}</span>
                            </span>
                        )}
                    </div>

                    {/* Non-striker */}
                    <div className="sc-pr sc-pr-bat">
                        <span className="text-gray-600 font-black text-xs w-4 shrink-0">◦</span>
                        <span className="font-semibold text-gray-300 text-sm flex-1 truncate">{nameOf(names, live.nonStrikerId)}</span>
                        {nonStrikerCard && (
                            <span className="text-xs tabular-nums shrink-0 text-gray-500">
                                {nonStrikerCard.runs}({nonStrikerCard.ballsFaced})
                            </span>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="my-1 border-t border-white/5" />

                    {/* Bowler */}
                    <div className="sc-pr sc-pr-bowl">
                        <span className="text-blue-400 font-black text-xs w-4 shrink-0">↗</span>
                        <span className="font-bold text-white text-sm flex-1 truncate">{nameOf(names, live.currentBowlerId)}</span>
                        {bowlerCard && (
                            <span className="text-xs tabular-nums shrink-0 text-blue-300 font-semibold">
                                {bowlerCard.overs}-{bowlerCard.maidens}-{bowlerCard.runs}-{bowlerCard.wickets}W
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Extras ── */}
            <div className="sc-card px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Extras</span>
                    <span className="font-oswald text-xl font-black text-[#fbbf24] tabular-nums">{exTotal} total</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {([
                        { key: 'Wide',    val: ex.wides    ?? 0, col: 'text-amber-400',  bg: 'rgba(245,158,11,.08)' },
                        { key: 'No-ball', val: ex.noBalls  ?? 0, col: 'text-amber-400',  bg: 'rgba(245,158,11,.08)' },
                        { key: 'Bye',     val: ex.byes     ?? 0, col: 'text-sky-400',    bg: 'rgba(56,189,248,.06)' },
                        { key: 'Leg-bye', val: ex.legByes  ?? 0, col: 'text-sky-400',    bg: 'rgba(56,189,248,.06)' },
                    ] as const).map(e => (
                        <div key={e.key} className="rounded-xl py-2.5 text-center" style={{ background: e.val > 0 ? e.bg : 'rgba(255,255,255,.03)' }}>
                            <div className={`font-oswald text-2xl font-black tabular-nums leading-none ${e.val > 0 ? e.col : 'text-gray-700'}`}>{e.val}</div>
                            <div className="text-[9px] text-gray-600 uppercase tracking-widest font-bold mt-1">{e.key}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Lineup viewer ── */}
            <div className="sc-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold flex-1">Lineups</span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setLineupTab('batting')}
                            className={`sc-tab ${lineupTab === 'batting' ? 'sc-tab-on' : 'sc-tab-off'}`}
                        >
                            {battingName}
                        </button>
                        <button
                            onClick={() => setLineupTab('bowling')}
                            className={`sc-tab ${lineupTab === 'bowling' ? 'sc-tab-on' : 'sc-tab-off'}`}
                        >
                            {bowlingName}
                        </button>
                    </div>
                </div>

                <div className="p-3 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                    {lineupTab === 'batting'
                        ? battingXI.map((p, i) => {
                            const card        = battingCard.find((b: any) => b.registrationId === p.registrationId);
                            const isStriker   = p.registrationId === live.strikerId;
                            const isNonStr    = p.registrationId === live.nonStrikerId;
                            const isOut       = !!card?.dismissal;
                            const hasBatted   = !!card;
                            return (
                                <div key={p.registrationId} className={`sc-pr ${isStriker ? 'sc-pr-str' : isNonStr ? 'sc-pr-bat' : isOut ? 'sc-pr-out' : ''}`}>
                                    <span className="text-[10px] font-bold text-gray-600 w-4 shrink-0">{i + 1}</span>
                                    <span className={`text-sm flex-1 truncate ${isStriker || isNonStr ? 'font-bold text-white' : isOut ? 'text-gray-500 line-through decoration-gray-600' : 'text-gray-300'}`}>
                                        {p.name}{isStriker ? ' ★' : ''}
                                    </span>
                                    {hasBatted ? (
                                        <span className={`text-xs tabular-nums shrink-0 ${isOut ? 'text-gray-600' : 'text-gray-300'}`}>
                                            {card.runs}({card.ballsFaced})
                                            {card.fours > 0 && <span className="text-blue-400 ml-1">{card.fours}×4</span>}
                                            {card.sixes > 0 && <span className="text-emerald-400 ml-1">{card.sixes}×6</span>}
                                        </span>
                                    ) : (
                                        !isStriker && !isNonStr && (
                                            <span className="text-[10px] text-gray-700 shrink-0">yet to bat</span>
                                        )
                                    )}
                                </div>
                            );
                        })
                        : bowlingXI.map((p, i) => {
                            const card     = bowlingCard.find((b: any) => b.registrationId === p.registrationId);
                            const isActive = p.registrationId === live.currentBowlerId;
                            return (
                                <div key={p.registrationId} className={`sc-pr ${isActive ? 'sc-pr-bowl' : ''}`}>
                                    <span className="text-[10px] font-bold text-gray-600 w-4 shrink-0">{i + 1}</span>
                                    <span className={`text-sm flex-1 truncate ${isActive ? 'font-bold text-white' : 'text-gray-300'}`}>
                                        {p.name}{isActive ? ' ↗' : ''}
                                    </span>
                                    {card ? (
                                        <span className="text-xs tabular-nums shrink-0 text-gray-500">
                                            {card.overs}-{card.maidens}-{card.runs}-<b className={card.wickets > 0 ? 'text-red-400' : 'text-gray-500'}>{card.wickets}</b>W
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-gray-700 shrink-0">—</span>
                                    )}
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
}
