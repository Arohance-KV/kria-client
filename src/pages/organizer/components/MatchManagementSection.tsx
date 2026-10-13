import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, ExternalLink, Lock, Network } from 'lucide-react';
import { sportRegistry } from '@/sports/registry';
import { getC1, getC2, isHiddenBye } from '@/lib/bracketLayout';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/hooks';
import { BTN_GHOST, BTN_SECONDARY, ToneBadge } from '../shared';
import { CategoryTabs, COLHEAD, EmptyState, Notice, PageHead, PANEL, ROW, SegTabs, Spinner, Toolbar, categoryMeta, useSectionNav } from '../ui';
import {
    ScoreboardLink, errorMessage, fetchCategoryMatches, gamesText, isDone, matchStatus, sortedRounds,
    type BracketMatch, type CompetitorType, type MatchesPayload, type ResultSlot,
} from './BracketManagementSection';

interface CategoryInfo { _id: string; name: string; status: string; sport?: string }

interface Props {
    tournamentId: string;
    sports: string[];
    categories: CategoryInfo[];
}

type Filter = 'all' | 'upcoming' | 'live' | 'completed';

const ELIGIBLE = ['auction', 'bracket_configured', 'ongoing', 'completed'];
const FILTER_OF: Record<string, Filter> = { scheduled: 'upcoming', in_progress: 'live', completed: 'completed', walkover: 'completed' };
const FILTER_LABEL: Record<Filter, string> = { all: 'All', upcoming: 'Upcoming', live: 'Live', completed: 'Completed' };

// Match no. | players | games | status | actions — stacked below sm, two columns until xl.
const COLS = 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,12rem)_6.5rem_17rem]';

const EMPTY: MatchesPayload = { matches: [], rounds: {}, competitorType: 'player' };

