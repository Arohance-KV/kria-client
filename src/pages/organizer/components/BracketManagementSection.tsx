import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Loader2, Trophy, Swords, CheckCircle2, Shuffle, MousePointer2,
    RefreshCw, ChevronRight
} from 'lucide-react';
import API from '../../../api/axios';
import { sportRegistry } from '@/sports/registry';
import TeamLeagueBracketView from '@/sports/badminton/pages/organizer/teamLeague/TeamLeagueBracketView';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CategoryInfo { _id: string; name: string; status: string; bracketType?: string; sport?: string }

interface Match {
    _id: string;
    bracketRound: string;
    matchNumber: number;
    roundNumber?: number;
    positionInRound?: number;
    competitorType?: 'player' | 'team';
    teams: { team1Id: string; team2Id: string; team1Name: string; team2Name: string };
    player1?: { registrationId: string; name: string; teamId: string; teamName: string };
    player2?: { registrationId: string; name: string; teamId: string; teamName: string };
    status: string;
    winnerId?: string;
    winReason?: string;
    result?: { team1Total?: number; team2Total?: number; marginOfVictory?: string };
    nextMatchId?: string;
    nextMatchSlot?: string;
}

interface Props {
    tournamentId: string;
    sports: string[];
    categories: CategoryInfo[];
}

