import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Users, Trophy, ChevronRight } from 'lucide-react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';

// ─── Types (loose; mirror the overview/standings API payloads) ────────────────
interface Tie {
    _id: string;
    bracketRound: string;
    matchNumber: number;
    team1Id: string | null;
    team2Id: string | null;
    team1Name: string;
    team2Name: string;
    status: string;
    winnerId: string | null;
    winReason: string | null;
    result: { team1Total?: number; team2Total?: number; marginOfVictory?: string } | null;
}
interface Group {
    _id: string;
    groupName: string;
    groupNumber: number;
    stageNumber: number;
    teamIds: string[];
    ties: Tie[];
}
interface Stage { stageNumber: number; groups: Group[] }
interface StandingEntry {
    teamId: string; teamName: string; played: number; won: number; lost: number;
    drawn: number; points: number; rank: number;
}
interface GroupStanding { group: { _id: string }; standings: StandingEntry[] }

const isKnockout = (g: Group) => g.groupName?.toLowerCase() === 'knockout';

// Friendly label for a knockout round given how many ties it contains.
const knockoutRoundLabel = (tieCount: number) => {
    if (tieCount === 1) return 'Final';
    if (tieCount === 2) return 'Semifinals';
    if (tieCount === 4) return 'Quarterfinals';
    return `Round of ${tieCount * 2}`;
};