const MatchManagementSection: React.FC<Props> = ({ sports, categories }) => {
    const goTo = useSectionNav();
    // The host passes no bracketType here; the same store it reads categories from has it.
    const bracketTypes = useAppSelector(s => s.registration.categories);
    const bracketTypeOf = (id: string) => bracketTypes.find(c => c._id === id)?.bracketType;
    // Team-league matches are ties, scored from Team league.
    const eligible = categories.filter(c => ELIGIBLE.includes(c.status) && bracketTypeOf(c._id) !== 'team_league');

    const [selectedCat, setSelectedCat] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [data, setData] = useState<MatchesPayload>(EMPTY);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Categories can arrive after mount, and the selected one can stop being eligible.
    useEffect(() => {
        if (eligible.some(c => c._id === selectedCat)) return;
        setSelectedCat(eligible[0]?._id ?? '');
    }, [eligible, selectedCat]);

    const category = categories.find(c => c._id === selectedCat);
    const ResultSection = sportRegistry.get(category?.sport || sports[0])?.matchResultSection;

    const current = useRef(selectedCat);
    current.current = selectedCat;

    const load = useCallback(async (quiet = false) => {
        const cat = selectedCat;
        if (!cat) return;
        if (!quiet) { setLoading(true); setData(EMPTY); }
        try {
            const next = await fetchCategoryMatches(cat);
            if (current.current !== cat) return;
            setData(next);
            setLoadError(null);
        } catch (err) {
            if (current.current === cat) setLoadError(errorMessage(err, 'Could not load matches.'));
        } finally {
            if (current.current === cat && !quiet) setLoading(false);
        }
    }, [selectedCat]);

    useEffect(() => { setLoadError(null); setLoading(false); setFilter('all'); load(); }, [load]);

    const refresh = useCallback(() => load(true), [load]);

    const { matches, rounds, competitorType } = data;
    const visible = matches.filter(m => !isHiddenBye(m));
    const count = (f: Filter) => visible.filter(m => f === 'all' || FILTER_OF[m.status] === f).length;
    const shown = (m: BracketMatch) => filter === 'all' || FILTER_OF[m.status] === filter;
    const groups = sortedRounds(rounds)
        .map(name => [name, (rounds[name] || []).filter(m => !isHiddenBye(m) && shown(m))] as const)
        .filter(([, ms]) => ms.length > 0);
    const hasGames = matches.some(m => m.gameScores?.length);
    const hasResults = matches.some(m => m.status === 'completed');
    const config = matches[0]?.matchConfig;
    const configText = [config?.bestOf && `Best of ${config.bestOf}`, config?.pointsToWin && `${config.pointsToWin} points`].filter(Boolean).join(' · ');

    const toBrackets = <button type="button" onClick={() => goTo('brackets')} className={BTN_SECONDARY}>Open Brackets</button>;

    const body = () => {
        if (loading) return <Spinner label="Loading matches" />;
        if (loadError && !matches.length) {
            return (
                <div className="p-4">
                    <div role="alert"><Notice tone="red" icon={CircleAlert}>Couldn't load matches. {loadError}</Notice></div>
                    <button type="button" onClick={() => load()} className={cn(BTN_SECONDARY, 'mt-3')}>Try again</button>
                </div>
            );
        }
        if (!visible.length) return <EmptyState title="No fixtures yet" text="Generate the bracket in Brackets." action={toBrackets} />;
        return (
            <>
                <Toolbar>
                    <SegTabs<Filter>
                        label="Match status"
                        value={filter}
                        onChange={setFilter}
                        items={(Object.keys(FILTER_LABEL) as Filter[]).map(k => ({ key: k, label: FILTER_LABEL[k], count: count(k) }))}
                    />
                    {hasResults ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-subtle">
                            <Lock aria-hidden className="h-3.5 w-3.5" />Draw locked: results are in
                        </span>
                    ) : configText && <span className="text-[12.5px] text-fg-subtle">{configText}</span>}
                </Toolbar>
                {loadError && <div role="alert" className="p-3"><Notice tone="red" icon={CircleAlert}>Couldn't refresh matches. {loadError}</Notice></div>}
                <div className={cn(COLHEAD, 'hidden xl:grid', COLS)}>
                    <span>Match</span><span>Players</span><span>{hasGames ? 'Games' : 'Result'}</span><span>Status</span><span className="sr-only">Actions</span>
                </div>
                {groups.length === 0 ? (
                    <EmptyState title={`No ${FILTER_LABEL[filter].toLowerCase()} matches`} text="Pick another status to see the rest." />
                ) : (
                    <div className="divide-y divide-line">
                        {groups.map(([round, ms]) => (
                            <section key={round} aria-label={round}>
                                <h3 className="border-b border-line bg-white/[0.015] px-4 py-2.5 text-xs font-medium text-fg-subtle sm:px-5">{round}</h3>
                                <ul className="divide-y divide-line">
                                    {ms.map(m => (
                                        <MatchRow key={m._id} match={m} competitorType={competitorType} ResultSection={ResultSection} onRecorded={refresh} />
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="flex flex-col gap-5">
            <PageHead
                title="Matches"
                desc="Every fixture with its result. Score matches live or enter the final result."
                actions={<button type="button" onClick={() => goTo('brackets')} className={BTN_GHOST}><Network aria-hidden className="h-4 w-4" />View bracket</button>}
            />
            {eligible.length === 0 ? (
                <section className={PANEL}>
                    <EmptyState title="No fixtures yet" text="Generate the bracket in Brackets. Team league ties are scored in Team league." action={toBrackets} />
                </section>
            ) : (
                <>
                    <CategoryTabs
                        categories={eligible.map(c => ({ _id: c._id, name: c.name, meta: categoryMeta(bracketTypeOf(c._id), c.status) }))}
                        value={selectedCat}
                        onChange={setSelectedCat}
                    />
                    <section className={PANEL} aria-label="Matches">{body()}</section>
                </>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH ROW
// ═══════════════════════════════════════════════════════════════════════════════

const MatchRow = ({ match, competitorType, ResultSection, onRecorded }: {
    match: BracketMatch; competitorType: CompetitorType; ResultSection?: ResultSlot; onRecorded: () => void;
}) => {
    const c1 = getC1(match, competitorType);
    const c2 = getC2(match, competitorType);
    const waiting = c1.isTBD || c2.isTBD;
    const done = isDone(match);
    const status = matchStatus(match, waiting);
    // Badminton reports game scores; cricket only a margin ("Won by 23 runs").
    const games = gamesText(match) || (done ? match.result?.marginOfVictory ?? '' : '');
    const badge = <ToneBadge label={status.label} tone={status.tone} live={status.live} />;

    const side = (c: typeof c1, score?: number) => {
        const win = done && !!match.winnerId && match.winnerId === c.id;
        return (
            <div className="min-w-0">
                <p className="flex min-w-0 items-center gap-2 text-sm">
                    <span className={cn('truncate', c.isTBD ? 'italic text-fg-subtle' : win ? 'font-semibold text-fg' : 'text-fg-muted')}>
                        {c.isTBD ? 'To be decided' : c.name}
                    </span>
                    {score != null && <span className="text-xs tabular-nums text-fg-subtle">{score}</span>}
                    {win && <><Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-emerald-400" /><span className="sr-only">(winner)</span></>}
                </p>
                {competitorType === 'player' && c.teamName && !c.isTBD && <p className="truncate text-xs text-fg-subtle">{c.teamName}</p>}
            </div>
        );
    };

    return (
        <li className={cn(ROW, COLS)}>
            <span className="hidden text-[13.5px] tabular-nums text-fg-muted xl:block">Match {match.matchNumber}</span>
            <div className="grid min-w-0 gap-1">
                {side(c1, match.result?.team1Total)}
                {side(c2, match.result?.team2Total)}
                <div className="mt-1 flex flex-wrap items-center gap-2 xl:hidden">
                    <span className="text-xs text-fg-subtle">Match {match.matchNumber}</span>
                    {badge}
                    {games && <span className="text-[12.5px] tabular-nums text-fg-subtle">{games}</span>}
                </div>
            </div>
            <span className="hidden truncate text-[12.5px] tabular-nums text-fg-subtle xl:block">{games || '—'}</span>
            <span className="hidden xl:block">{badge}</span>
            {/* A confirm or error from the scoring slot takes the row's full width. */}
            <div className="flex flex-wrap items-center gap-1.5 sm:justify-end has-[[role=alert]]:col-span-full has-[[role=alertdialog]]:col-span-full">
                {waiting
                    ? <span className="text-[12.5px] text-fg-subtle">Waiting for players</span>
                    : ResultSection && <ResultSection match={match} competitorType={competitorType} onRecorded={onRecorded} />}
                {!waiting && (
                    <ScoreboardLink matchId={match._id} label="Open live scoreboard"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-white/[0.05] hover:text-fg">
                        <ExternalLink aria-hidden className="h-4 w-4" />
                    </ScoreboardLink>
                )}
            </div>
        </li>
    );
};

export default MatchManagementSection;