interface SwapSelection {
    matchId: string;
    slot: 'player1' | 'player2';
    name: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getC1(m: Match, ct: 'player' | 'team') {
    if (ct === 'player' && m.player1) return { id: m.player1.registrationId, name: m.player1.name, teamName: m.player1.teamName, isTBD: m.player1.registrationId === 'TBD' };
    return { id: m.teams?.team1Id || '', name: m.teams?.team1Name || 'TBD', teamName: '', isTBD: m.teams?.team1Name === 'TBD' };
}
function getC2(m: Match, ct: 'player' | 'team') {
    if (ct === 'player' && m.player2) return { id: m.player2.registrationId, name: m.player2.name, teamName: m.player2.teamName, isTBD: m.player2.registrationId === 'TBD' };
    return { id: m.teams?.team2Id || '', name: m.teams?.team2Name || 'TBD', teamName: '', isTBD: m.teams?.team2Name === 'TBD' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRACKET LAYOUT CONSTANTS & POSITION CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

const CARD_H = 215;  // fits header + 2 slots + Record Result button; score entry opens as a modal (not inline) so the card height never changes
const CARD_W = 340;
const CARD_GAP = 20;
const CONN_W = 44;
const S = CARD_H + CARD_GAP;

function computeCardPositions(visible: { name: string; matches: Match[] }[]): number[][] {
    if (visible.length === 0) return [];
    const positions: number[][] = [];
    positions[0] = visible[0].matches.map((_, ci) => ci * S);
    for (let ri = 1; ri < visible.length; ri++) {
        const prev = positions[ri - 1];
        const prevMatches = visible[ri - 1].matches;
        // Desired centre = midpoint of this match's VISIBLE sources; null when all its
        // sources are hidden (both fed by byes) — filled sequentially in the pass below.
        const desired = visible[ri].matches.map((match) => {
            const sources = prevMatches
                .map((m, prevCi) => ({ m, prevCi }))
                .filter(({ m }) => m.nextMatchId === match._id);
            if (sources.length === 0) return null;
            const avgCenterY =
                sources.reduce((sum, { prevCi }) => sum + prev[prevCi] + CARD_H / 2, 0) /
                sources.length;
            return avgCenterY - CARD_H / 2;
        });
        // Hiding byes compacts earlier rounds, so raw source-centres (and the index
        // fallback) can land closer than a card's height and overlap. Walk top-down
        // enforcing a minimum gap so cards in a round can never collide.
        const out: number[] = [];
        for (let ci = 0; ci < desired.length; ci++) {
            let top = desired[ci];
            if (top === null) top = ci === 0 ? 0 : out[ci - 1] + S;
            if (ci > 0) top = Math.max(top, out[ci - 1] + CARD_H + CARD_GAP);
            out[ci] = top;
        }
        positions[ri] = out;
    }
    return positions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const BracketManagementSection: React.FC<Props> = ({ tournamentId, sports, categories }) => {
    const [selectedCat, setSelectedCat] = useState<string>(categories[0]?._id || '');
    const [matches, setMatches] = useState<Match[]>([]);
    const [rounds, setRounds] = useState<Record<string, Match[]>>({});
    const [competitorType, setCompetitorType] = useState<'player' | 'team'>('player');
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isReshuffling, setIsReshuffling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Swap mode state
    const [swapMode, setSwapMode] = useState(false);
    const [swapSelection, setSwapSelection] = useState<SwapSelection | null>(null);
    const [isSwapping, setIsSwapping] = useState(false);

    const hasBracket = matches.length > 0;
    const hasResults = matches.some(m => m.status === 'completed');
    const eligibleCategories = categories.filter(c => !['draft'].includes(c.status));
    const selectedCategory = categories.find(c => c._id === selectedCat);
    const isTeamLeague = selectedCategory?.bracketType === 'team_league';
    // Use the selected category's own sport for its plugin; fall back to the
    // tournament's first sport only when no category is selected (empty state).
    const ResultSection = sportRegistry.get(selectedCategory?.sport || sports[0])?.matchResultSection;
    const canGenerate = !isTeamLeague && !hasBracket && eligibleCategories.some(c => c._id === selectedCat);

    const fetchMatches = useCallback(async () => {
        if (!selectedCat) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await API.get(`/matches/categories/${selectedCat}`);
            const payload = res.data?.data?.data || res.data?.data || {};
            setMatches(payload.matches || []);
            setRounds(payload.rounds || {});
            setCompetitorType(payload.competitorType || 'player');
        } catch {
            setMatches([]); setRounds({});
        } finally { setIsLoading(false); }
    }, [selectedCat]);

    useEffect(() => { fetchMatches(); }, [fetchMatches]);

    const handleGenerateBracket = async () => {
        setIsGenerating(true); setError(null);
        try {
            await API.post(`/matches/generate/${selectedCat}`);
            await fetchMatches();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to generate bracket.');
        } finally { setIsGenerating(false); }
    };

    const handleReshuffle = async () => {
        if (!window.confirm('Reshuffle will randomize all Round 1 assignments. Continue?')) return;
        setIsReshuffling(true); setError(null);
        try {
            await API.post(`/matches/reshuffle/${selectedCat}`);
            await fetchMatches();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to reshuffle.');
        } finally { setIsReshuffling(false); }
    };

    const handleSwapClick = (matchId: string, slot: 'player1' | 'player2', name: string) => {
        if (!swapMode) return;
        if (!swapSelection) {
            setSwapSelection({ matchId, slot, name });
        } else {
            // Execute swap
            if (swapSelection.matchId === matchId && swapSelection.slot === slot) {
                setSwapSelection(null); return; // Deselect
            }
            executeSwap(swapSelection.matchId, swapSelection.slot, matchId, slot);
        }
    };

    const executeSwap = async (mId1: string, s1: string, mId2: string, s2: string) => {
        setIsSwapping(true); setError(null);
        try {
            await API.put('/matches/swap', { matchId1: mId1, slot1: s1, matchId2: mId2, slot2: s2 });
            await fetchMatches();
            setSwapSelection(null);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Swap failed.');
        } finally { setIsSwapping(false); }
    };

    // Sort round names by roundNumber
    const sortedRoundNames = Object.keys(rounds).sort((a, b) => {
        const aM = rounds[a]?.[0]; const bM = rounds[b]?.[0];
        return ((aM as any)?.roundNumber || 0) - ((bM as any)?.roundNumber || 0);
    });

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Trophy className="h-5 w-5" /></div>
                <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Bracket Management</h2>
            </div>

            {/* Controls */}
            <div className="flex items-center flex-wrap gap-3">
                <select
                    value={selectedCat}
                    onChange={e => { setSelectedCat(e.target.value); setSwapMode(false); setSwapSelection(null); }}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-primary/30 text-white text-sm focus:outline-none focus:border-primary"
                >
                    {eligibleCategories.map(c => <option key={c._id} value={c._id} className="bg-[#111]">{c.name} ({c.status})</option>)}
                </select>

                {canGenerate && (
                    <button onClick={handleGenerateBracket} disabled={isGenerating} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm">
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                        Generate Bracket
                    </button>
                )}

                {!isTeamLeague && hasBracket && !hasResults && (
                    <>
                        <button onClick={handleReshuffle} disabled={isReshuffling} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold rounded-xl hover:bg-amber-500/20 transition-all disabled:opacity-50 text-sm">
                            {isReshuffling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                            Reshuffle
                        </button>
                        <button
                            onClick={() => { setSwapMode(!swapMode); setSwapSelection(null); }}
                            className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-all text-sm ${swapMode ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-400' : 'bg-white/5 border border-white/15 text-gray-300 hover:bg-white/10'}`}
                        >
                            <MousePointer2 className="h-4 w-4" />
                            {swapMode ? 'Exit Swap Mode' : 'Swap Players'}
                        </button>
                    </>
                )}
            </div>

            {/* Swap mode indicator */}
            {swapMode && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-sm">
                    <MousePointer2 className="h-4 w-4 text-cyan-400 shrink-0" />
                    {isSwapping ? (
                        <span className="text-cyan-300 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Swapping...</span>
                    ) : !swapSelection ? (
                        <span className="text-cyan-300">Click a player slot in any round to select it, then click another slot <strong>in the same round</strong> to swap.</span>
                    ) : (
                        <span className="text-cyan-300">
                            Selected: <strong className="text-cyan-100">{swapSelection.name}</strong> — now click another slot to swap.
                            <button onClick={() => setSwapSelection(null)} className="ml-2 text-cyan-500 hover:text-cyan-300 underline">Cancel</button>
                        </span>
                    )}
                </div>
            )}

            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl">{error}</div>}

            {/* Team League: render the dedicated read-only view instead of a knockout tree */}
            {isTeamLeague ? (
                <>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15 text-sm text-gray-400">
                        <Trophy className="h-4 w-4 text-primary shrink-0" />
                        <span>This is a Team League category. Groups, ties and lineups are managed in the <strong className="text-gray-200">Team League</strong> tab — below is a read-only overview.</span>
                    </div>
                    <TeamLeagueBracketView categoryId={selectedCat} />
                </>
            ) : /* Bracket tree */ isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !hasBracket ? (
                <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center text-gray-500 flex flex-col items-center gap-3">
                    <Trophy className="h-10 w-10 opacity-30" />
                    <p>No bracket generated yet.</p>
                    {canGenerate && <p className="text-sm text-gray-600">Click "Generate Bracket" above.</p>}
                </div>
            ) : (
                <BracketKnockoutView
                    sortedRoundNames={sortedRoundNames}
                    rounds={rounds}
                    competitorType={competitorType}
                    swapMode={swapMode}
                    swapSelection={swapSelection}
                    onSwapClick={handleSwapClick}
                    ResultSection={ResultSection}
                    onRecorded={fetchMatches}
                />
            )}
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BRACKET KNOCKOUT VIEW — SVG connector tree (organizer)
// ═══════════════════════════════════════════════════════════════════════════════

const BracketKnockoutView: React.FC<{
    sortedRoundNames: string[];
    rounds: Record<string, Match[]>;
    competitorType: 'player' | 'team';
    swapMode: boolean;
    swapSelection: SwapSelection | null;
    onSwapClick: (matchId: string, slot: 'player1' | 'player2', name: string) => void;
    ResultSection?: React.ComponentType<{ match: any; competitorType: 'player' | 'team'; onRecorded: () => void }>;
    onRecorded: () => void;
}> = ({ sortedRoundNames, rounds, competitorType, swapMode, swapSelection, onSwapClick, ResultSection, onRecorded }) => {

    const visible = sortedRoundNames
        .map(name => ({
            name,
            matches: (rounds[name] || [])
                .filter(m => swapMode ? true : !(m.status === 'walkover' && m.winReason === 'bye'))
                .sort((a, b) => (a.positionInRound ?? a.matchNumber) - (b.positionInRound ?? b.matchNumber)),
        }))
        .filter(r => r.matches.length > 0);

    if (visible.length === 0) return null;

    const cardPos = computeCardPositions(visible);
    const bHeight = cardPos.reduce((maxH, rPos) => {
        if (rPos.length === 0) return maxH;
        return Math.max(maxH, Math.max(...rPos) + CARD_H);
    }, 0);

    return (
        <div className="overflow-x-auto no-scrollbar pb-4">
            <div className="pb-4">
                {/* Stage headers */}
                <div className="flex mb-6">
                    {visible.map((round, ri) => {
                        // Show the TRUE match count (byes are hidden cards, so round.matches
                        // undercounts). Otherwise round 1 reads as fewer matches than round 2.
                        const total = rounds[round.name]?.length ?? round.matches.length;
                        const byes = total - round.matches.length;
                        return (
                            <React.Fragment key={round.name}>
                                <div className="text-center shrink-0" style={{ width: CARD_W }}>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{round.name}</p>
                                    <p className="text-[9px] text-gray-600 mt-1 uppercase tracking-wider">
                                        {total} match{total !== 1 ? 'es' : ''}{byes > 0 ? ` · ${byes} bye${byes !== 1 ? 's' : ''}` : ''}
                                    </p>
                                </div>
                                {ri < visible.length - 1 && <div style={{ width: CONN_W }} />}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Bracket body */}
                <div className="flex items-start">
                    {visible.map((round, ri) => {
                        const isLast = ri === visible.length - 1;
                        return (
                            <React.Fragment key={round.name}>
                                {/* Cards column */}
                                <div className="relative shrink-0" style={{ width: CARD_W, height: bHeight }}>
                                    {round.matches.map((match, ci) => (
                                        <div
                                            key={match._id}
                                            className="absolute"
                                            style={{ top: cardPos[ri][ci], left: 0, width: CARD_W, height: CARD_H }}
                                        >
                                            <BracketMatchCard
                                                match={match}
                                                competitorType={competitorType}
                                                swapMode={swapMode}
                                                swapSelection={swapSelection}
                                                onSwapClick={onSwapClick}
                                                ResultSection={ResultSection}
                                                onRecorded={onRecorded}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* SVG connectors to next round */}
                                {!isLast && (
                                    <ConnectorSvg
                                        currentMatches={round.matches}
                                        nextMatches={visible[ri + 1].matches}
                                        currentPositions={cardPos[ri]}
                                        nextPositions={cardPos[ri + 1]}
                                        height={bHeight}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTOR SVG
// ═══════════════════════════════════════════════════════════════════════════════

const ConnectorSvg: React.FC<{
    currentMatches: Match[];
    nextMatches: Match[];
    currentPositions: number[];
    nextPositions: number[];
    height: number;
}> = ({ currentMatches, nextMatches, currentPositions, nextPositions, height }) => {
    const midX = CONN_W / 2;
    const stroke = 'rgba(255,255,255,0.12)';
    const sw = 1.5;

    const groups = new Map<string, number[]>();
    currentMatches.forEach((match, ci) => {
        if (!match.nextMatchId) return;
        if (!groups.has(match.nextMatchId)) groups.set(match.nextMatchId, []);
        groups.get(match.nextMatchId)!.push(ci);
    });

    const paths: React.ReactNode[] = [];
    groups.forEach((cis, nextMatchId) => {
        const nextCi = nextMatches.findIndex(m => m._id === nextMatchId);
        if (nextCi < 0) return;
        const midY = nextPositions[nextCi] + CARD_H / 2;

        if (cis.length === 1) {
            const topY = currentPositions[cis[0]] + CARD_H / 2;
            paths.push(
                <path key={nextMatchId} d={`M 0 ${topY} H ${midX} V ${midY} H ${CONN_W}`}
                    fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
            );
        } else if (cis.length >= 2) {
            const sorted = [...cis].sort((a, b) => a - b);
            const topY = currentPositions[sorted[0]] + CARD_H / 2;
            const botY = currentPositions[sorted[sorted.length - 1]] + CARD_H / 2;
            paths.push(
                <g key={nextMatchId}>
                    <path d={`M 0 ${topY} H ${midX} V ${botY} H 0`}
                        fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={`M ${midX} ${midY} H ${CONN_W}`}
                        fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
                </g>
            );
        }
    });

    return (
        <svg width={CONN_W} height={height} className="shrink-0" style={{ display: 'block', overflow: 'visible' }}>
            {paths}
        </svg>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BRACKET MATCH CARD — with swap + inline scoring
// ═══════════════════════════════════════════════════════════════════════════════

const BracketMatchCard: React.FC<{
    match: Match;
    competitorType: 'player' | 'team';
    swapMode: boolean;
    swapSelection: SwapSelection | null;
    onSwapClick: (matchId: string, slot: 'player1' | 'player2', name: string) => void;
    ResultSection?: React.ComponentType<{ match: any; competitorType: 'player' | 'team'; onRecorded: () => void }>;
    onRecorded: () => void;
}> = ({ match, competitorType, swapMode, swapSelection, onSwapClick, ResultSection, onRecorded }) => {
    const c1 = getC1(match, competitorType);
    const c2 = getC2(match, competitorType);
    const isBye = match.status === 'walkover' && match.winReason === 'bye';
    const isLive = match.status === 'in_progress';
    const isCompleted = match.status === 'completed' || (match.status === 'walkover' && !isBye);
    const canSwap = swapMode && match.status !== 'completed' && !isLive;

    const isSlotSelected = (slot: 'player1' | 'player2') =>
        swapSelection?.matchId === match._id && swapSelection?.slot === slot;

    return (
        <div className={`rounded-2xl border overflow-hidden transition-all ${isBye ? 'border-amber-500/15 bg-amber-500/[0.02]' : isCompleted ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 font-mono">M{match.matchNumber}</span>
                    {isBye && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/15 text-amber-400 uppercase tracking-wider">BYE</span>}
                </div>
                <div className="flex items-center gap-2">
                    {isBye ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400/70 uppercase">Auto-advanced</span>
                    ) : isLive ? (
                        <Link to={`/live/${match._id}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 uppercase">
                            <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse" /> Live
                        </Link>
                    ) : isCompleted ? (
                        <Link to={`/live/${match._id}`} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 uppercase">Scorecard</Link>
                    ) : c1.isTBD || c2.isTBD ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-gray-500 uppercase">Pending</span>
                    ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/15 text-primary uppercase">Upcoming</span>
                    )}
                </div>
            </div>

            {/* Competitor 1 */}
            <CompetitorSlot
                name={c1.name} teamName={c1.teamName}
                isWinner={isCompleted && match.winnerId === c1.id}
                isTBD={c1.isTBD}
                score={match.result?.team1Total}
                competitorType={competitorType}
                canSwap={canSwap && !c1.isTBD}
                isSelected={isSlotSelected('player1')}
                onClick={() => canSwap && !c1.isTBD && onSwapClick(match._id, 'player1', c1.name)}
            />

            <div className="flex items-center px-4">
                <div className="flex-1 h-px bg-white/5" />
                <span className="px-2 text-[9px] text-gray-600 font-bold">VS</span>
                <div className="flex-1 h-px bg-white/5" />
            </div>

            {/* Competitor 2 */}
            <CompetitorSlot
                name={c2.name} teamName={c2.teamName}
                isWinner={isCompleted && match.winnerId === c2.id}
                isTBD={c2.isTBD}
                score={match.result?.team2Total}
                competitorType={competitorType}
                canSwap={canSwap && !c2.isTBD}
                isSelected={isSlotSelected('player2')}
                onClick={() => canSwap && !c2.isTBD && onSwapClick(match._id, 'player2', c2.name)}
            />

            {/* Sport-specific result section */}
            {ResultSection && <ResultSection match={match} competitorType={competitorType} onRecorded={onRecorded} />}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPETITOR SLOT (with swap highlighting)
// ═══════════════════════════════════════════════════════════════════════════════

const CompetitorSlot: React.FC<{
    name: string; teamName: string;
    isWinner: boolean; isTBD: boolean;
    score: number | null | undefined;
    competitorType: 'player' | 'team';
    canSwap: boolean; isSelected: boolean;
    onClick: () => void;
}> = ({ name, teamName, isWinner, isTBD, score, competitorType, canSwap, isSelected, onClick }) => (
    <div
        onClick={canSwap ? onClick : undefined}
        className={`flex items-center justify-between px-4 py-3 transition-all ${isWinner ? 'bg-emerald-500/5' : ''} ${isTBD ? 'opacity-30' : ''} ${canSwap ? 'cursor-pointer hover:bg-cyan-500/10' : ''} ${isSelected ? '!bg-cyan-500/20 ring-1 ring-cyan-400/50' : ''}`}
    >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {isWinner && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
            {isSelected && <MousePointer2 className="h-3.5 w-3.5 text-cyan-400 shrink-0 animate-pulse" />}
            <div className="min-w-0">
                <span className={`font-semibold text-sm truncate block ${isWinner ? 'text-emerald-400' : isTBD ? 'text-gray-600 italic' : isSelected ? 'text-cyan-300' : 'text-white'}`}>
                    {name}
                </span>
                {competitorType === 'player' && teamName && !isTBD && (
                    <span className="text-[10px] text-primary/70 font-medium mt-0.5 block truncate">{teamName}</span>
                )}
            </div>
        </div>
        {score !== null && score !== undefined && (
            <span className={`text-lg font-bold tabular-nums shrink-0 ml-3 ${isWinner ? 'text-emerald-400' : 'text-gray-400'}`}>{score}</span>
        )}
        {canSwap && !isSelected && (
            <RefreshCw className="h-3 w-3 text-cyan-500/50 shrink-0 ml-2" />
        )}
    </div>
);

export default BracketManagementSection;
