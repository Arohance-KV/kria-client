import React, { useEffect, useState } from 'react';
import { Loader2, Trophy, Zap, ChevronRight, Tv, Play, Pause, SkipForward, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchMatchAndLive, selectMatchEntry } from '@/sports/cricket/store/cricketLiveStateSlice';
import { useMatchSocket } from '@/sports/cricket/lib/useMatchSocket';
import { cricketMatchApi } from '@/sports/cricket/api/cricketMatch';
import { buildPlayerNameMap, nameOf, oversDisplay } from '@/sports/cricket/lib/lineup';
import API from '@/api/axios';

// ─── Team branding (logo + colours), keyed by teamId ───────────────────────
interface TeamBrand { name: string; logo?: string; primaryColor?: string }
type TeamBrandMap = Record<string, TeamBrand>;

function initialsOf(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function TeamLogo({ brand, size = 28 }: { brand?: TeamBrand; size?: number }) {
    const dim = { width: size, height: size };
    if (brand?.logo) {
        return (
            <img
                src={brand.logo}
                alt={brand.name}
                className="rounded-full object-cover shrink-0 border border-white/15 bg-white/5"
                style={dim}
            />
        );
    }
    return (
        <div
            className="rounded-full shrink-0 flex items-center justify-center font-black text-white border border-white/15"
            style={{ ...dim, background: brand?.primaryColor || '#1e3a5f', fontSize: size * 0.4 }}
            title={brand?.name}
        >
            {initialsOf(brand?.name)}
        </div>
    );
}

// ─── Scorecard shape (matches server) ──────────────────────────────────────
interface BatterEntry {
    registrationId: string; name: string; runs: number; ballsFaced: number;
    fours: number; sixes: number; strikeRate: number;
    dismissal?: { type: string; bowlerId?: string; bowlerName?: string; fielderId?: string; fielderName?: string };
}
interface BowlerEntry {
    registrationId: string; name: string; overs: string; maidens: number;
    runs: number; wickets: number; economy: number;
}
interface BallSummary { label: string; runs: number; isWicket: boolean }
interface OverSummary { overNumber: number; runs: number; wickets: number; balls: BallSummary[] }
interface PartnershipInfo {
    strikerId: string; strikerName: string; nonStrikerId: string; nonStrikerName: string;
    runs: number; balls: number;
}
interface FallOfWicket {
    wicketNumber: number; score: number; overs: string;
    batterId: string; batterName: string; dismissalLine: string;
    partnershipRuns: number; partnershipBalls: number;
}
interface PartnershipRecord {
    wicketNumber: number;
    batter1Id: string; batter1Name: string;
    batter2Id: string; batter2Name: string;
    runs: number; balls: number; unbroken: boolean;
}
interface InningsScorecard {
    inningsNumber: 1 | 2; battingTeamId: string; battingTeamName: string;
    bowlingTeamId: string; bowlingTeamName: string;
    totals: { runs: number; wickets: number; overs: string; extras: { wides: number; noBalls: number; byes: number; legByes: number; total: number } };
    battingCard: BatterEntry[]; bowlingCard: BowlerEntry[];
    oversTimeline: OverSummary[]; currentPartnership: PartnershipInfo | null;
    fallOfWickets: FallOfWicket[]; partnerships: PartnershipRecord[];
}
interface Scorecard { innings1: InningsScorecard | null; innings2: InningsScorecard | null }

// ─── Dismissal helper ─────────────────────────────────────────────────────
const dismissalLine = (d: BatterEntry['dismissal']): string => {
    if (!d) return 'not out';
    switch (d.type) {
        case 'bowled': return `b ${d.bowlerName ?? '—'}`;
        case 'lbw': return `lbw b ${d.bowlerName ?? '—'}`;
        case 'caught': return `c ${d.fielderName ?? '—'} b ${d.bowlerName ?? '—'}`;
        case 'stumped': return `st ${d.fielderName ?? '—'} b ${d.bowlerName ?? '—'}`;
        case 'run_out': return `run out${d.fielderName ? ' (' + d.fielderName + ')' : ''}`;
        case 'hit_wicket': return `hit wicket b ${d.bowlerName ?? '—'}`;
        case 'retired_hurt': return 'retired hurt';
        default: return d.type;
    }
};

// ─── Embedded animation styles ────────────────────────────────────────────
const STYLES = `
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}
@keyframes pulseRing {
    0%   { box-shadow: 0 0 0 0 rgba(239,68,68,.7); }
    70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}
@keyframes liveGlow {
    0%, 100% { text-shadow: 0 0 8px rgba(239,68,68,.9), 0 0 20px rgba(239,68,68,.4); }
    50%       { text-shadow: 0 0 4px rgba(239,68,68,.6); }
}
@keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
}
@keyframes barGrow {
    from { transform: scaleY(0); transform-origin: bottom; }
    to   { transform: scaleY(1); transform-origin: bottom; }
}
@keyframes ballPop {
    0%   { opacity: 0; transform: scale(.4); }
    65%  { transform: scale(1.15); }
    100% { opacity: 1; transform: scale(1); }
}
@keyframes scoreFlash {
    0%,100% { opacity: 1; }
    50%     { opacity: .6; }
}
@keyframes borderPulse {
    0%, 100% { border-color: rgba(245,158,11,.5); }
    50%      { border-color: rgba(245,158,11,1); }
}
@keyframes rowIn {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: 1; transform: translateX(0); }
}

/* utility classes */
.anim-fadeup    { animation: fadeInUp .45s ease both; }
.anim-fadein    { animation: fadeIn .4s ease both; }
.anim-bar-grow  { animation: barGrow .7s cubic-bezier(.22,.61,.36,1) both; }
.anim-ball-pop  { animation: ballPop .3s cubic-bezier(.34,1.56,.64,1) both; }
.anim-row-in    { animation: rowIn .35s ease both; }

.live-badge {
    animation: pulseRing 1.8s cubic-bezier(0.455,0.03,0.515,0.955) infinite;
}
.live-text {
    animation: liveGlow 2s ease-in-out infinite;
}
.gold-shimmer {
    background: linear-gradient(90deg, #f59e0b 0%, #fde68a 40%, #f59e0b 60%, #b45309 100%);
    background-size: 200% auto;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 3s linear infinite;
}
.stadium-bg {
    background:
        radial-gradient(ellipse 70% 40% at 50% 0%, rgba(245,158,11,.07) 0%, transparent 70%),
        radial-gradient(ellipse 60% 30% at 20% 100%, rgba(30,64,175,.12) 0%, transparent 60%),
        radial-gradient(ellipse 60% 30% at 80% 100%, rgba(220,38,38,.08) 0%, transparent 60%),
        #050e1c;
}
.card-ipl {
    background: #0a1628;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 16px;
}
.card-gold-border {
    border-color: rgba(245,158,11,.35) !important;
    animation: borderPulse 3s ease infinite;
}
.ball-six {
    background: rgba(16,185,129,.2);
    border-color: rgba(16,185,129,.5);
    color: #34d399;
    box-shadow: 0 0 8px rgba(16,185,129,.3);
}
.ball-four {
    background: rgba(59,130,246,.2);
    border-color: rgba(59,130,246,.5);
    color: #93c5fd;
    box-shadow: 0 0 8px rgba(59,130,246,.25);
}
.ball-wicket {
    background: rgba(239,68,68,.2);
    border-color: rgba(239,68,68,.5);
    color: #fca5a5;
    box-shadow: 0 0 8px rgba(239,68,68,.3);
}
.ball-extra {
    background: rgba(245,158,11,.15);
    border-color: rgba(245,158,11,.4);
    color: #fcd34d;
}
.ball-dot {
    background: rgba(255,255,255,.05);
    border-color: rgba(255,255,255,.12);
    color: #6b7280;
}
.ball-run {
    background: rgba(255,255,255,.08);
    border-color: rgba(255,255,255,.15);
    color: #e5e7eb;
}
.score-hero {
    font-family: 'Oswald', sans-serif;
    letter-spacing: -0.5px;
}
.striker-row {
    background: rgba(249,115,22,.08);
    border-left: 3px solid #F97316;
}
.active-bowler-row {
    background: rgba(59,130,246,.07);
    border-left: 3px solid #3b82f6;
}
`;

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function CricketLiveScoreboard({ matchId }: { matchId: string }) {
    const dispatch = useAppDispatch();
    const entry = useAppSelector(selectMatchEntry(matchId));
    const [scorecard, setScorecard] = useState<Scorecard | null>(null);
    const [broadcastOpen, setBroadcastOpen] = useState(false);
    const [brands, setBrands] = useState<TeamBrandMap>({});

    useEffect(() => { if (matchId) dispatch(fetchMatchAndLive(matchId)); }, [matchId, dispatch]);
    useMatchSocket(matchId);

    // Team logos / colours for the tournament — fetched once, keyed by teamId.
    const tournamentId = entry?.match?.tournamentId ? String(entry.match.tournamentId) : '';
    useEffect(() => {
        if (!tournamentId) return;
        let active = true;
        API.get(`/tournaments/${tournamentId}/teams`)
            .then((res) => {
                const teams = res.data?.data?.data || res.data?.data || [];
                const map: TeamBrandMap = {};
                (teams as any[]).forEach((t) => {
                    map[String(t._id)] = { name: t.name, logo: t.logo, primaryColor: t.primaryColor };
                });
                if (active) setBrands(map);
            })
            .catch(() => { /* logos are non-critical */ });
        return () => { active = false; };
    }, [tournamentId]);

    const live = entry?.liveState;
    const tallyKey = `${live?.runs ?? 0}|${live?.wickets ?? 0}|${live?.completedOvers ?? 0}|${live?.ballsInCurrentOver ?? 0}|${live?.matchStatus ?? ''}`;
    useEffect(() => {
        if (!matchId) return;
        let active = true;
        cricketMatchApi.getScorecard(matchId)
            .then((sc: any) => { if (active) setScorecard(sc); })
            .catch(() => { /* keep last */ });
        return () => { active = false; };
    }, [matchId, tallyKey]);

    if (!entry || entry.status === 'loading') {
        return (
            <div className="min-h-screen stadium-bg flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-[#f59e0b]" />
                    <p className="text-gray-400 text-sm font-montserrat tracking-widest uppercase">Loading match…</p>
                </div>
            </div>
        );
    }
    if (entry.status === 'error' || !entry.match) {
        return (
            <div className="min-h-screen stadium-bg flex items-center justify-center text-red-400 font-montserrat">
                {entry.error || 'Match not found.'}
            </div>
        );
    }

    const match = entry.match;
    const completed = live?.matchStatus === 'completed' || match.status === 'completed';
    const team1 = { id: String(match?.teams?.team1Id), name: match?.teams?.team1Name || 'Team 1' };
    const team2 = { id: String(match?.teams?.team2Id), name: match?.teams?.team2Name || 'Team 2' };
    const currentInnings = (live?.currentInnings ?? 1) as 1 | 2;
    const currentInningsCard = currentInnings === 1 ? scorecard?.innings1 : scorecard?.innings2;
    const otherInningsCard = currentInnings === 1 ? scorecard?.innings2 : scorecard?.innings1;
    const names = buildPlayerNameMap(match);

    return (
        <>
            <style>{STYLES}</style>
            <div className="min-h-screen stadium-bg text-white font-montserrat pb-12">

                {/* ── Sticky top bar ── */}
                <div className="sticky top-0 z-30 backdrop-blur-md bg-[#050e1c]/80 border-b border-white/5 py-2.5 px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 shrink-0">
                        <TeamLogo brand={brands[team1.id]} size={22} />
                        {team1.name} <span className="text-[#f59e0b]">vs</span> {team2.name}
                        <TeamLogo brand={brands[team2.id]} size={22} />
                    </span>
                    <div className="flex-1 min-w-0 flex justify-center">
                        <TossBanner match={match} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {scorecard?.innings1 || scorecard?.innings2 ? (
                            <button
                                onClick={() => setBroadcastOpen(true)}
                                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#f59e0b]/40 text-[11px] font-bold uppercase tracking-widest text-gray-300 hover:text-[#f59e0b] transition-colors"
                                title="Broadcast slideshow"
                            >
                                <Tv className="h-3 w-3" />
                                <span className="hidden sm:inline">Broadcast</span>
                            </button>
                        ) : null}
                        {!completed && live ? (
                            <span className="flex items-center gap-1.5 live-badge rounded-full bg-red-500/10 border border-red-500/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-red-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                <span className="live-text">Live</span>
                            </span>
                        ) : completed ? (
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                                <Trophy className="h-3 w-3" /> Full Time
                            </span>
                        ) : null}
                    </div>
                </div>

                {broadcastOpen && (
                    <BroadcastMode
                        match={match}
                        live={live}
                        scorecard={scorecard}
                        completed={completed}
                        currentInnings={currentInnings}
                        brands={brands}
                        onExit={() => setBroadcastOpen(false)}
                    />
                )}

                {/* ── Page body — full viewport width, responsive edge padding ── */}
                <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20 pt-5 pb-12 flex flex-col gap-4">

                    {/* Hero always full-width (toss summary lives in the sticky header) */}
                    <HeroScoreBanner
                        match={match} live={live}
                        team1={team1} team2={team2}
                        completed={completed}
                        brands={brands}
                    />

                    {/* Match summary — replaces the live-only cards once the game is over */}
                    {completed && <MatchSummarySlide match={match} scorecard={scorecard} brands={brands} />}

                    {/* ── Two-column layout ── */}
                    {/*   mobile: sidebar (order-1) first → live data visible above fold   */}
                    {/*   desktop: scorecards left, sidebar right (sticky)                 */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_460px] gap-4 items-start">

                        {/* ── RIGHT sidebar (shown first on mobile) ── */}
                        {/* Live-only cards (at the crease / current partnership / run rates)
                            are hidden once the match is over — the summary block above covers it. */}
                        <div className="flex flex-col gap-4 order-1 lg:order-2 lg:sticky lg:top-13">
                            {!completed && <AtTheCreaseCard match={match} live={live} names={names} />}
                            {!completed && <PartnershipCard partnership={currentInningsCard?.currentPartnership ?? null} />}
                            {!completed && <RunRateBar match={match} live={live} />}
                            <Innings1Panel innings1={scorecard?.innings1 ?? null} currentInnings={currentInnings} />
                        </div>

                        {/* ── LEFT main column (scorecards + charts) ── */}
                        <div className="flex flex-col gap-4 order-2 lg:order-1 min-w-0">
                            <OversTimeline innings={currentInningsCard ?? null} />
                            <ManhattanChart innings={currentInningsCard ?? null} maxOvers={match?.matchConfig?.maxOvers} />
                            <WormChart
                                innings1={scorecard?.innings1 ?? null}
                                innings2={scorecard?.innings2 ?? null}
                                maxOvers={match?.matchConfig?.maxOvers}
                                team1Name={team1.name}
                                team2Name={team2.name}
                            />

                            <BattingCard
                                title={currentInningsCard ? `Batting — ${currentInningsCard.battingTeamName}` : 'Batting'}
                                innings={currentInningsCard ?? null}
                                strikerId={live?.strikerId}
                                nonStrikerId={live?.nonStrikerId}
                                brands={brands}
                            />
                            <BowlingCard
                                title={currentInningsCard ? `Bowling — ${currentInningsCard.bowlingTeamName}` : 'Bowling'}
                                innings={currentInningsCard ?? null}
                                currentBowlerId={live?.currentBowlerId}
                                brands={brands}
                            />
                            <FallOfWicketsCard innings={currentInningsCard ?? null} />
                            <PartnershipsCard innings={currentInningsCard ?? null} />

                            {completed && otherInningsCard && (
                                <>
                                    <BattingCard
                                        title={`Batting — ${otherInningsCard.battingTeamName} (Innings ${otherInningsCard.inningsNumber})`}
                                        innings={otherInningsCard}
                                        brands={brands}
                                    />
                                    <BowlingCard
                                        title={`Bowling — ${otherInningsCard.bowlingTeamName} (Innings ${otherInningsCard.inningsNumber})`}
                                        innings={otherInningsCard}
                                        brands={brands}
                                    />
                                    <FallOfWicketsCard innings={otherInningsCard} titleSuffix={` · Innings ${otherInningsCard.inningsNumber}`} />
                                    <PartnershipsCard innings={otherInningsCard} titleSuffix={` · Innings ${otherInningsCard.inningsNumber}`} />
                                </>
                            )}

                            <WagonWheelPlaceholder />

                            <LineupsCard match={match} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO SCORE BANNER — the dramatic IPL/ICC main panel
// ═══════════════════════════════════════════════════════════════════════════

function HeroScoreBanner({ match, live, team1, team2, completed, brands }: {
    match: any; live: any; team1: { id: string; name: string }; team2: { id: string; name: string }; completed: boolean;
    brands: TeamBrandMap;
}) {
    const target = live?.target;
    const runs = live?.runs ?? 0;
    const wickets = live?.wickets ?? 0;
    const runsToWin = target != null ? Math.max(0, target - runs) : null;
    const currentInnings = live?.currentInnings ?? 1;
    const overs = oversDisplay(live);

    // Which team is batting?
    const battingTeam = live?.battingTeamId
        ? (String(live.battingTeamId) === team1.id ? team1.name : team2.name)
        : null;
    const bowlingTeam = battingTeam === team1.name ? team2.name : team1.name;
    const battingTeamId = live?.battingTeamId && String(live.battingTeamId) === team2.id ? team2.id : team1.id;
    const bowlingTeamId = battingTeamId === team1.id ? team2.id : team1.id;

    const maxOvers = match?.matchConfig?.maxOvers ?? 20;
    const completedOvers = live?.completedOvers ?? 0;
    const progressPct = Math.min(100, Math.round((completedOvers / maxOvers) * 100));

    return (
        <div className="anim-fadeup relative overflow-hidden rounded-2xl border border-[#1e3a5f]"
            style={{ background: 'linear-gradient(135deg, #0a1f3c 0%, #091428 50%, #0e1a2e 100%)' }}>

            {/* Gold top accent line */}
            <div className="h-0.5 w-full bg-linear-to-r from-transparent via-[#f59e0b] to-transparent" />

            {/* Background decoration */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-[#1e40af]/10 blur-3xl" />
                <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-[#f59e0b]/5 blur-3xl" />
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#dc2626]/5 blur-2xl" />
            </div>

            <div className="relative p-5 flex flex-col gap-4">
                {/* Team names row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <TeamLogo brand={brands[battingTeamId]} size={40} />
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                                {currentInnings === 2 ? 'Innings 2' : 'Innings 1'}
                            </span>
                            <span className="text-xs font-bold text-gray-300 mt-0.5 uppercase tracking-wide truncate">
                                {battingTeam ?? team1.name}
                            </span>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-widest bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-full px-3 py-1 shrink-0">
                        vs
                    </div>
                    <div className="flex items-center gap-3 min-w-0 justify-end">
                        <div className="flex flex-col items-end min-w-0">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Bowling</span>
                            <span className="text-xs font-bold text-gray-300 mt-0.5 uppercase tracking-wide truncate">
                                {bowlingTeam ?? team2.name}
                            </span>
                        </div>
                        <TeamLogo brand={brands[bowlingTeamId]} size={40} />
                    </div>
                </div>

                {/* BIG SCORE */}
                {live ? (
                    <div className="flex items-end justify-between gap-2">
                        <div>
                            <div className="score-hero text-6xl font-black text-white leading-none tabular-nums">
                                {runs}<span className="text-[#f59e0b]">/</span><span className="text-4xl">{wickets}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-gray-300 font-semibold tabular-nums">{overs} ov</span>
                                {target != null && (
                                    <span className="text-xs bg-white/10 rounded-full px-2.5 py-0.5 text-gray-200 font-semibold">
                                        Target {target}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Chase / Target info */}
                        <div className="text-right">
                            {runsToWin != null && runsToWin > 0 ? (
                                <div className="flex flex-col items-end gap-1">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Need</div>
                                    <div className="score-hero text-3xl font-black text-[#f59e0b] tabular-nums leading-none">{runsToWin}</div>
                                    <div className="text-xs text-gray-400">
                                        in {(maxOvers * 6) - (live.completedOvers * 6 + (live.ballsInCurrentOver ?? 0))} balls
                                    </div>
                                </div>
                            ) : runsToWin === 0 ? (
                                <div className="text-emerald-400 font-bold text-sm">Target Achieved!</div>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <div className="py-6 text-center">
                        <div className="score-hero text-2xl font-bold text-gray-500">Match not started</div>
                    </div>
                )}

                {/* Progress bar */}
                {live && (
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-1.5">
                            <span>Overs progress</span>
                            <span>{completedOvers}/{maxOvers}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-linear-to-r from-[#f59e0b] to-[#F97316] transition-all duration-700"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Gold bottom accent */}
            <div className="h-px w-full bg-linear-to-r from-transparent via-[#f59e0b]/30 to-transparent" />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// AT THE CREASE — striker, non-striker, bowler
// ═══════════════════════════════════════════════════════════════════════════

function AtTheCreaseCard({ match, live, names }: { match: any; live: any; names: Record<string, string> }) {
    if (!live) return null;
    const striker = nameOf(names, live.strikerId);
    const nonStriker = nameOf(names, live.nonStrikerId);
    const bowler = nameOf(names, live.currentBowlerId);

    return (
        <div className="anim-fadeup card-ipl overflow-hidden" style={{ animationDelay: '.05s' }}>
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                At the Crease
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
                {/* Batting */}
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b]">Batting</div>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-[#F97316]/20 border border-[#F97316]/30 flex items-center justify-center shrink-0">
                            <svg width="13" height="13" viewBox="0 0 20 26" fill="none">
                                <rect x="4" y="0" width="12" height="17" rx="3" fill="#F97316"/>
                                <rect x="7.5" y="17" width="5" height="9" rx="2.5" fill="#F97316" opacity="0.65"/>
                            </svg>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white leading-tight">{striker}</div>
                            <div className="text-[10px] text-[#F97316] font-bold">On strike</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-gray-500">◦</span>
                        </div>
                        <div className="text-sm text-gray-300 font-semibold">{nonStriker}</div>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-l border-white/8 pl-3 flex flex-col gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#60a5fa]">Bowling</div>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="9" fill="#dc2626"/>
                                <path d="M3.5 7.5 Q10 4.5 16.5 7.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                                <path d="M3.5 12.5 Q10 15.5 16.5 12.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                                <path d="M10 1.5 Q13 10 10 18.5" stroke="white" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.5"/>
                            </svg>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white leading-tight">{bowler}</div>
                            <div className="text-[10px] text-blue-400 font-bold">Bowling</div>
                        </div>
                    </div>
                    {/* Extras row */}
                    <div className="text-[10px] text-gray-500 mt-1 leading-5">
                        <span className="text-gray-400 font-semibold">Extras</span>{' '}
                        wd {live.extras?.wides ?? 0} · nb {live.extras?.noBalls ?? 0} · b {live.extras?.byes ?? 0} · lb {live.extras?.legByes ?? 0}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOSS BANNER
// ═══════════════════════════════════════════════════════════════════════════

function TossBanner({ match }: { match: any }) {
    const toss = match?.cricketSetup?.toss;
    if (!toss?.recorded) return null;
    const t1 = String(match?.teams?.team1Id);
    const winnerName = String(toss.winnerTeamId) === t1 ? match?.teams?.team1Name : match?.teams?.team2Name;
    return (
        <span className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f59e0b]/5 border border-[#f59e0b]/15 text-[11px] text-gray-400 min-w-0 truncate">
            <Zap className="h-3 w-3 text-[#f59e0b] shrink-0" />
            <span className="truncate">
                <b className="text-[#f59e0b]">{winnerName || 'Toss'}</b> won the toss &amp; chose to{' '}
                <b className="text-white">{toss.decision === 'bat' ? 'bat' : 'bowl'}</b> first.
            </span>
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTNERSHIP CARD
// ═══════════════════════════════════════════════════════════════════════════

function PartnershipCard({ partnership }: { partnership: PartnershipInfo | null }) {
    if (!partnership || partnership.balls === 0) return null;
    const sr = partnership.balls > 0 ? Math.round((partnership.runs / partnership.balls) * 1000) / 10 : 0;
    // visual bar — assume max partnership of ~80 runs for visual scaling
    const barPct = Math.min(100, Math.round((partnership.runs / 80) * 100));

    return (
        <div className="anim-fadeup card-ipl overflow-hidden" style={{ animationDelay: '.1s' }}>
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Current Partnership
            </div>
            <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="text-sm text-gray-200 truncate">
                            <b className="text-white">{partnership.strikerName}</b>{' '}
                            <span className="text-gray-500">&amp;</span>{' '}
                            <b className="text-white">{partnership.nonStrikerName}</b>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="score-hero text-3xl font-black text-white tabular-nums leading-none">
                            {partnership.runs}
                            <span className="text-lg text-gray-400 font-semibold"> ({partnership.balls})</span>
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-0.5">
                            SR {sr.toFixed(1)}
                        </div>
                    </div>
                </div>
                {/* visual bar */}
                <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-linear-to-r from-[#F97316] to-[#f59e0b] transition-all duration-700"
                        style={{ width: `${barPct}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN RATE BAR
// ═══════════════════════════════════════════════════════════════════════════

function RunRateBar({ match, live }: { match: any; live: any }) {
    if (!live) return null;
    const maxOvers: number | undefined = match?.matchConfig?.maxOvers;
    const ballsBowled = (live.completedOvers ?? 0) * 6 + (live.ballsInCurrentOver ?? 0);
    const runs = live.runs ?? 0;
    const crr = ballsBowled > 0 ? Math.round((runs * 6 / ballsBowled) * 100) / 100 : 0;
    let rrr: number | null = null;
    if (live.target != null && maxOvers) {
        const ballsRemaining = maxOvers * 6 - ballsBowled;
        if (ballsRemaining > 0) {
            rrr = Math.round(((live.target - runs) * 6 / ballsRemaining) * 100) / 100;
            if (rrr < 0) rrr = 0;
        }
    }

    const rrrHigh = rrr != null && crr > 0 && rrr > crr * 1.3;

    return (
        <div className="grid grid-cols-2 gap-3" style={{ animationDelay: '.12s' }}>
            <div className="anim-fadeup card-ipl p-4">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Current RR</div>
                <div className="score-hero text-3xl font-black text-white mt-1 tabular-nums">{crr.toFixed(2)}</div>
                <div className="mt-2 h-0.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-linear-to-r from-[#f59e0b] to-[#F97316]" style={{ width: `${Math.min(100, crr * 5)}%` }} />
                </div>
            </div>
            <div className={`anim-fadeup card-ipl p-4 ${rrrHigh ? 'card-gold-border' : ''}`} style={{ animationDelay: '.15s' }}>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Required RR</div>
                <div className={`score-hero text-3xl font-black mt-1 tabular-nums ${rrrHigh ? 'text-[#f59e0b]' : 'text-white'}`}>
                    {rrr != null ? rrr.toFixed(2) : '—'}
                </div>
                {rrr != null && (
                    <div className="mt-2 h-0.5 w-full rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full rounded-full ${rrrHigh ? 'bg-linear-to-r from-red-500 to-[#f59e0b]' : 'bg-linear-to-r from-emerald-500 to-[#f59e0b]'}`} style={{ width: `${Math.min(100, rrr * 5)}%` }} />
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// INNINGS 1 PANEL
// ═══════════════════════════════════════════════════════════════════════════

function Innings1Panel({ innings1, currentInnings }: { innings1: InningsScorecard | null; currentInnings: 1 | 2 }) {
    if (currentInnings !== 2 || !innings1) return null;
    const t = innings1.totals;
    return (
        <div className="anim-fadeup card-ipl px-4 py-3 flex items-center justify-between">
            <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">1st Innings</div>
                <div className="text-sm font-bold text-gray-200 mt-0.5">{innings1.battingTeamName}</div>
            </div>
            <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-gray-600" />
                <div className="text-right">
                    <div className="score-hero text-2xl font-black text-white tabular-nums leading-none">{t.runs}/{t.wickets}</div>
                    <div className="text-[11px] text-gray-400 font-semibold mt-0.5">{t.overs} overs</div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERS TIMELINE — with glow effects
// ═══════════════════════════════════════════════════════════════════════════

function ballClass(b: BallSummary): string {
    if (b.isWicket) return 'ball-wicket';
    if (b.label.startsWith('wd') || b.label.startsWith('nb')) return 'ball-extra';
    if (b.label.startsWith('b') || b.label.startsWith('lb')) return 'ball-extra';
    if (b.label === '6') return 'ball-six';
    if (b.label === '4') return 'ball-four';
    if (b.label === '0') return 'ball-dot';
    return 'ball-run';
}

function OversTimeline({ innings }: { innings: InningsScorecard | null }) {
    if (!innings || innings.oversTimeline.length === 0) return null;
    const recent = innings.oversTimeline.slice(-6);

    return (
        <section className="anim-fadeup card-ipl overflow-hidden" style={{ animationDelay: '.18s' }}>
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 flex items-center justify-between">
                <span className="text-sm font-bold text-white">Recent Overs</span>
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Last {recent.length}</span>
            </div>
            <div className="p-4 flex flex-col gap-3.5">
                {recent.map((over, oi) => (
                    <div key={over.overNumber} className="flex items-center gap-3">
                        <div className="w-10 shrink-0">
                            <div className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">Ov</div>
                            <div className="text-sm font-black text-gray-400 font-oswald">{over.overNumber}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                            {over.balls.map((b, bi) => (
                                <span
                                    key={bi}
                                    className={`anim-ball-pop px-1.5 min-w-7 text-center text-[11px] font-black rounded-md border ${ballClass(b)}`}
                                    style={{ animationDelay: `${oi * 0.06 + bi * 0.04}s` }}
                                >
                                    {b.label}
                                </span>
                            ))}
                        </div>
                        <div className="text-xs tabular-nums shrink-0 text-right min-w-11">
                            <span className="font-black text-white">{over.runs}</span>
                            <span className="text-gray-500"> r</span>
                            {over.wickets > 0 && <span className="text-red-400 font-bold"> {over.wickets}w</span>}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MANHATTAN CHART — animated bars
// ═══════════════════════════════════════════════════════════════════════════

function ManhattanChart({ innings, maxOvers, large = false }: { innings: InningsScorecard | null; maxOvers?: number; large?: boolean }) {
    if (!innings || innings.oversTimeline.length === 0) return null;
    const overs = innings.oversTimeline;
    const peak = Math.max(1, ...overs.map(o => o.runs));
    const total = maxOvers ?? overs[overs.length - 1].overNumber;
    const slots = Array.from({ length: total }, (_, i) => {
        const o = overs.find(x => x.overNumber === i + 1);
        return o ?? { overNumber: i + 1, runs: 0, wickets: 0, empty: true };
    }) as Array<{ overNumber: number; runs: number; wickets: number; empty?: boolean }>;

    const barWidth = large ? 40 : 20;

    return (
        <section className="anim-fadeup card-ipl overflow-hidden" style={{ animationDelay: '.22s' }}>
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 flex items-center justify-between">
                <span className="text-sm font-bold text-white">Runs Per Over</span>
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Peak {peak}</span>
            </div>
            <div className={`overflow-x-auto ${large ? 'p-6' : 'p-4'}`}>
                <div className={`flex items-end min-w-fit ${large ? 'gap-2 h-72' : 'gap-1 h-28'}`}>
                    {slots.map((s, si) => {
                        const heightPct = s.empty ? 0 : Math.max(6, Math.round((s.runs / peak) * 100));
                        const barColor = s.empty
                            ? 'rgba(255,255,255,.04)'
                            : s.wickets > 0
                                ? 'linear-gradient(to top, #ef4444, #fca5a5)'
                                : 'linear-gradient(to top, #F97316, #f59e0b)';
                        return (
                            <div key={s.overNumber}
                                className="flex flex-col items-center gap-0.5 shrink-0 h-full"
                                style={{ width: barWidth }}>
                                <div className="flex-1 w-full flex items-end justify-center min-h-0 relative">
                                    <div
                                        className={`w-full anim-bar-grow ${large ? 'rounded-t-md' : 'rounded-t-sm'}`}
                                        style={{
                                            height: `${heightPct}%`,
                                            background: barColor,
                                            animationDelay: `${si * 0.02}s`,
                                        }}
                                        title={s.empty ? `Over ${s.overNumber}: not bowled` : `Over ${s.overNumber}: ${s.runs} runs${s.wickets ? `, ${s.wickets}w` : ''}`}
                                    />
                                    {!s.empty && s.runs > 0 && (
                                        <span className={`absolute font-bold text-gray-400 tabular-nums ${large ? '-top-5 text-xs' : '-top-4 text-[8px]'}`}>{s.runs}</span>
                                    )}
                                </div>
                                <div className={`text-gray-600 font-mono tabular-nums ${large ? 'text-[10px]' : 'text-[8px]'}`}>{s.overNumber}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// BATTING CARD
// ═══════════════════════════════════════════════════════════════════════════

function BattingCard({ title, innings, strikerId, nonStrikerId, brands }: {
    title: string; innings: InningsScorecard | null; strikerId?: string; nonStrikerId?: string; brands?: TeamBrandMap;
}) {
    if (!innings || innings.battingCard.length === 0) return null;
    const activeIds = new Set([strikerId, nonStrikerId].filter(Boolean) as string[]);

    return (
        <section className="anim-fadeup card-ipl overflow-hidden" style={{ animationDelay: '.26s' }}>
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <TeamLogo brand={brands?.[innings.battingTeamId]} size={22} />
                    {title}
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-[9px] uppercase tracking-widest text-gray-600">
                            <th className="text-left px-4 py-2.5 font-bold">Batter</th>
                            <th className="text-right px-2 py-2.5 font-bold">R</th>
                            <th className="text-right px-2 py-2.5 font-bold">B</th>
                            <th className="text-right px-2 py-2.5 font-bold">4s</th>
                            <th className="text-right px-2 py-2.5 font-bold">6s</th>
                            <th className="text-right px-4 py-2.5 font-bold">SR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {innings.battingCard.map((b, i) => {
                            const isStriker = b.registrationId === strikerId;
                            const isActive = activeIds.has(b.registrationId);
                            return (
                                <tr key={b.registrationId}
                                    className={`border-t border-white/5 anim-row-in ${isStriker ? 'striker-row' : isActive ? 'bg-white/3' : ''}`}
                                    style={{ animationDelay: `${i * 0.04}s` }}>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`font-semibold leading-tight ${isActive ? 'text-white' : 'text-gray-300'}`}>
                                                {b.name}
                                                {isStriker && <span className="text-[#F97316] font-black ml-1">*</span>}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">{dismissalLine(b.dismissal)}</div>
                                    </td>
                                    <td className="px-2 py-2.5 text-right font-black tabular-nums text-white">{b.runs}</td>
                                    <td className="px-2 py-2.5 text-right text-gray-500 tabular-nums text-xs">{b.ballsFaced}</td>
                                    <td className="px-2 py-2.5 text-right tabular-nums text-xs">
                                        <span className={b.fours > 0 ? 'text-blue-400 font-bold' : 'text-gray-600'}>{b.fours}</span>
                                    </td>
                                    <td className="px-2 py-2.5 text-right tabular-nums text-xs">
                                        <span className={b.sixes > 0 ? 'text-emerald-400 font-bold' : 'text-gray-600'}>{b.sixes}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums text-xs">{b.strikeRate.toFixed(1)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="px-4 py-2.5 bg-white/2 border-t border-white/8 text-[11px] text-gray-500 flex justify-between gap-4 flex-wrap">
                <span>
                    Extras: <b className="text-gray-400">{innings.totals.extras.total}</b>
                    <span className="text-gray-600"> (wd {innings.totals.extras.wides} · nb {innings.totals.extras.noBalls} · b {innings.totals.extras.byes} · lb {innings.totals.extras.legByes})</span>
                </span>
                <span>
                    Total: <b className="text-white font-black score-hero">{innings.totals.runs}/{innings.totals.wickets}</b>
                    <span className="text-gray-500 ml-1">({innings.totals.overs} ov)</span>
                </span>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// BOWLING CARD
// ═══════════════════════════════════════════════════════════════════════════

function BowlingCard({ title, innings, currentBowlerId, brands }: {
    title: string; innings: InningsScorecard | null; currentBowlerId?: string; brands?: TeamBrandMap;
}) {
    if (!innings || innings.bowlingCard.length === 0) return null;

    return (
        <section className="anim-fadeup card-ipl overflow-hidden" style={{ animationDelay: '.3s' }}>
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8">
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <TeamLogo brand={brands?.[innings.bowlingTeamId]} size={22} />
                    {title}
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-[9px] uppercase tracking-widest text-gray-600">
                            <th className="text-left px-4 py-2.5 font-bold">Bowler</th>
                            <th className="text-right px-2 py-2.5 font-bold">O</th>
                            <th className="text-right px-2 py-2.5 font-bold">M</th>
                            <th className="text-right px-2 py-2.5 font-bold">R</th>
                            <th className="text-right px-2 py-2.5 font-bold">W</th>
                            <th className="text-right px-4 py-2.5 font-bold">Econ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {innings.bowlingCard.map((b, i) => {
                            const isActive = b.registrationId === currentBowlerId;
                            return (
                                <tr key={b.registrationId}
                                    className={`border-t border-white/5 anim-row-in ${isActive ? 'active-bowler-row' : ''}`}
                                    style={{ animationDelay: `${i * 0.04}s` }}>
                                    <td className="px-4 py-2.5 font-semibold">
                                        <span className={isActive ? 'text-white' : 'text-gray-300'}>
                                            {b.name}{isActive && <span className="text-blue-400 font-black ml-1">*</span>}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2.5 text-right text-gray-400 tabular-nums text-xs">{b.overs}</td>
                                    <td className="px-2 py-2.5 text-right text-gray-500 tabular-nums text-xs">{b.maidens}</td>
                                    <td className="px-2 py-2.5 text-right text-gray-400 tabular-nums text-xs">{b.runs}</td>
                                    <td className="px-2 py-2.5 text-right font-black tabular-nums">
                                        <span className={b.wickets > 0 ? 'text-red-400' : 'text-gray-500'}>{b.wickets}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums text-xs">{b.economy.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// LINEUPS CARD
// ═══════════════════════════════════════════════════════════════════════════

function LineupsCard({ match }: { match: any }) {
    const setup = match?.cricketSetup;
    if (!setup?.team1Lineup?.lineupSet && !setup?.team2Lineup?.lineupSet) return null;

    const renderXI = (lineup: any, teamName: string) => {
        if (!lineup?.lineupSet) return null;
        const xi: { name: string }[] = lineup.startingXI || [];
        const reserves: { name: string }[] = lineup.reserves || [];
        return (
            <div className="flex flex-col gap-2 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-[#f59e0b] font-bold">{teamName}</div>
                <ol className="list-none text-sm text-gray-300 space-y-1.5">
                    {xi.map((p, i) => (
                        <li key={`xi-${i}`} className="flex items-center gap-2.5">
                            <span className="text-[10px] font-bold text-gray-600 w-4 text-right shrink-0">{i + 1}</span>
                            <span className="font-medium">{p.name}</span>
                        </li>
                    ))}
                </ol>
                {reserves.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/8">
                        <div className="text-[10px] uppercase tracking-widest text-gray-600 font-bold mb-1.5">Reserves</div>
                        <ul className="text-xs text-gray-500 space-y-1">
                            {reserves.map((p, i) => <li key={`r-${i}`}>{p.name}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    return (
        <section className="anim-fadeup card-ipl p-4" style={{ animationDelay: '.35s' }}>
            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-4">Lineups</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {renderXI(setup.team1Lineup, match?.teams?.team1Name || 'Team 1')}
                {renderXI(setup.team2Lineup, match?.teams?.team2Name || 'Team 2')}
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// FALL OF WICKETS
// ═══════════════════════════════════════════════════════════════════════════

function FallOfWicketsCard({ innings, titleSuffix = '' }: { innings: InningsScorecard | null; titleSuffix?: string }) {
    if (!innings || innings.fallOfWickets.length === 0) return null;
    return (
        <section className="anim-fadeup card-ipl overflow-hidden">
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 flex items-center justify-between">
                <span className="text-sm font-bold text-white">Fall of Wickets{titleSuffix}</span>
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{innings.fallOfWickets.length} {innings.fallOfWickets.length === 1 ? 'wicket' : 'wickets'}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-[9px] uppercase tracking-widest text-gray-600">
                            <th className="text-left  px-4 py-2 font-bold">#</th>
                            <th className="text-left  px-2 py-2 font-bold">Batter</th>
                            <th className="text-left  px-2 py-2 font-bold">Score</th>
                            <th className="text-left  px-2 py-2 font-bold">Overs</th>
                            <th className="text-right px-4 py-2 font-bold">Stand</th>
                        </tr>
                    </thead>
                    <tbody>
                        {innings.fallOfWickets.map((f, i) => (
                            <tr key={f.wicketNumber} className="border-t border-white/5 anim-row-in" style={{ animationDelay: `${i * 0.04}s` }}>
                                <td className="px-4 py-2.5 text-gray-500 font-bold tabular-nums">{f.wicketNumber}</td>
                                <td className="px-2 py-2.5">
                                    <div className="font-semibold text-gray-200">{f.batterName}</div>
                                    <div className="text-[10px] text-gray-600 mt-0.5">{f.dismissalLine}</div>
                                </td>
                                <td className="px-2 py-2.5">
                                    <span className="font-black text-white tabular-nums">{f.score}</span>
                                    <span className="text-gray-600 ml-1">/{f.wicketNumber}</span>
                                </td>
                                <td className="px-2 py-2.5 text-gray-400 tabular-nums">{f.overs}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                    <span className="text-gray-300 font-semibold">{f.partnershipRuns}</span>
                                    <span className="text-gray-600 text-[10px] ml-1">({f.partnershipBalls})</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTNERSHIPS — bar chart + table
// ═══════════════════════════════════════════════════════════════════════════

function PartnershipsCard({ innings, titleSuffix = '' }: { innings: InningsScorecard | null; titleSuffix?: string }) {
    if (!innings || innings.partnerships.length === 0) return null;
    const peak = Math.max(1, ...innings.partnerships.map(p => p.runs));
    return (
        <section className="anim-fadeup card-ipl overflow-hidden">
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 flex items-center justify-between">
                <span className="text-sm font-bold text-white">Partnerships{titleSuffix}</span>
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Peak {peak}</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
                {innings.partnerships.map((p, i) => {
                    const pct = (p.runs / peak) * 100;
                    const sr = p.balls > 0 ? Math.round((p.runs / p.balls) * 1000) / 10 : 0;
                    return (
                        <div key={`${p.wicketNumber}-${p.batter1Id}-${p.batter2Id}`} className="anim-row-in flex flex-col gap-1.5" style={{ animationDelay: `${i * 0.04}s` }}>
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                                <div className="min-w-0 truncate">
                                    <span className="text-gray-500 font-bold tabular-nums mr-2">{p.wicketNumber}.</span>
                                    <span className="text-gray-200 font-semibold">{p.batter1Name}</span>
                                    <span className="text-gray-600 mx-1">&amp;</span>
                                    <span className="text-gray-200 font-semibold">{p.batter2Name}</span>
                                    {p.unbroken && <span className="ml-2 text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Unbroken</span>}
                                </div>
                                <div className="shrink-0 tabular-nums">
                                    <span className="font-black text-white">{p.runs}</span>
                                    <span className="text-gray-500"> ({p.balls})</span>
                                    <span className="text-gray-600 ml-2 text-[10px]">SR {sr.toFixed(1)}</span>
                                </div>
                            </div>
                            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, background: p.unbroken
                                        ? 'linear-gradient(to right, rgba(16,185,129,.55), rgba(52,211,153,.85))'
                                        : 'linear-gradient(to right, rgba(249,115,22,.55), rgba(245,158,11,.85))' }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// WORM CHART — cumulative-runs line per innings
// ═══════════════════════════════════════════════════════════════════════════

function WormChart({ innings1, innings2, maxOvers, team1Name, team2Name }: {
    innings1: InningsScorecard | null; innings2: InningsScorecard | null;
    maxOvers?: number; team1Name: string; team2Name: string;
}) {
    const series: Array<{ inn: InningsScorecard; color: string; teamName: string; label: string }> = [];
    if (innings1) series.push({ inn: innings1, color: '#F97316', teamName: innings1.battingTeamName, label: 'Innings 1' });
    if (innings2) series.push({ inn: innings2, color: '#60a5fa', teamName: innings2.battingTeamName, label: 'Innings 2' });
    if (series.length === 0) return null;

    // SVG geometry
    const W = 800, H = 280, PAD_L = 40, PAD_R = 16, PAD_T = 16, PAD_B = 32;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;

    const lastOverBowled = Math.max(0, ...series.flatMap(s => s.inn.oversTimeline.map(o => o.overNumber)));
    const maxX = maxOvers ?? Math.max(1, lastOverBowled);
    // Cumulative series + max Y
    const computed = series.map(s => {
        let cum = 0;
        const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];
        s.inn.oversTimeline.forEach(o => {
            cum += o.runs;
            points.push({ x: o.overNumber, y: cum });
        });
        return { ...s, points, finalRuns: cum };
    });
    const maxY = Math.max(1, ...computed.map(c => c.finalRuns));

    const x = (xv: number) => PAD_L + (xv / maxX) * innerW;
    const y = (yv: number) => PAD_T + innerH - (yv / maxY) * innerH;
    const pathFor = (pts: { x: number; y: number }[]) =>
        pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ');

    // axis ticks: every ~5 overs for X, ~50 runs for Y
    const xTickStep = maxX <= 10 ? 2 : maxX <= 25 ? 5 : 10;
    const xTicks: number[] = [];
    for (let i = 0; i <= maxX; i += xTickStep) xTicks.push(i);
    if (xTicks[xTicks.length - 1] !== maxX) xTicks.push(maxX);

    const yTickStep = maxY <= 60 ? 10 : maxY <= 150 ? 25 : 50;
    const yTicks: number[] = [];
    for (let i = 0; i <= maxY; i += yTickStep) yTicks.push(i);

    return (
        <section className="anim-fadeup card-ipl overflow-hidden">
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-white">Worm — Cumulative Runs</span>
                <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold">
                    {computed.map(c => (
                        <span key={c.label} className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm" style={{ background: c.color }} />
                            <span className="text-gray-300">{c.teamName}</span>
                            <span className="text-gray-500 tabular-nums">{c.finalRuns}</span>
                        </span>
                    ))}
                </div>
            </div>
            <div className="p-4 overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                    {/* grid */}
                    {yTicks.map(v => (
                        <g key={`y-${v}`}>
                            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.06)" strokeWidth={1} />
                            <text x={PAD_L - 6} y={y(v) + 3} fill="rgba(156,163,175,.7)" fontSize={9} textAnchor="end" fontFamily="ui-monospace,monospace">{v}</text>
                        </g>
                    ))}
                    {xTicks.map(v => (
                        <g key={`x-${v}`}>
                            <line x1={x(v)} x2={x(v)} y1={PAD_T} y2={PAD_T + innerH} stroke="rgba(255,255,255,.04)" strokeWidth={1} />
                            <text x={x(v)} y={PAD_T + innerH + 14} fill="rgba(156,163,175,.7)" fontSize={9} textAnchor="middle" fontFamily="ui-monospace,monospace">{v}</text>
                        </g>
                    ))}

                    {/* lines */}
                    {computed.map(c => (
                        <g key={c.label}>
                            <path d={pathFor(c.points)} fill="none" stroke={c.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                            {c.points.map((p, i) => (
                                <circle key={i} cx={x(p.x)} cy={y(p.y)} r={3} fill={c.color} opacity={0.9} />
                            ))}
                        </g>
                    ))}

                    {/* axis labels */}
                    <text x={(PAD_L + W - PAD_R) / 2} y={H - 4} fill="rgba(107,114,128,.8)" fontSize={9} textAnchor="middle" fontFamily="ui-monospace,monospace">overs</text>
                </svg>
                <p className="text-[10px] text-gray-600 mt-1 text-center uppercase tracking-widest font-bold">
                    {team1Name} vs {team2Name} · cumulative runs by over end
                </p>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAGON WHEEL — placeholder (needs shot-direction capture in scorer)
// ═══════════════════════════════════════════════════════════════════════════

function WagonWheelPlaceholder() {
    return (
        <section className="anim-fadeup card-ipl overflow-hidden">
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 flex items-center justify-between">
                <span className="text-sm font-bold text-white">Wagon Wheel</span>
                <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Coming soon</span>
            </div>
            <div className="p-6 flex flex-col items-center gap-4 text-center">
                <svg viewBox="0 0 200 200" className="w-40 h-40 opacity-30">
                    <circle cx="100" cy="100" r="92" fill="rgba(16,185,129,.06)" stroke="rgba(16,185,129,.4)" strokeWidth="1.5" />
                    <circle cx="100" cy="100" r="58" fill="none" stroke="rgba(16,185,129,.25)" strokeWidth="1" strokeDasharray="3 3" />
                    <circle cx="100" cy="100" r="3" fill="#f59e0b" />
                    {/* dotted radial guides */}
                    {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
                        const rad = (angle * Math.PI) / 180;
                        const x2 = 100 + 92 * Math.cos(rad);
                        const y2 = 100 + 92 * Math.sin(rad);
                        return <line key={angle} x1="100" y1="100" x2={x2} y2={y2} stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray="2 4" />;
                    })}
                </svg>
                <div className="max-w-md text-xs text-gray-400 leading-relaxed">
                    Wagon wheel requires shot-direction to be captured for every ball during scoring.
                    The current ball-entry pad doesn't capture direction yet — extending it to record
                    where each shot was played to will populate this chart automatically.
                </div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════

function computeDistribution(innings: InningsScorecard | null) {
    if (!innings) return null;
    const counts = { dots: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0, wickets: 0, extras: 0 };
    let totalBalls = 0;
    innings.oversTimeline.forEach(over => over.balls.forEach(b => {
        totalBalls++;
        if (b.isWicket) counts.wickets++;
        else if (b.label === '0') counts.dots++;
        else if (b.label === '1') counts.ones++;
        else if (b.label === '2') counts.twos++;
        else if (b.label === '3') counts.threes++;
        else if (b.label === '4') counts.fours++;
        else if (b.label === '6') counts.sixes++;
        else counts.extras++;
    }));
    return { ...counts, totalBalls };
}

function RunDistributionCard({ innings }: { innings: InningsScorecard | null }) {
    const dist = computeDistribution(innings);
    if (!dist || dist.totalBalls === 0) return null;
    const rows: { label: string; count: number; gradient: string; emphasize?: boolean }[] = [
        { label: 'Dots',    count: dist.dots,    gradient: 'linear-gradient(to right, rgba(255,255,255,.15), rgba(255,255,255,.25))' },
        { label: 'Singles', count: dist.ones,    gradient: 'linear-gradient(to right, rgba(59,130,246,.3), rgba(59,130,246,.55))' },
        { label: 'Twos',    count: dist.twos,    gradient: 'linear-gradient(to right, rgba(59,130,246,.4), rgba(96,165,250,.65))' },
        { label: 'Threes',  count: dist.threes,  gradient: 'linear-gradient(to right, rgba(99,102,241,.5), rgba(147,197,253,.65))' },
        { label: 'Fours',   count: dist.fours,   gradient: 'linear-gradient(to right, rgba(59,130,246,.6), rgba(147,197,253,.85))', emphasize: true },
        { label: 'Sixes',   count: dist.sixes,   gradient: 'linear-gradient(to right, rgba(16,185,129,.6), rgba(52,211,153,.85))', emphasize: true },
        { label: 'Wickets', count: dist.wickets, gradient: 'linear-gradient(to right, rgba(239,68,68,.55), rgba(252,165,165,.85))' },
        { label: 'Extras',  count: dist.extras,  gradient: 'linear-gradient(to right, rgba(245,158,11,.45), rgba(253,224,71,.7))' },
    ];
    const max = Math.max(1, ...rows.map(r => r.count));

    return (
        <section className="anim-fadeup card-ipl overflow-hidden">
            <div className="px-4 py-2.5 bg-white/3 border-b border-white/8 flex items-center justify-between">
                <span className="text-sm font-bold text-white">Run Distribution</span>
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{dist.totalBalls} balls</span>
            </div>
            <div className="p-5 flex flex-col gap-3">
                {rows.map((r, i) => {
                    const widthPct = (r.count / max) * 100;
                    const sharePct = dist.totalBalls > 0 ? (r.count / dist.totalBalls) * 100 : 0;
                    return (
                        <div key={r.label} className="flex items-center gap-3 anim-row-in" style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className="w-20 shrink-0 text-xs text-gray-400 font-bold uppercase tracking-wider">{r.label}</div>
                            <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${widthPct}%`, background: r.gradient }}
                                />
                            </div>
                            <div className="shrink-0 w-20 text-right">
                                <span className={`tabular-nums font-black ${r.emphasize ? 'text-white' : 'text-gray-300'}`}>{r.count}</span>
                                <span className="text-gray-600 ml-1 text-[10px]">{sharePct.toFixed(0)}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// BROADCAST HERO SLIDE — full-screen live score + at the crease
// ═══════════════════════════════════════════════════════════════════════════

function BroadcastHeroSlide({ match, live, scorecard, currentInnings, team1Name, team2Name, brands }: {
    match: any; live: any; scorecard: Scorecard | null;
    currentInnings: 1 | 2; team1Name: string; team2Name: string; brands: TeamBrandMap;
}) {
    const names = buildPlayerNameMap(match);
    const curr: InningsScorecard | null | undefined = currentInnings === 2 ? scorecard?.innings2 : scorecard?.innings1;
    const inn1 = scorecard?.innings1;
    const maxOvers = match?.matchConfig?.maxOvers ?? 20;
    const runs = live?.runs ?? 0;
    const wickets = live?.wickets ?? 0;
    const target = live?.target;
    const completedOvers = live?.completedOvers ?? 0;
    const ballsInOver = live?.ballsInCurrentOver ?? 0;
    const ballsUsed = completedOvers * 6 + ballsInOver;
    const ballsLeft = maxOvers * 6 - ballsUsed;
    const progressPct = Math.min(100, (completedOvers / maxOvers) * 100);
    const runsToWin = target != null ? Math.max(0, target - runs) : null;
    const crr = ballsUsed > 0 ? (runs * 6 / ballsUsed) : 0;
    const rrr = (target != null && ballsLeft > 0) ? Math.max(0, (target - runs) * 6 / ballsLeft) : null;
    const rrrHigh = rrr != null && crr > 0 && rrr > crr * 1.3;

    const team1Id = match?.teams?.team1Id ? String(match.teams.team1Id) : '';
    const team2Id = match?.teams?.team2Id ? String(match.teams.team2Id) : '';
    const battingIsTeam1 = !live?.battingTeamId || String(live.battingTeamId) === team1Id;
    const battingTeam = battingIsTeam1 ? team1Name : team2Name;
    const battingTeamId = battingIsTeam1 ? team1Id : team2Id;

    const currentOverData = curr?.oversTimeline?.find((o: OverSummary) => o.overNumber === completedOvers + 1);
    const currentOverBalls: BallSummary[] = currentOverData?.balls ?? [];
    const partnership = curr?.currentPartnership ?? null;
    const strikerCard = curr?.battingCard.find(b => b.registrationId === live?.strikerId);
    const nonStrikerCard = curr?.battingCard.find(b => b.registrationId === live?.nonStrikerId);
    const bowlerCard = curr?.bowlingCard.find(b => b.registrationId === live?.currentBowlerId);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_460px] gap-4">
            {/* Left: score + this over + run rates */}
            <div className="flex flex-col gap-4">
                <div className="card-ipl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0a1f3c 0%,#091428 60%,#0e1a2e 100%)' }}>
                    <div className="h-0.5 w-full bg-linear-to-r from-transparent via-[#f59e0b] to-transparent" />
                    <div className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                                <div className="flex items-center gap-2.5 mb-1.5">
                                    <TeamLogo brand={brands[battingTeamId]} size={48} />
                                    <div className="text-[10px] uppercase tracking-[.2em] text-gray-500 font-bold">
                                        {battingTeam} · Innings {currentInnings}
                                    </div>
                                </div>
                                <div className="score-hero font-black text-white leading-none tabular-nums" style={{ fontSize: '5.5rem' }}>
                                    {runs}<span className="text-[#f59e0b]">/</span><span style={{ fontSize: '3.2rem' }}>{wickets}</span>
                                </div>
                                <div className="text-lg text-gray-300 font-semibold mt-2 tabular-nums">
                                    {oversDisplay(live)} <span className="text-gray-500 font-normal text-base">overs</span>
                                </div>
                            </div>
                            {runsToWin != null ? (
                                <div className="text-right shrink-0">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Target</div>
                                    <div className="score-hero text-5xl font-black text-white tabular-nums mt-1 leading-none">{target}</div>
                                    <div className="text-lg font-black text-[#F97316] mt-1.5">Need {runsToWin}</div>
                                    <div className="text-sm text-gray-500 mt-0.5">in {ballsLeft} balls</div>
                                </div>
                            ) : inn1 && currentInnings === 2 ? (
                                <div className="text-right shrink-0">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">1st Innings</div>
                                    <div className="score-hero text-4xl font-black text-gray-400 tabular-nums mt-1 leading-none">{inn1.totals.runs}/{inn1.totals.wickets}</div>
                                    <div className="text-sm text-gray-500 mt-0.5">{inn1.totals.overs} ov</div>
                                </div>
                            ) : null}
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden mb-2">
                            <div className="h-full rounded-full bg-linear-to-r from-[#f59e0b] to-[#F97316]" style={{ width: `${progressPct}%`, transition: 'width .7s' }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 font-semibold">
                            <span>{ballsInOver}/6 balls this over</span>
                            <span>{ballsLeft} balls remaining</span>
                        </div>
                    </div>
                    <div className="h-px w-full bg-linear-to-r from-transparent via-[#f59e0b]/30 to-transparent" />
                </div>

                {/* Current over balls */}
                <div className="card-ipl px-5 py-4">
                    <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3">This Over</div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {currentOverBalls.map((b, i) => (
                            <span key={i} className={`anim-ball-pop px-3 min-w-10 text-center text-base font-black rounded-xl border-2 py-2 ${ballClass(b)}`}
                                style={{ animationDelay: `${i * 0.04}s` }}>
                                {b.label}
                            </span>
                        ))}
                        {Array.from({ length: Math.max(0, 6 - currentOverBalls.length) }).map((_, i) => (
                            <span key={`ph-${i}`} className="px-3 min-w-10 text-center text-base font-black rounded-xl border-2 py-2 ball-dot" style={{ opacity: 0.2 }}>·</span>
                        ))}
                    </div>
                </div>

                {/* Run rates */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="card-ipl p-5">
                        <div className="text-xs uppercase tracking-widest text-gray-400 font-bold">Current RR</div>
                        <div className="score-hero text-5xl font-black text-white mt-2 tabular-nums leading-none">{crr.toFixed(2)}</div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-linear-to-r from-[#f59e0b] to-[#F97316]" style={{ width: `${Math.min(100, crr * 5)}%` }} />
                        </div>
                    </div>
                    <div className={`card-ipl p-5 ${rrrHigh ? 'card-gold-border' : ''}`}>
                        <div className="text-xs uppercase tracking-widest text-gray-400 font-bold">Required RR</div>
                        <div className={`score-hero text-5xl font-black mt-2 tabular-nums leading-none ${rrrHigh ? 'text-[#f59e0b]' : 'text-white'}`}>
                            {rrr != null ? rrr.toFixed(2) : '—'}
                        </div>
                        {rrr != null && (
                            <div className="mt-3 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                                <div className={`h-full rounded-full ${rrrHigh ? 'bg-linear-to-r from-red-500 to-[#f59e0b]' : 'bg-linear-to-r from-emerald-500 to-[#f59e0b]'}`} style={{ width: `${Math.min(100, rrr * 5)}%` }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: at the crease + partnership + extras */}
            <div className="flex flex-col gap-4">
                <div className="card-ipl overflow-hidden">
                    <div className="px-5 py-3.5 bg-white/3 border-b border-white/8 text-xs font-bold uppercase tracking-widest text-gray-400">At the Crease</div>
                    <div className="p-4 flex flex-col gap-3">
                        {/* Striker */}
                        <div className="striker-row rounded-xl p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[#F97316] font-black text-xl shrink-0">★</span>
                                <div className="min-w-0">
                                    <div className="font-bold text-white text-base leading-tight truncate">{nameOf(names, live?.strikerId)}</div>
                                    <div className="text-xs text-[#F97316] font-bold mt-0.5">On strike</div>
                                </div>
                            </div>
                            {strikerCard && (
                                <div className="text-right shrink-0">
                                    <div className="score-hero text-3xl font-black text-white tabular-nums leading-none">
                                        {strikerCard.runs}<span className="text-base text-gray-400 font-normal">({strikerCard.ballsFaced})</span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        {strikerCard.fours > 0 && <span className="text-blue-400 mr-2 font-bold">{strikerCard.fours}×4</span>}
                                        {strikerCard.sixes > 0 && <span className="text-emerald-400 font-bold">{strikerCard.sixes}×6</span>}
                                        <span className="text-gray-500 ml-1">SR {strikerCard.strikeRate.toFixed(0)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Non-striker */}
                        <div className="bg-white/3 rounded-xl p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-gray-500 font-black text-xl shrink-0">◦</span>
                                <div className="min-w-0">
                                    <div className="font-semibold text-gray-300 text-base leading-tight truncate">{nameOf(names, live?.nonStrikerId)}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">Non-striker</div>
                                </div>
                            </div>
                            {nonStrikerCard && (
                                <div className="score-hero text-2xl font-black text-gray-400 tabular-nums shrink-0 leading-none">
                                    {nonStrikerCard.runs}<span className="text-sm font-normal">({nonStrikerCard.ballsFaced})</span>
                                </div>
                            )}
                        </div>
                        <div className="border-t border-white/5" />
                        {/* Bowler */}
                        <div className="active-bowler-row rounded-xl p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-blue-400 font-black text-xl shrink-0">↗</span>
                                <div className="min-w-0">
                                    <div className="font-bold text-white text-base leading-tight truncate">{nameOf(names, live?.currentBowlerId)}</div>
                                    <div className="text-xs text-blue-400 font-bold mt-0.5">Bowling</div>
                                </div>
                            </div>
                            {bowlerCard && (
                                <div className="text-right shrink-0">
                                    <div className="text-sm font-black text-blue-300 tabular-nums">{bowlerCard.overs}-{bowlerCard.maidens}-{bowlerCard.runs}-{bowlerCard.wickets}W</div>
                                    <div className="text-xs text-gray-500 mt-0.5">Econ {bowlerCard.economy.toFixed(2)}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Partnership */}
                {partnership && partnership.balls > 0 && (
                    <div className="card-ipl overflow-hidden">
                        <div className="px-5 py-3.5 bg-white/3 border-b border-white/8 text-xs font-bold uppercase tracking-widest text-gray-400">Partnership</div>
                        <div className="p-4 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm text-gray-200 min-w-0 truncate">
                                    <b className="text-white">{partnership.strikerName}</b>
                                    <span className="text-gray-500 mx-1">&amp;</span>
                                    <b className="text-white">{partnership.nonStrikerName}</b>
                                </div>
                                <div className="score-hero text-3xl font-black text-white tabular-nums shrink-0 leading-none">
                                    {partnership.runs}<span className="text-base text-gray-400 font-normal"> ({partnership.balls})</span>
                                </div>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full bg-linear-to-r from-[#F97316] to-[#f59e0b]"
                                    style={{ width: `${Math.min(100, (partnership.runs / 80) * 100)}%`, transition: 'width .7s' }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Extras */}
                {live?.extras && (
                    <div className="card-ipl px-5 py-4">
                        <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3">Extras</div>
                        <div className="grid grid-cols-4 gap-2">
                            {([
                                { label: 'Wide',    val: live.extras.wides   ?? 0, col: 'text-amber-400' },
                                { label: 'No-ball', val: live.extras.noBalls  ?? 0, col: 'text-amber-400' },
                                { label: 'Bye',     val: live.extras.byes     ?? 0, col: 'text-sky-400'   },
                                { label: 'Leg-bye', val: live.extras.legByes  ?? 0, col: 'text-sky-400'   },
                            ] as const).map(e => (
                                <div key={e.label} className="text-center rounded-xl py-3 bg-white/3">
                                    <div className={`score-hero text-2xl font-black tabular-nums leading-none ${e.val > 0 ? e.col : 'text-gray-700'}`}>{e.val}</div>
                                    <div className="text-[9px] text-gray-600 uppercase tracking-widest font-bold mt-1.5">{e.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MATCH SUMMARY SLIDE — shown in place of the live hero once the match is over
// ═══════════════════════════════════════════════════════════════════════════

function computeMatchSummary(scorecard: Scorecard | null) {
    const innings = [scorecard?.innings1, scorecard?.innings2].filter(Boolean) as InningsScorecard[];
    if (innings.length === 0) return null;

    // Highest run-scorer across both innings — tie-break: fewer balls faced.
    let topBat: (BatterEntry & { teamName: string }) | null = null;
    // Highest wicket-taker — tie-break: fewer runs conceded.
    let topBowl: (BowlerEntry & { teamName: string }) | null = null;
    // Biggest partnership.
    let bestPartnership: (PartnershipRecord & { teamName: string }) | null = null;

    for (const inn of innings) {
        for (const b of inn.battingCard) {
            if (!topBat || b.runs > topBat.runs || (b.runs === topBat.runs && b.ballsFaced < topBat.ballsFaced)) {
                topBat = { ...b, teamName: inn.battingTeamName };
            }
        }
        for (const bw of inn.bowlingCard) {
            if (!topBowl || bw.wickets > topBowl.wickets || (bw.wickets === topBowl.wickets && bw.runs < topBowl.runs)) {
                topBowl = { ...bw, teamName: inn.bowlingTeamName };
            }
        }
        for (const p of inn.partnerships) {
            if (!bestPartnership || p.runs > bestPartnership.runs) {
                bestPartnership = { ...p, teamName: inn.battingTeamName };
            }
        }
    }
    return { innings, topBat, topBowl, bestPartnership };
}

function MatchSummarySlide({ match, scorecard, brands }: { match: any; scorecard: Scorecard | null; brands: TeamBrandMap }) {
    const summary = computeMatchSummary(scorecard);
    const team1Id = String(match?.teams?.team1Id);
    const team2Id = String(match?.teams?.team2Id);
    const team1Name = match?.teams?.team1Name || 'Team 1';
    const team2Name = match?.teams?.team2Name || 'Team 2';
    const winnerName = String(match?.winnerId) === team1Id ? team1Name
        : String(match?.winnerId) === team2Id ? team2Name : null;
    const margin = match?.result?.marginOfVictory;

    if (!summary) {
        return <div className="card-ipl p-10 text-center text-gray-400 font-bold">Match summary unavailable.</div>;
    }
    const { innings, topBat, topBowl, bestPartnership } = summary;

    return (
        <div className="flex flex-col gap-4">
            {/* Result banner */}
            <div className="card-ipl card-gold-border overflow-hidden">
                <div className="h-0.5 w-full bg-linear-to-r from-transparent via-[#f59e0b] to-transparent" />
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                    <Trophy className="h-10 w-10 text-[#f59e0b]" />
                    <div className="text-[10px] uppercase tracking-widest text-[#f59e0b] font-bold">Match Result</div>
                    <div className="score-hero text-4xl sm:text-5xl font-black text-white leading-none">
                        {winnerName ? `${winnerName} won` : 'Match complete'}
                    </div>
                    {margin && <div className="text-lg text-gray-300 font-semibold">{margin}</div>}

                    {/* Innings totals */}
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
                        {innings.map(inn => (
                            <div key={inn.inningsNumber} className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/3 border border-white/8">
                                <TeamLogo brand={brands[String(inn.battingTeamId)]} size={26} />
                                <div className="text-left">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{inn.battingTeamName}</div>
                                    <div className="score-hero text-xl font-black text-white tabular-nums leading-none">
                                        {inn.totals.runs}/{inn.totals.wickets}
                                        <span className="text-xs text-gray-400 font-normal ml-1">({inn.totals.overs})</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top performers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topBat && (
                    <div className="card-ipl p-5 flex flex-col gap-2">
                        <div className="text-[10px] uppercase tracking-widest text-[#f59e0b] font-bold">Top Scorer</div>
                        <div className="text-xl font-black text-white leading-tight">{topBat.name}</div>
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{topBat.teamName}</div>
                        <div className="score-hero text-4xl font-black text-white tabular-nums mt-1 leading-none">
                            {topBat.runs}<span className="text-lg text-gray-400 font-normal"> ({topBat.ballsFaced})</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            {topBat.fours > 0 && <span className="text-blue-400 font-bold mr-2">{topBat.fours}×4</span>}
                            {topBat.sixes > 0 && <span className="text-emerald-400 font-bold mr-2">{topBat.sixes}×6</span>}
                            <span className="text-gray-500">SR {topBat.strikeRate.toFixed(1)}</span>
                        </div>
                    </div>
                )}
                {topBowl && (
                    <div className="card-ipl p-5 flex flex-col gap-2">
                        <div className="text-[10px] uppercase tracking-widest text-[#60a5fa] font-bold">Top Wicket-Taker</div>
                        <div className="text-xl font-black text-white leading-tight">{topBowl.name}</div>
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{topBowl.teamName}</div>
                        <div className="score-hero text-4xl font-black text-white tabular-nums mt-1 leading-none">
                            {topBowl.wickets}<span className="text-lg text-gray-400 font-normal">/{topBowl.runs}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            <span className="text-gray-300 font-semibold">{topBowl.overs} ov</span>
                            <span className="text-gray-500 ml-2">Econ {topBowl.economy.toFixed(2)}</span>
                        </div>
                    </div>
                )}
                {bestPartnership && (
                    <div className="card-ipl p-5 flex flex-col gap-2">
                        <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Best Partnership</div>
                        <div className="text-base font-bold text-white leading-tight">
                            {bestPartnership.batter1Name} <span className="text-gray-500">&amp;</span> {bestPartnership.batter2Name}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{bestPartnership.teamName}</div>
                        <div className="score-hero text-4xl font-black text-white tabular-nums mt-1 leading-none">
                            {bestPartnership.runs}<span className="text-lg text-gray-400 font-normal"> ({bestPartnership.balls})</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">for the {bestPartnership.wicketNumber === 1 ? '1st' : bestPartnership.wicketNumber === 2 ? '2nd' : bestPartnership.wicketNumber === 3 ? '3rd' : `${bestPartnership.wicketNumber}th`} wicket</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// BROADCAST MODE — full-screen slideshow cycling through panels
// ═══════════════════════════════════════════════════════════════════════════

interface BroadcastSlide {
    id: string;
    title: string;
    duration: number; // ms
    node: React.ReactNode;
}

function BroadcastMode({
    match, live, scorecard, completed, currentInnings, brands, onExit,
}: {
    match: any; live: any; scorecard: Scorecard | null; completed: boolean;
    currentInnings: 1 | 2; brands: TeamBrandMap; onExit: () => void;
}) {
    const team1 = match?.teams?.team1Name || 'Team 1';
    const team2 = match?.teams?.team2Name || 'Team 2';
    const team1Id = match?.teams?.team1Id ? String(match.teams.team1Id) : '';
    const team2Id = match?.teams?.team2Id ? String(match.teams.team2Id) : '';

    // Build slides — current innings first; if match is completed, append the other innings too.
    const curr = currentInnings === 2 ? scorecard?.innings2 : scorecard?.innings1;
    const other = currentInnings === 2 ? scorecard?.innings1 : scorecard?.innings2;

    const slidesFor = (inn: InningsScorecard | null, label: string): BroadcastSlide[] => {
        if (!inn) return [];
        const tagSuffix = completed ? ` · ${label}` : '';
        return [
            { id: `bat-${inn.inningsNumber}`,   title: `Batting — ${inn.battingTeamName}${tagSuffix}`,  duration: 10000,
              node: <BattingCard title={`Batting — ${inn.battingTeamName}${tagSuffix}`} innings={inn} brands={brands}
                                 strikerId={inn === curr ? live?.strikerId : undefined}
                                 nonStrikerId={inn === curr ? live?.nonStrikerId : undefined} /> },
            { id: `bowl-${inn.inningsNumber}`,  title: `Bowling — ${inn.bowlingTeamName}${tagSuffix}`,  duration: 10000,
              node: <BowlingCard title={`Bowling — ${inn.bowlingTeamName}${tagSuffix}`} innings={inn} brands={brands}
                                 currentBowlerId={inn === curr ? live?.currentBowlerId : undefined} /> },
            { id: `manh-${inn.inningsNumber}`,  title: `Runs Per Over${tagSuffix}`,                    duration: 10000,
              node: <ManhattanChart innings={inn} maxOvers={match?.matchConfig?.maxOvers} large /> },
            { id: `overs-${inn.inningsNumber}`, title: `Recent Overs${tagSuffix}`,                     duration: 10000,
              node: <OversTimeline innings={inn} /> },
            { id: `dist-${inn.inningsNumber}`,  title: `Run Distribution${tagSuffix}`,                 duration: 15000,
              node: <RunDistributionCard innings={inn} /> },
        ];
    };

    const slides: BroadcastSlide[] = [
        // Lead slide: match summary once the game is over (live-only panels like
        // "at the crease" / "required RR" / "this over" make no sense), otherwise
        // the live score overview.
        ...(completed ? [{
            id: 'match-summary', title: 'Match Summary', duration: 14000,
            node: <MatchSummarySlide match={match} scorecard={scorecard} brands={brands} />,
        }] : live ? [{
            id: 'score-hero', title: 'Live Score', duration: 14000,
            node: <BroadcastHeroSlide match={match} live={live} scorecard={scorecard}
                      currentInnings={currentInnings} team1Name={team1} team2Name={team2} brands={brands} />,
        }] : []),
        ...slidesFor(curr ?? null, `Innings ${currentInnings}`),
        // Worm chart — its own slide; shows both innings on one canvas
        ...(scorecard?.innings1 || scorecard?.innings2 ? [{
            id: 'worm', title: 'Worm — Cumulative Runs', duration: 12000,
            node: <WormChart innings1={scorecard?.innings1 ?? null} innings2={scorecard?.innings2 ?? null}
                      maxOvers={match?.matchConfig?.maxOvers} team1Name={team1} team2Name={team2} />,
        }] : []),
        ...(completed ? slidesFor(other ?? null, `Innings ${currentInnings === 1 ? 2 : 1}`) : []),
    ];

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);

    // Reset index if slide list shrinks (e.g., scorecard cleared)
    useEffect(() => {
        if (slides.length === 0) setCurrentIndex(0);
        else if (currentIndex >= slides.length) setCurrentIndex(0);
    }, [slides.length, currentIndex]);

    // Auto-advance + progress bar
    useEffect(() => {
        if (isPaused || slides.length === 0) return;
        const slide = slides[currentIndex % slides.length];
        const startTime = Date.now();
        setProgress(0);
        const tick = setInterval(() => {
            const elapsed = Date.now() - startTime;
            setProgress(Math.min(100, (elapsed / slide.duration) * 100));
        }, 80);
        const advance = setTimeout(() => {
            setCurrentIndex(i => (i + 1) % slides.length);
        }, slide.duration);
        return () => { clearInterval(tick); clearTimeout(advance); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, isPaused, slides.length]);

    // Keyboard: Esc=exit, Space=pause, ←/→ skip
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape')          { e.preventDefault(); onExit(); }
            else if (e.key === ' ')          { e.preventDefault(); setIsPaused(p => !p); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); setCurrentIndex(i => (i + 1) % Math.max(1, slides.length)); }
            else if (e.key === 'ArrowLeft')  { e.preventDefault(); setCurrentIndex(i => (i - 1 + slides.length) % Math.max(1, slides.length)); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [slides.length, onExit]);

    if (slides.length === 0) {
        return (
            <div className="fixed inset-0 z-50 stadium-bg flex items-center justify-center px-6">
                <div className="text-center flex flex-col items-center gap-5 max-w-md">
                    <Tv className="h-12 w-12 text-gray-600" />
                    <p className="text-lg text-gray-300 font-bold">Nothing to broadcast yet</p>
                    <p className="text-sm text-gray-500">Wait until at least one ball has been bowled.</p>
                    <button onClick={onExit} className="mt-2 px-6 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold transition-colors">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    const slide = slides[currentIndex % slides.length];

    return (
        <div className="fixed inset-0 z-50 stadium-bg flex flex-col" role="dialog" aria-modal="true">
            {/* Score header */}
            <header className="px-4 sm:px-8 md:px-14 lg:px-20 py-3 border-b border-white/10 bg-[#050e1c]/90 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-300 truncate">
                        <TeamLogo brand={brands[team1Id]} size={26} />
                        {team1} <span className="text-[#f59e0b]">vs</span> {team2}
                        <TeamLogo brand={brands[team2Id]} size={26} />
                    </span>
                    {live && (
                        <span className="score-hero text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">
                            {live.runs ?? 0}<span className="text-[#f59e0b]">/</span>{live.wickets ?? 0}
                            <span className="text-base sm:text-lg text-gray-400 font-normal ml-2">{oversDisplay(live)} ov</span>
                        </span>
                    )}
                    {!completed && live?.target != null && (
                        <span className="text-sm font-bold text-[#F97316] tabular-nums hidden sm:block">
                            Need {Math.max(0, live.target - (live.runs ?? 0))} off {(match?.matchConfig?.maxOvers ?? 20) * 6 - (live.completedOvers ?? 0) * 6 - (live.ballsInCurrentOver ?? 0)} balls
                        </span>
                    )}
                </div>
                {completed ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-400 shrink-0">
                        <Trophy className="h-3 w-3" /> Full Time
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 live-badge rounded-full bg-red-500/10 border border-red-500/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-400 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        Broadcast
                    </span>
                )}
            </header>

            {/* Slide content — fades when slide changes via key */}
            <main className="flex-1 overflow-auto px-4 sm:px-8 md:px-14 lg:px-20 py-5">
                <div key={slide.id} className="anim-fadeup w-full">
                    <div className="mb-4 text-sm uppercase tracking-widest text-gray-400 font-bold">
                        {slide.title}
                    </div>
                    {slide.node}
                </div>
            </main>

            {/* Controls */}
            <footer className="px-4 sm:px-8 md:px-12 py-3 border-t border-white/10 bg-[#050e1c]/85 backdrop-blur-md flex items-center gap-3 sm:gap-4 shrink-0">
                {/* Slide indicators */}
                <div className="flex gap-1.5 shrink-0">
                    {slides.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => setCurrentIndex(i)}
                            className={`h-2 rounded-full transition-all ${i === currentIndex % slides.length ? 'w-8 bg-[#f59e0b]' : 'w-2 bg-white/15 hover:bg-white/30'}`}
                            title={s.title}
                        />
                    ))}
                </div>

                {/* Progress bar */}
                <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-linear-to-r from-[#F97316] to-[#f59e0b]"
                        style={{ width: `${progress}%`, transition: 'width .08s linear' }}
                    />
                </div>

                {/* Buttons */}
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={() => setIsPaused(p => !p)}
                        className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-colors"
                        title={isPaused ? 'Resume (space)' : 'Pause (space)'}
                    >
                        {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>
                    <button
                        onClick={() => setCurrentIndex(i => (i + 1) % slides.length)}
                        className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-colors"
                        title="Next slide (→)"
                    >
                        <SkipForward className="h-4 w-4" />
                    </button>
                    <button
                        onClick={onExit}
                        className="h-9 w-9 rounded-lg bg-white/5 hover:bg-red-500/15 hover:border-red-500/30 border border-white/10 text-white flex items-center justify-center transition-colors"
                        title="Exit broadcast (Esc)"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </footer>
        </div>
    );
}
