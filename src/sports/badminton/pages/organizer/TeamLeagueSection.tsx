import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Users, Swords, Trophy, BarChart3, LayoutDashboard } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchTournamentTeams } from '@/store/slices/teamSlice';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import GroupConfigPanel from './teamLeague/GroupConfigPanel';
import TieManagementPanel from './teamLeague/TieManagementPanel';
import GroupStandingsTable from './teamLeague/GroupStandingsTable';
import OverallView from './teamLeague/OverallView';

interface CategoryInfo { _id: string; name: string; status: string; bracketType?: string; teamLeagueConfig?: any }

interface Props {
    tournamentId: string;
    categories: CategoryInfo[];
}

type Tab = 'groups' | 'ties' | 'standings' | 'overview';

export default function TeamLeagueSection({ tournamentId, categories }: Props) {
    const dispatch = useAppDispatch();
    const { teams } = useAppSelector(state => state.team);

    const teamLeagueCategories = categories.filter(c => c.bracketType === 'team_league');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<Tab>('groups');
    const [groups, setGroups] = useState<any[]>([]);
    const [standings, setStandings] = useState<any[]>([]);
    const [stageNumber, setStageNumber] = useState(1);
    const [availableStages, setAvailableStages] = useState<number[]>([1]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedCategory = teamLeagueCategories.find(c => c._id === selectedCategoryId);

    useEffect(() => {
        dispatch(fetchTournamentTeams(tournamentId));
    }, [tournamentId, dispatch]);

    useEffect(() => {
        if (teamLeagueCategories.length > 0 && !selectedCategoryId) {
            setSelectedCategoryId(teamLeagueCategories[0]._id);
        }
    }, [teamLeagueCategories, selectedCategoryId]);

    const refreshGroups = useCallback(async () => {
        if (!selectedCategoryId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await teamLeagueApi.getGroups(selectedCategoryId, stageNumber);
            setGroups(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e.response?.data?.message || e.message || 'Failed to load groups');
            setGroups([]);
        } finally {
            setLoading(false);
        }
    }, [selectedCategoryId, stageNumber]);

    const refreshStandings = useCallback(async () => {
        if (!selectedCategoryId) return;
        try {
            const data = await teamLeagueApi.getGroupStandings(selectedCategoryId, stageNumber);
            setStandings(Array.isArray(data) ? data : []);
        } catch {
            setStandings([]);
        }
    }, [selectedCategoryId, stageNumber]);

    // Derive which stages actually exist (a stage only appears once it has groups —
    // e.g. Stage 2 shows up only after teams have been advanced into it).
    const refreshStages = useCallback(async () => {
        if (!selectedCategoryId) { setAvailableStages([1]); return; }
        try {
            const overview = await teamLeagueApi.getOverview(selectedCategoryId);
            const stages: number[] = (overview?.stages || [])
                .map((s: any) => s.stageNumber)
                .filter((n: any) => typeof n === 'number');
            setAvailableStages(stages.length > 0 ? Array.from(new Set(stages)).sort((a, b) => a - b) : [1]);
        } catch {
            setAvailableStages([1]);
        }
    }, [selectedCategoryId]);

    useEffect(() => {
        if (selectedCategoryId) {
            refreshGroups();
            refreshStandings();
            refreshStages();
        }
    }, [selectedCategoryId, stageNumber, refreshGroups, refreshStandings, refreshStages]);

    if (teamLeagueCategories.length === 0) {
        return (
            <section className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <div className="text-center p-8">
                    <Users className="h-10 w-10 text-gray-500 mx-auto mb-3 opacity-50" />
                    <p className="text-gray-400 font-medium">No team league categories found.</p>
                    <p className="text-sm text-gray-500 mt-1">Create a category with "Team League" bracket type first.</p>
                </div>
            </section>
        );
    }

    const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
        { key: 'groups', label: 'Groups', icon: Users },
        { key: 'ties', label: 'Ties & Matches', icon: Swords },
        { key: 'standings', label: 'Standings', icon: BarChart3 },
        { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    ];

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Trophy className="h-5 w-5" />
                    </div>
                    <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Team League</h2>
                </div>

                {/* Category selector */}
                {teamLeagueCategories.length > 1 && (
                    <select
                        value={selectedCategoryId}
                        onChange={(e) => { setSelectedCategoryId(e.target.value); setStageNumber(1); }}
                        className="flex h-10 rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
                    >
                        {teamLeagueCategories.map(c => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Stage selector — only stages that exist for this category */}
            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Stage:</span>
                {availableStages.map(s => (
                    <button
                        key={s}
                        onClick={() => setStageNumber(s)}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                            stageNumber === s
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        Stage {s}
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-black/30 rounded-xl p-1">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg flex-1 justify-center transition-colors ${
                            activeTab === tab.key
                                ? 'bg-primary/20 text-primary'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {activeTab === 'groups' && (
                        <GroupConfigPanel
                            categoryId={selectedCategoryId}
                            categoryStatus={selectedCategory?.status || ''}
                            groups={groups}
                            teams={teams}
                            onRefresh={refreshGroups}
                            setError={setError}
                        />
                    )}
                    {activeTab === 'ties' && (
                        <TieManagementPanel
                            categoryId={selectedCategoryId}
                            groups={groups}
                            teams={teams}
                            categoryConfig={selectedCategory?.teamLeagueConfig}
                            onRefresh={() => { refreshGroups(); refreshStandings(); }}
                            setError={setError}
                        />
                    )}
                    {activeTab === 'standings' && (
                        <GroupStandingsTable
                            categoryId={selectedCategoryId}
                            stageNumber={stageNumber}
                            standings={standings}
                            groups={groups}
                            topNPerGroup={selectedCategory?.teamLeagueConfig?.topNPerGroup || 1}
                            onRefresh={refreshStandings}
                            onAdvanced={() => {
                                refreshStages();
                                setStageNumber(stageNumber + 1);
                                setActiveTab('ties');
                                refreshGroups();
                                refreshStandings();
                            }}
                            setError={setError}
                        />
                    )}
                    {activeTab === 'overview' && (
                        <OverallView
                            categoryId={selectedCategoryId}
                            teams={teams}
                            setError={setError}
                        />
                    )}
                </>
            )}
        </section>
    );
}
