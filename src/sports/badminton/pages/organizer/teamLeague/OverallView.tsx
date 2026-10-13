import { useEffect, useState } from 'react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import { EmptyState, PANEL, Spinner } from '@/pages/organizer/ui';
import { cn } from '@/lib/utils';
import { ChampionBanner, StandingsTable } from './GroupStandingsTable';

interface Team { _id: string; name: string; logo?: string; primaryColor?: string }

interface Props {
    categoryId: string;
    teams: Team[];
    setError: (err: string | null) => void;
}

interface StageData {
    stageNumber: number;
    groups: any[];
    standings: any[];
}

export default function OverallView({ categoryId, teams, setError }: Props) {
    const [stages, setStages] = useState<StageData[] | null>(null);
    const [failed, setFailed] = useState(false);

    // The overview endpoint lists the stages that exist; their standings then load in parallel.
    useEffect(() => {
        let live = true;
        setStages(null);
        setFailed(false);
        (async () => {
            try {
                const overview = await teamLeagueApi.getOverview(categoryId);
                const list: any[] = (overview?.stages || []).filter((s: any) => typeof s.stageNumber === 'number');
                const standings = await Promise.all(list.map(s => teamLeagueApi.getGroupStandings(categoryId, s.stageNumber).catch(() => [])));
                if (live) setStages(list.map((s, i) => ({ stageNumber: s.stageNumber, groups: s.groups || [], standings: Array.isArray(standings[i]) ? standings[i] : [] })));
            } catch (e: any) {
                if (!live) return;
                setError(e.response?.data?.message || e.message || 'Failed to load overview');
                setFailed(true);
            }
        })();
        return () => { live = false; };
    }, [categoryId, setError]);

    if (failed) return null;
    if (!stages) return <Spinner label="Loading overview" />;
    if (stages.length === 0) {
        return (
            <div className={PANEL}>
                <EmptyState title="Nothing to show yet" text="Stages appear here once groups are set up." />
            </div>
        );
    }

    // Champion: last stage, 1 group, ≤2 teams, all ties complete → rank 1 is champion
    const lastStandings = stages[stages.length - 1].standings;
    const allLastComplete = lastStandings.length > 0 && lastStandings.every((gs: any) => gs.completedTies > 0 && gs.completedTies === gs.totalTies);
    const isFinal = lastStandings.length === 1 && (lastStandings[0]?.standings?.length || 0) <= 2;
    const champion = isFinal && allLastComplete ? lastStandings[0]?.standings?.[0] : null;

    return (
        <div className="space-y-4">
            {champion && <ChampionBanner entry={champion} />}

            {stages.map(stage => {
                const teamCount = stage.groups.reduce((n: number, g: any) => n + (g.teamIds?.length || 0), 0);
                const groupCount = stage.groups.length || stage.standings.length;
                return (
                    <section key={stage.stageNumber} className={PANEL}>
                        <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-fg">
                            Stage {stage.stageNumber}{' '}
                            <span className="font-normal text-fg-subtle">
                                · {teamCount} team{teamCount === 1 ? '' : 's'} · {groupCount} group{groupCount === 1 ? '' : 's'}
                            </span>
                        </h3>
                        <div className={cn('grid gap-x-6 gap-y-5 p-4', stage.standings.length > 1 && 'lg:grid-cols-2')}>
                            {stage.standings.map((gs: any) => (
                                <div key={gs.group._id} className="min-w-0">
                                    <p className="mb-1 flex items-baseline justify-between gap-2 px-2.5 text-[13px]">
                                        <span className="font-medium text-fg">{gs.group.groupName}</span>
                                        <span className="text-xs text-fg-subtle">{gs.completedTies} of {gs.totalTies} ties played</span>
                                    </p>
                                    <StandingsTable compact rows={gs.standings || []} teams={teams} championId={champion?.teamId} />
                                </div>
                            ))}
                            {stage.standings.length === 0 && <p className="text-[13px] text-fg-subtle">No standings for this stage yet.</p>}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