// ─── Single tie card (used by both group + knockout views) ────────────────────
const TieCard: React.FC<{ tie: Tie }> = ({ tie }) => {
    const done = tie.status === 'completed';
    const isBye = tie.winReason === 'bye';
    const team1Won = done && tie.winnerId && tie.winnerId === tie.team1Id;
    const team2Won = done && tie.winnerId && tie.winnerId === tie.team2Id;
    const score = tie.result?.marginOfVictory
        || (tie.result?.team1Total != null ? `${tie.result?.team1Total}-${tie.result?.team2Total}` : '');

    const row = (name: string, won: boolean) => (
        <div className={`flex items-center justify-between px-3 py-1.5 ${won ? 'text-emerald-400 font-bold' : 'text-gray-300'}`}>
            <span className="truncate text-sm">{name}</span>
            {won && <Trophy className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
        </div>
    );

    return (
        <div className={`rounded-xl border overflow-hidden w-56 ${isBye ? 'border-amber-500/20 bg-amber-500/[0.03]' : done ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : 'border-white/10 bg-white/[0.03]'}`}>
            {row(tie.team1Name, !!team1Won)}
            <div className="h-px bg-white/10" />
            {row(tie.team2Name, !!team2Won)}
            <div className="flex items-center justify-between px-3 py-1 bg-black/30 text-[10px] uppercase tracking-wider">
                {isBye
                    ? <span className="text-amber-400 font-bold">Bye</span>
                    : done
                        ? <span className="text-emerald-400">Done {score && `· ${score}`}</span>
                        : <span className="text-gray-500">Pending</span>}
            </div>
        </div>
    );
};

// ─── Knockout tie-tree (rounds as columns) ────────────────────────────────────
const KnockoutTree: React.FC<{ ties: Tie[] }> = ({ ties }) => {
    // Bucket ties by their "-KO-R{n}" round suffix.
    const byRound = new Map<number, Tie[]>();
    for (const t of ties) {
        const m = /-KO-R(\d+)/.exec(t.bracketRound || '');
        const r = m ? parseInt(m[1], 10) : 1;
        if (!byRound.has(r)) byRound.set(r, []);
        byRound.get(r)!.push(t);
    }
    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);

    if (rounds.length === 0) {
        return <p className="text-sm text-gray-500 px-1">Knockout bracket not generated yet.</p>;
    }

    return (
        <div className="flex gap-6 overflow-x-auto pb-2">
            {rounds.map(r => {
                const roundTies = (byRound.get(r) || []).sort((a, b) => a.matchNumber - b.matchNumber);
                return (
                    <div key={r} className="flex flex-col gap-4 justify-around shrink-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary flex items-center gap-1">
                            {knockoutRoundLabel(roundTies.length)}
                            <ChevronRight className="h-3 w-3 opacity-50" />
                        </p>
                        {roundTies.map(t => <TieCard key={t._id} tie={t} />)}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Group standings table ────────────────────────────────────────────────────
const StandingsTable: React.FC<{ group: Group; standings?: StandingEntry[] }> = ({ group, standings }) => (
    <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/10 bg-white/5">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">{group.groupName}</h4>
        </div>
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-white/5 text-gray-500">
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Team</th>
                    <th className="text-center px-2 py-2 font-medium">P</th>
                    <th className="text-center px-2 py-2 font-medium">W</th>
                    <th className="text-center px-2 py-2 font-medium">L</th>
                    <th className="text-center px-2 py-2 text-primary font-bold">Pts</th>
                </tr>
            </thead>
            <tbody>
                {(standings && standings.length > 0 ? standings : []).map((e, i) => (
                    <tr key={e.teamId} className="border-b border-white/5">
                        <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-2 text-white font-medium">{e.teamName}</td>
                        <td className="text-center px-2 py-2 text-gray-300">{e.played}</td>
                        <td className="text-center px-2 py-2 text-emerald-400">{e.won}</td>
                        <td className="text-center px-2 py-2 text-red-400">{e.lost}</td>
                        <td className="text-center px-2 py-2 text-primary font-bold">{e.points}</td>
                    </tr>
                ))}
                {(!standings || standings.length === 0) && (
                    <tr><td colSpan={6} className="text-center py-4 text-gray-500">No standings yet</td></tr>
                )}
            </tbody>
        </table>
    </div>
);

// ─── Main view ────────────────────────────────────────────────────────────────
interface Props { categoryId: string }

export default function TeamLeagueBracketView({ categoryId }: Props) {
    const [stages, setStages] = useState<Stage[]>([]);
    const [standingsByStage, setStandingsByStage] = useState<Record<number, GroupStanding[]>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!categoryId) return;
        setLoading(true);
        setError(null);
        try {
            const overview = await teamLeagueApi.getOverview(categoryId);
            const loadedStages: Stage[] = overview?.stages || [];
            setStages(loadedStages);

            // Standings per (non-knockout) stage for the group tables.
            const standingsEntries = await Promise.all(
                loadedStages
                    .filter(s => s.groups.some(g => !isKnockout(g)))
                    .map(async (s) => {
                        try {
                            const data = await teamLeagueApi.getGroupStandings(categoryId, s.stageNumber);
                            return [s.stageNumber, Array.isArray(data) ? data : []] as const;
                        } catch {
                            return [s.stageNumber, [] as GroupStanding[]] as const;
                        }
                    })
            );
            setStandingsByStage(Object.fromEntries(standingsEntries));
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Failed to load team league bracket');
            setStages([]);
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    if (error) {
        return <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>;
    }
    if (stages.length === 0) {
        return (
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center text-gray-500 flex flex-col items-center gap-3">
                <Users className="h-10 w-10 opacity-50" />
                <p>No team league stages configured yet.</p>
                <p className="text-sm">Configure groups in the <strong className="text-gray-400">Team League</strong> tab to get started.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            {stages.slice().sort((a, b) => a.stageNumber - b.stageNumber).map(stage => {
                const knockoutGroups = stage.groups.filter(isKnockout);
                const roundRobinGroups = stage.groups.filter(g => !isKnockout(g));
                const stageStandings = standingsByStage[stage.stageNumber] || [];

                return (
                    <div key={stage.stageNumber} className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider">
                                Stage {stage.stageNumber}
                            </span>
                            <span className="text-xs text-gray-500">
                                {knockoutGroups.length > 0 ? 'Knockout' : 'Group stage'}
                            </span>
                        </div>

                        {roundRobinGroups.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {roundRobinGroups.map(g => (
                                    <StandingsTable
                                        key={g._id}
                                        group={g}
                                        standings={stageStandings.find(s => s.group._id === g._id)?.standings}
                                    />
                                ))}
                            </div>
                        )}

                        {knockoutGroups.map(g => (
                            <KnockoutTree key={g._id} ties={g.ties || []} />
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
