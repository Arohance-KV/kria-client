import React, { useEffect, useState } from 'react';
import { Loader2, Trophy, Swords, CheckCircle2 } from 'lucide-react';
import API from '../../../api/axios';
import { sportRegistry } from '@/sports/registry';

interface CategoryInfo { _id: string; name: string; status: string }

interface Match {
    _id: string;
    bracketRound: string;
    matchNumber: number;
    roundNumber?: number;
    competitorType?: 'player' | 'team';
    teams: { team1Id: string; team2Id: string; team1Name: string; team2Name: string };
    player1?: { registrationId: string; name: string; teamId: string; teamName: string };
    player2?: { registrationId: string; name: string; teamId: string; teamName: string };
    status: string;
    winnerId?: string;
    winReason?: string;
    result?: { team1Total?: number; team2Total?: number; marginOfVictory?: string };
    gameScores?: { gameNumber: number; team1Score: number; team2Score: number; winnerId?: string }[];
    matchConfig?: { bestOf?: number; pointsToWin?: number };
    schedule?: { date?: string; time?: string; court?: string };
}

interface Props {
    tournamentId: string;
    sport: string;
    categories: CategoryInfo[];
}

// Helper: get competitor info from a match
function getC1(match: Match) {
    if (match.competitorType === 'player' && match.player1) {
        return { id: match.player1.registrationId, name: match.player1.name, teamName: match.player1.teamName, isTBD: match.player1.registrationId === 'TBD' };
    }
    return { id: match.teams.team1Id, name: match.teams.team1Name, teamName: '', isTBD: match.teams.team1Name === 'TBD' };
}

function getC2(match: Match) {
    if (match.competitorType === 'player' && match.player2) {
        return { id: match.player2.registrationId, name: match.player2.name, teamName: match.player2.teamName, isTBD: match.player2.registrationId === 'TBD' };
    }
    return { id: match.teams.team2Id, name: match.teams.team2Name, teamName: '', isTBD: match.teams.team2Name === 'TBD' };
}

