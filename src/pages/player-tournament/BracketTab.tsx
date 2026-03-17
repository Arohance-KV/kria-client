import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trophy, ExternalLink } from 'lucide-react';
import { Category } from '../../store/slices/registrationSlice';
import { Match } from '../../store/slices/matchSlice';
import API from '../../api/axios';

interface Props {
    categories: Category[];
    tournamentId: string;
}

// ─── Layout constants (mirrors BracketPage) ───────────────────────────────────
const CARD_H = 100;
const CARD_W = 280;
const CARD_GAP = 16;
const CONN_W = 44;
const S = CARD_H + CARD_GAP;

function computeCardPositions(
    visible: { name: string; matches: Match[] }[]
): number[][] {
    if (visible.length === 0) return [];
    const positions: number[][] = [];
    positions[0] = visible[0].matches.map((_, ci) => ci * S);
    for (let ri = 1; ri < visible.length; ri++) {
        const prev = positions[ri - 1];
        const prevMatches = visible[ri - 1].matches;
        positions[ri] = visible[ri].matches.map((match, ci) => {
            const sources = prevMatches
                .map((m, prevCi) => ({ m, prevCi }))
                .filter(({ m }) => m.nextMatchId === match._id);
            if (sources.length > 0) {
                const avgCenterY =
                    sources.reduce((sum, { prevCi }) => sum + prev[prevCi] + CARD_H / 2, 0) /
                    sources.length;
                return avgCenterY - CARD_H / 2;
            }
            return ci * S;
        });
    }
    return positions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getC1(match: Match, cType: 'player' | 'team') {
    if (cType === 'player' && match.player1) {
        const { registrationId: id, name, teamName } = match.player1;
        return { id, name, teamName, isTBD: id === 'TBD', isBye: name === 'TBD' && id === 'TBD' };
    }
    const name = match.teams?.team1Name || 'TBD';
    return { id: match.teams?.team1Id || '', name, teamName: '', isTBD: name === 'TBD', isBye: name === 'BYE' };
}

function getC2(match: Match, cType: 'player' | 'team') {
    if (cType === 'player' && match.player2) {
        const { registrationId: id, name, teamName } = match.player2;
        return { id, name, teamName, isTBD: id === 'TBD', isBye: name === 'TBD' && id === 'TBD' };
    }
    const name = match.teams?.team2Name || 'TBD';
    return { id: match.teams?.team2Id || '', name, teamName: '', isTBD: name === 'TBD', isBye: name === 'BYE' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRACKET TAB
// ═══════════════════════════════════════════════════════════════════════════════

const BracketTab: React.FC<Props> = ({ categories, tournamentId }) => {
    const [selectedCat, setSelectedCat] = useState<string>(categories[0]?._id || '');
    const [matches, setMatches] = useState<Match[]>([]);
    const [rounds, setRounds] = useState<Record<string, Match[]>>({});
    const [competitorType, setCompetitorType] = useState<'player' | 'team'>('player');
    const [isLoading, setIsLoading] = useState(false);
    const [bracketType, setBracketType] = useState<string>('knockout');

    useEffect(() => {
        if (!selectedCat) return;
        const fetch = async () => {
            setIsLoading(true);
            try {
                const res = await API.get(`/matches/categories/${selectedCat}`);
                const payload = res.data?.data?.data || res.data?.data || {};
                setMatches(payload.matches || []);
                setRounds(payload.rounds || {});
                setCompetitorType(payload.competitorType || 'player');
                const cat = categories.find(c => c._id === selectedCat);
                setBracketType(cat?.bracketType || 'knockout');
            } catch {
                setMatches([]);
                setRounds({});
            } finally {
                setIsLoading(false);
            }
        };
        fetch();
    }, [selectedCat, categories]);

    const sortedRoundNames = Object.keys(rounds).sort((a, b) => {
        const aM = rounds[a]?.[0];
        const bM = rounds[b]?.[0];
        return ((aM as any)?.roundNumber || 0) - ((bM as any)?.roundNumber || 0);
    });

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Tab header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="text-2xl font-oswald font-bold tracking-wide">Bracket</h3>
                <div className="flex items-center gap-3">
                    {categories.length > 1 && (
                        <select
                            value={selectedCat}
                            onChange={(e) => setSelectedCat(e.target.value)}
                            className="px-4 py-2 rounded-xl bg-white/5 border border-primary/30 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                        >
                            {categories.map(c => (
                                <option key={c._id} value={c._id} className="bg-[#111]">{c.name}</option>
                            ))}
                        </select>
                    )}
                    {matches.length > 0 && (
                        <Link
                            to={`/bracket/${tournamentId}/${selectedCat}`}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Full View
                        </Link>
                    )}
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : matches.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center text-gray-400 flex flex-col items-center gap-3">
                    <Trophy className="h-10 w-10 opacity-30" />
                    <p>Bracket not generated yet. Check back after the auction completes.</p>
                </div>
            ) : bracketType === 'league' ? (
                <LeagueView matches={matches} competitorType={competitorType} />
            ) : (
                <KnockoutView
                    sortedRoundNames={sortedRoundNames}
                    rounds={rounds}
                    competitorType={competitorType}
                />
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// KNOCKOUT VIEW
// ═══════════════════════════════════════════════════════════════════════════════

const KnockoutView: React.FC<{
    sortedRoundNames: string[];
    rounds: Record<string, Match[]>;
    competitorType: 'player' | 'team';
}> = ({ sortedRoundNames, rounds, competitorType }) => {
    const visible = sortedRoundNames
        .map(name => ({
            name,
            matches: (rounds[name] || [])
                .filter(m => !(m.status === 'walkover' && m.winReason === 'bye'))
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
                    {visible.map((round, ri) => (
                        <React.Fragment key={round.name}>
                            <div className="text-center" style={{ width: CARD_W }}>
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                                    {round.name}
                                </p>
                                <p className="text-[9px] text-gray-600 mt-1 uppercase tracking-wider">
                                    {round.matches.length} match{round.matches.length !== 1 ? 'es' : ''}
                                </p>
                            </div>
                            {ri < visible.length - 1 && <div style={{ width: CONN_W }} />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Bracket body */}
                <div className="flex items-start">
                    {visible.map((round, ri) => {
                        const isLast = ri === visible.length - 1;
                        return (
                            <React.Fragment key={round.name}>
                                {/* Cards column */}
                                <div
                                    className="relative shrink-0"
                                    style={{ width: CARD_W, height: bHeight }}
                                >
                                    {round.matches.map((match, ci) => (
                                        <div
                                            key={match._id}
                                            className="absolute"
                                            style={{
                                                top: cardPos[ri][ci],
                                                left: 0,
                                                width: CARD_W,
                                                height: CARD_H,
                                            }}
                                        >
                                            <MatchCard match={match} competitorType={competitorType} />
                                        </div>
                                    ))}
                                </div>

                                {/* Connector to next round */}
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
    const stroke = 'rgba(255,255,255,0.10)';
    const sw = 1.5;

    // Group current-round match indices by the next-round match they feed into
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
            // Single source → step connector (right → vertical → right)
            const topY = currentPositions[cis[0]] + CARD_H / 2;
            paths.push(
                <path
                    key={nextMatchId}
                    d={`M 0 ${topY} H ${midX} V ${midY} H ${CONN_W}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            );
        } else if (cis.length >= 2) {
            // Two sources → C-shape spine + exit line
            const sorted = [...cis].sort((a, b) => a - b);
            const topY = currentPositions[sorted[0]] + CARD_H / 2;
            const botY = currentPositions[sorted[sorted.length - 1]] + CARD_H / 2;
            paths.push(
                <g key={nextMatchId}>
                    <path
                        d={`M 0 ${topY} H ${midX} V ${botY} H 0`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={sw}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d={`M ${midX} ${midY} H ${CONN_W}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={sw}
                        strokeLinecap="round"
                    />
                </g>
            );
        }
    });

    return (
        <svg
            width={CONN_W}
            height={height}
            className="shrink-0"
            style={{ display: 'block', overflow: 'visible' }}
        >
            {paths}
        </svg>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH CARD
// ═══════════════════════════════════════════════════════════════════════════════

const MatchCard: React.FC<{ match: Match; competitorType: 'player' | 'team' }> = ({ match, competitorType }) => {
    const c1 = getC1(match, competitorType);
    const c2 = getC2(match, competitorType);
    const done = match.status === 'completed' || match.status === 'walkover';
    const isC1W = done && match.winnerId === c1.id;
    const isC2W = done && match.winnerId === c2.id;
    const pending = !done && (c1.isTBD || c2.isTBD);

    const gameChips = (match.gameScores || [])
        .filter(g => g.team1Score > 0 || g.team2Score > 0)
        .sort((a, b) => a.gameNumber - b.gameNumber)
        .map(g => `${g.team1Score}–${g.team2Score}`);

    return (
        <div className={`h-full flex flex-col rounded-xl overflow-hidden border transition-colors ${
            done
                ? 'border-white/[0.07] bg-[#141414]'
                : pending
                    ? 'border-white/[0.04] bg-[#0d0d0d]'
                    : 'border-primary/25 bg-[#111] hover:border-primary/40'
        }`}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.05] bg-black/20 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-mono text-gray-600 tracking-widest shrink-0">
                        M{match.matchNumber}
                    </span>
                    {done && gameChips.length > 0 && (
                        <span className="text-[9px] text-gray-500 truncate">
                            {gameChips.join(' · ')}
                        </span>
                    )}
                </div>
                <span className={`ml-2 shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${
                    done
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : pending
                            ? 'bg-white/5 text-gray-600'
                            : 'bg-primary/15 text-primary'
                }`}>
                    {done ? 'Done' : pending ? 'Pending' : 'Upcoming'}
                </span>
            </div>

            {/* Competitor 1 */}
            <CompetitorRow
                name={c1.name}
                teamName={c1.teamName}
                isWinner={isC1W}
                isTBD={c1.isTBD || c1.isBye}
                score={match.result?.team1Total}
                competitorType={competitorType}
            />

            <div className="h-px bg-white/[0.04] shrink-0" />

            {/* Competitor 2 */}
            <CompetitorRow
                name={c2.name}
                teamName={c2.teamName}
                isWinner={isC2W}
                isTBD={c2.isTBD || c2.isBye}
                score={match.result?.team2Total}
                competitorType={competitorType}
            />
        </div>
    );
};

const CompetitorRow: React.FC<{
    name: string;
    teamName: string;
    isWinner: boolean;
    isTBD: boolean;
    score: number | null | undefined;
    competitorType: 'player' | 'team';
}> = ({ name, teamName, isWinner, isTBD, score, competitorType }) => (
    <div className={`flex items-center flex-1 relative overflow-hidden ${isWinner ? 'bg-emerald-500/[0.05]' : ''} ${isTBD ? 'opacity-25' : ''}`}>
        {isWinner && (
            <div className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400 rounded-r" />
        )}
        <div className={`flex items-center flex-1 min-w-0 gap-2 px-3 ${isWinner ? 'pl-[18px]' : ''}`}>
            <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold truncate leading-tight ${
                    isWinner
                        ? 'text-emerald-400'
                        : isTBD
                            ? 'text-gray-600 italic text-xs'
                            : 'text-white/85'
                }`}>
                    {name}
                </p>
                {competitorType === 'player' && teamName && !isTBD && (
                    <p className="text-[10px] text-primary/50 truncate mt-0.5">{teamName}</p>
                )}
            </div>
            {score !== null && score !== undefined && (
                <span className={`text-[17px] font-black tabular-nums shrink-0 ${isWinner ? 'text-emerald-400' : 'text-gray-600'}`}>
                    {score}
                </span>
            )}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// LEAGUE VIEW (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

const LeagueView: React.FC<{ matches: Match[]; competitorType: 'player' | 'team' }> = ({ matches, competitorType }) => {
    const standings: Record<string, { name: string; teamName: string; played: number; won: number; lost: number; points: number }> = {};

    matches.forEach(m => {
        const c1 = getC1(m, competitorType);
        const c2 = getC2(m, competitorType);
        if (!standings[c1.id]) standings[c1.id] = { name: c1.name, teamName: c1.teamName, played: 0, won: 0, lost: 0, points: 0 };
        if (!standings[c2.id]) standings[c2.id] = { name: c2.name, teamName: c2.teamName, played: 0, won: 0, lost: 0, points: 0 };

        if (m.status === 'completed') {
            standings[c1.id].played++;
            standings[c2.id].played++;
            if (m.winnerId === c1.id) { standings[c1.id].won++; standings[c1.id].points += 2; standings[c2.id].lost++; }
            else if (m.winnerId === c2.id) { standings[c2.id].won++; standings[c2.id].points += 2; standings[c1.id].lost++; }
        }
    });

    const sorted = Object.entries(standings).sort((a, b) => b[1].points - a[1].points || b[1].won - a[1].won);

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold">#</th>
                            <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold">{competitorType === 'player' ? 'Player' : 'Team'}</th>
                            {competitorType === 'player' && <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold">Team</th>}
                            <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold">P</th>
                            <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold">W</th>
                            <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold">L</th>
                            <th className="text-center px-3 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold">Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(([id, entry], idx) => (
                            <tr key={id} className="border-b border-white/5 hover:bg-white/[0.03]">
                                <td className="px-5 py-3 text-gray-500 font-bold">{idx + 1}</td>
                                <td className="px-5 py-3 text-white font-semibold">{entry.name}</td>
                                {competitorType === 'player' && <td className="px-5 py-3 text-primary/70 text-xs font-medium">{entry.teamName}</td>}
                                <td className="text-center px-3 py-3 text-gray-400">{entry.played}</td>
                                <td className="text-center px-3 py-3 text-emerald-400 font-bold">{entry.won}</td>
                                <td className="text-center px-3 py-3 text-red-400">{entry.lost}</td>
                                <td className="text-center px-3 py-3 text-primary font-bold">{entry.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h4 className="text-lg font-oswald font-bold">All Fixtures</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matches.map(m => {
                    const c1 = getC1(m, competitorType);
                    const c2 = getC2(m, competitorType);
                    return (
                        <div key={m._id} className={`flex flex-col px-5 py-4 rounded-2xl border ${m.status === 'completed' ? 'bg-white/[0.03] border-white/10' : 'bg-white/5 border-white/10 hover:border-white/20'} transition-all`}>
                            <div className="flex items-center justify-between">
                                <div className="flex-1 text-right pr-4">
                                    <span className={`font-semibold text-sm ${m.winnerId === c1.id ? 'text-emerald-400' : 'text-white'}`}>{c1.name}</span>
                                    {competitorType === 'player' && c1.teamName && <p className="text-[10px] text-primary/60 mt-0.5">{c1.teamName}</p>}
                                </div>
                                <div className="px-3 shrink-0">
                                    {m.status === 'completed' ? (
                                        <span className="text-xs font-bold text-gray-400 bg-white/5 px-2 py-1 rounded">{m.result?.team1Total ?? '-'} : {m.result?.team2Total ?? '-'}</span>
                                    ) : (
                                        <span className="text-[10px] text-gray-600 uppercase font-bold">vs</span>
                                    )}
                                </div>
                                <div className="flex-1 text-left pl-4">
                                    <span className={`font-semibold text-sm ${m.winnerId === c2.id ? 'text-emerald-400' : 'text-white'}`}>{c2.name}</span>
                                    {competitorType === 'player' && c2.teamName && <p className="text-[10px] text-primary/60 mt-0.5">{c2.teamName}</p>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BracketTab;
