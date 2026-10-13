import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchTournamentTeams } from '@/store/slices/teamSlice';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import { CategoryTabs, EmptyState, Notice, PageHead, PANEL, SegTabs, categoryMeta } from '@/pages/organizer/ui';
import { BTN_GHOST, BTN_SM } from '@/pages/organizer/shared';
import { cn } from '@/lib/utils';
import GroupConfigPanel from './teamLeague/GroupConfigPanel';
import TieManagementPanel from './teamLeague/TieManagementPanel';
import GroupStandingsTable from './teamLeague/GroupStandingsTable';
import OverallView from './teamLeague/OverallView';

interface CategoryInfo { _id: string; name: string; status: string; bracketType?: string; teamLeagueConfig?: any }

interface Props {
    tournamentId: string;
    categories: CategoryInfo[];
}

type View = 'groups' | 'ties' | 'standings' | 'overview';

const VIEWS: { key: View; label: string }[] = [
    { key: 'groups', label: 'Groups' },
    { key: 'ties', label: 'Ties' },
    { key: 'standings', label: 'Standings' },
    { key: 'overview', label: 'Overview' },
];

export default function TeamLeagueSection({ tournamentId, categories }: Props) {
    const dispatch = useAppDispatch();
    const { teams } = useAppSelector(state => state.team);

    const leagueCategories = categories.filter(c => c.bracketType === 'team_league');
    const [categoryId, setCategoryId] = useState('');
    const [view, setView] = useState<View>('groups');
    const [stageNumber, setStageNumber] = useState(1);
    const [stages, setStages] = useState<number[]>([1]);
    // null = not loaded yet for this category/stage; panels show their own spinner.
    const [groups, setGroups] = useState<any[] | null>(null);
    const [standings, setStandings] = useState<any[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const category = leagueCategories.find(c => c._id === categoryId) ?? leagueCategories[0];
    const catId = category?._id ?? '';

    useEffect(() => {
        dispatch(fetchTournamentTeams(tournamentId));
    }, [tournamentId, dispatch]);

    const refreshGroups = useCallback(async () => {
        if (!catId) return;
        try {
            const data = await teamLeagueApi.getGroups(catId, stageNumber);
            setGroups(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e.response?.data?.message || e.message || 'Failed to load groups');
            setGroups([]);
        }
    }, [catId, stageNumber]);

    const refreshStandings = useCallback(async () => {
        if (!catId) return;
        try {
            const data = await teamLeagueApi.getGroupStandings(catId, stageNumber);
            setStandings(Array.isArray(data) ? data : []);
        } catch {
            setStandings([]);
        }
    }, [catId, stageNumber]);

    // Derive which stages actually exist (a stage only appears once it has groups —
    // e.g. Stage 2 shows up only after teams have been advanced into it).
    const refreshStages = useCallback(async () => {
        if (!catId) { setStages([1]); return; }
        try {
            const overview = await teamLeagueApi.getOverview(catId);
            const found: number[] = (overview?.stages || [])
                .map((s: any) => s.stageNumber)
                .filter((n: any) => typeof n === 'number');
            setStages(found.length > 0 ? Array.from(new Set(found)).sort((a, b) => a - b) : [1]);
        } catch {
            setStages([1]);
        }
    }, [catId]);

    // Only a category or stage switch blanks the data. Later refreshes (after a tie is
    // created, a result lands…) keep the panels mounted with their current data.
    useEffect(() => {
        if (!catId) return;
        setGroups(null);
        setStandings(null);
        refreshGroups();
        refreshStandings();
        refreshStages();
    }, [catId, stageNumber, refreshGroups, refreshStandings, refreshStages]);

    // Standings summarise results recorded elsewhere — the scoring console, a
    // staff member's session — so the snapshot taken at page load goes stale
    // without anything here knowing. Refetch on opening the view, which is what
    // OverallView already gets for free by owning its own fetch. Without this a
    // finished group read '0 of 3 ties played', and because advancing is gated
    // on that count, it stayed unavailable.
    useEffect(() => {
        if (view === 'standings') refreshStandings();
    }, [view, refreshStandings]);

    if (!category) {
        return (
            <div className="space-y-6">
                <PageHead title="Team league" desc="Groups, ties, lineups and standings." />
                <div className={PANEL}>
                    <EmptyState title="No team league categories" text="Create a category with the Team league format first." />
                </div>
            </div>
        );
    }

    const switchView = (v: View) => { setView(v); setError(null); };
    const tieCounts: Record<string, number> = Object.fromEntries((standings ?? []).map(s => [s.group?._id, s.totalTies]));

    return (
        <div className="space-y-6">
            <PageHead title="Team league" desc={`Groups, ties, lineups and standings for ${category.name}.`} />

            {leagueCategories.length > 1 && (
                <CategoryTabs
                    categories={leagueCategories.map(c => ({ _id: c._id, name: c.name, meta: categoryMeta(undefined, c.status) }))}
                    value={catId}
                    onChange={id => { setCategoryId(id); setStageNumber(1); setError(null); }}
                />
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                <SegTabs label="Team league view" items={VIEWS} value={view} onChange={switchView} />
                <div className="flex items-center gap-2">
                    {view === 'standings' && (
                        <button type="button" aria-label="Refresh" title="Refresh standings" onClick={refreshStandings}
                            className={cn(BTN_GHOST, BTN_SM, 'w-8 px-0')}>
                            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <SegTabs label="Stage" items={stages.map(s => ({ key: String(s), label: `Stage ${s}` }))}
                        value={String(stageNumber)} onChange={k => { setStageNumber(Number(k)); setError(null); }} />
                </div>
            </div>

            {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}

            {view === 'groups' && (
                <GroupConfigPanel
                    categoryId={catId}
                    categoryStatus={category.status}
                    stageNumber={stageNumber}
                    groups={groups}
                    teams={teams}
                    onRefresh={() => { refreshGroups(); refreshStandings(); }}
                    setError={setError}
                />
            )}
            {view === 'ties' && (
                <TieManagementPanel
                    categoryId={catId}
                    groups={groups}
                    teams={teams}
                    tieCounts={tieCounts}
                    categoryConfig={category.teamLeagueConfig}
                    onRefresh={refreshStandings}
                    setError={setError}
                />
            )}
            {view === 'standings' && (
                <GroupStandingsTable
                    categoryId={catId}
                    stageNumber={stageNumber}
                    standings={standings}
                    teams={teams}
                    topNPerGroup={category.teamLeagueConfig?.topNPerGroup || 1}
                    onAdvanced={() => { setError(null); setStageNumber(stageNumber + 1); setView('ties'); }}
                />
            )}
            {view === 'overview' && <OverallView categoryId={catId} teams={teams} setError={setError} />}
        </div>
    );
}