const MatchManagementSection: React.FC<Props> = ({ tournamentId, sport, categories }) => {
    const [selectedCat, setSelectedCat] = useState<string>('');
    const [matches, setMatches] = useState<Match[]>([]);
    const [rounds, setRounds] = useState<Record<string, Match[]>>({});
    const [competitorType, setCompetitorType] = useState<'player' | 'team'>('player');
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ResultSection = sportRegistry.get(sport)?.matchResultSection;

    const eligibleCategories = categories.filter(c =>
        ['auction', 'bracket_configured', 'ongoing', 'completed'].includes(c.status)
    );

    useEffect(() => {
        if (eligibleCategories.length > 0 && !selectedCat) {
            setSelectedCat(eligibleCategories[0]._id);
        }
    }, [eligibleCategories.length]);

    const fetchMatches = async () => {
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
            setMatches([]);
            setRounds({});
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchMatches(); }, [selectedCat]);

    const handleGenerateBracket = async () => {
        if (!selectedCat) return;
        setIsGenerating(true);
        setError(null);
        try {
            await API.post(`/matches/generate/${selectedCat}`);
            await API.post(`/categories/${selectedCat}/configure-bracket`).catch(() => { });
            await fetchMatches();
        } catch (err: any) {
            setError(err.response?.data?.data?.message || err.response?.data?.message || 'Failed to generate bracket');
        } finally {
            setIsGenerating(false);
        }
    };

    if (eligibleCategories.length === 0) return null;

    const selectedCategory = categories.find(c => c._id === selectedCat);
    const hasBracket = matches.length > 0;
    const hasScoringStarted = matches.some(m => m.status === 'completed');
    const canGenerate = selectedCategory && selectedCategory.status === 'auction' && !hasScoringStarted;

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Trophy className="h-5 w-5" /></div>
                <h2 className="text-2xl font-oswald font-bold tracking-wide">Match Management</h2>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
                <select
                    value={selectedCat}
                    onChange={(e) => setSelectedCat(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                >
                    {eligibleCategories.map(c => (
                        <option key={c._id} value={c._id} className="bg-[#111]">{c.name} ({c.status})</option>
                    ))}
                </select>

                {canGenerate && (
                    <button
                        onClick={handleGenerateBracket}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                        Generate Bracket
                    </button>
                )}

                {selectedCategory?.status === 'auction' && hasScoringStarted && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400/70 text-sm font-medium">
                        <Swords className="h-4 w-4 opacity-50" />
                        Scoring in progress — bracket locked
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl">{error}</div>
            )}

            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !hasBracket ? (
                <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center text-gray-500 flex flex-col items-center gap-3">
                    <Trophy className="h-10 w-10 opacity-30" />
                    <p>No bracket generated for this category yet.</p>
                    {canGenerate && <p className="text-sm text-gray-600">Click "Generate Bracket" above to create the match fixtures.</p>}
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {Object.entries(rounds)
                        .sort((a, b) => {
                            const aRN = (a[1] as Match[])?.[0]?.roundNumber || 0;
                            const bRN = (b[1] as Match[])?.[0]?.roundNumber || 0;
                            return aRN - bRN;
                        })
                        .map(([roundName, roundMatches]) => {
                            // Filter out bye matches
                            const visible = (roundMatches as Match[]).filter(m => !(m.status === 'walkover' && m.winReason === 'bye'));
                            if (visible.length === 0) return null;
                            return (
                                <div key={roundName} className="flex flex-col gap-3">
                                    <h4 className="text-sm font-bold uppercase tracking-widest text-primary border-b border-white/5 pb-2">{roundName}</h4>
                                    {visible.map((match: Match) => (
                                        <OrganizerMatchCard
                                            key={match._id}
                                            match={match}
                                            competitorType={competitorType}
                                            ResultSection={ResultSection}
                                            onRecorded={fetchMatches}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                </div>
            )}
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZER MATCH CARD
// ═══════════════════════════════════════════════════════════════════════════════

const OrganizerMatchCard: React.FC<{
    match: Match;
    competitorType: 'player' | 'team';
    ResultSection?: React.ComponentType<{ match: any; competitorType: 'player' | 'team'; onRecorded: () => void }>;
    onRecorded: () => void;
}> = ({ match, competitorType, ResultSection, onRecorded }) => {
    const c1 = getC1(match);
    const c2 = getC2(match);
    const isTBD = c1.isTBD || c2.isTBD;
    const isCompleted = match.status === 'completed' || match.status === 'walkover';

    return (
        <div className={`rounded-2xl border overflow-hidden transition-all ${isCompleted ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : 'border-white/10 bg-black/20'}`}>
            {/* Match header */}
            <div className="flex flex-col px-5 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-medium">#{match.matchNumber}</span>
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                                <span className={`font-semibold text-sm ${isCompleted && match.winnerId === c1.id ? 'text-emerald-400' : isTBD ? 'text-gray-600' : 'text-white'}`}>
                                    {c1.name}
                                </span>
                                {competitorType === 'player' && c1.teamName && !c1.isTBD && (
                                    <span className="text-[10px] text-primary/60">{c1.teamName}</span>
                                )}
                            </div>
                            <span className="text-[10px] text-gray-600 font-bold">vs</span>
                            <div className="flex flex-col">
                                <span className={`font-semibold text-sm ${isCompleted && match.winnerId === c2.id ? 'text-emerald-400' : isTBD ? 'text-gray-600' : 'text-white'}`}>
                                    {c2.name}
                                </span>
                                {competitorType === 'player' && c2.teamName && !c2.isTBD && (
                                    <span className="text-[10px] text-primary/60">{c2.teamName}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isCompleted && (
                            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                <CheckCircle2 className="h-3 w-3" /> Done
                            </span>
                        )}
                        {isCompleted && match.result && (
                            <span className="text-sm font-bold text-gray-300">{match.result.team1Total} - {match.result.team2Total}</span>
                        )}
                    </div>
                </div>
            </div>

            {ResultSection && <ResultSection match={match} competitorType={competitorType} onRecorded={onRecorded} />}
        </div>
    );
};

export default MatchManagementSection;