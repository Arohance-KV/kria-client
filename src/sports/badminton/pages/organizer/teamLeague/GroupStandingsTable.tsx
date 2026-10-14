import { useState } from 'react';
import { AlertCircle, Trophy } from 'lucide-react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import { CHOICE, ConfirmBar, EmptyState, Field, INPUT, Notice, PANEL, Spinner, TeamLogo, useReadOnly } from '@/pages/organizer/ui';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/pages/organizer/shared';
import { cn } from '@/lib/utils';

interface Team { _id: string; name: string; logo?: string; primaryColor?: string }

interface StandingEntry {
    teamId: string;
    teamName: string;
    played: number;
    won: number;
    lost: number;
    drawn: number;
    points: number;
    subMatchesWon: number;
    subMatchesLost: number;
    rank: number;
}

interface GroupStanding {
    group: { _id: string; groupName: string; groupNumber: number };
    standings: StandingEntry[];
    totalTies: number;
    completedTies: number;
}

interface Props {
    categoryId: string;
    stageNumber: number;
    standings: GroupStanding[] | null;
    teams: Team[];
    topNPerGroup: number;
    onAdvanced: () => void;
}

const COLUMNS: { key: keyof StandingEntry; label: string; title: string; compact?: boolean }[] = [
    { key: 'played', label: 'P', title: 'Played', compact: true },
    { key: 'won', label: 'W', title: 'Won', compact: true },
    { key: 'lost', label: 'L', title: 'Lost', compact: true },
    { key: 'drawn', label: 'D', title: 'Drawn', compact: true },
    { key: 'subMatchesWon', label: 'SM+', title: 'Sub-matches won' },
    { key: 'subMatchesLost', label: 'SM−', title: 'Sub-matches lost' },
    { key: 'points', label: 'Pts', title: 'Points', compact: true },
];

const CELL = 'px-2.5 text-right';

/** Standings table; `compact` keeps # Team P W L D Pts for the overview. */
export function StandingsTable({ rows, teams, compact, isQualified, championId }: {
    rows: StandingEntry[]; teams: Team[]; compact?: boolean; isQualified?: (e: StandingEntry, i: number) => boolean; championId?: string;
}) {
    const cols = COLUMNS.filter(c => !compact || c.compact);
    return (
        <div className="overflow-x-auto">
            <table className={cn('w-full border-collapse tabular-nums', compact ? 'text-[12.5px]' : 'min-w-[540px] text-[13px]')}>
                <thead>
                    <tr className="border-b border-line text-xs text-fg-subtle">
                        <th scope="col" className={cn(CELL, 'w-8 py-2 font-medium')}>#</th>
                        <th scope="col" className="px-2.5 py-2 text-left font-medium">Team</th>
                        {cols.map(c => (
                            <th key={c.key} scope="col" title={c.title} className={cn(CELL, 'py-2 font-medium')}>
                                <span aria-hidden>{c.label}</span><span className="sr-only">{c.title}</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((e, i) => {
                        const q = isQualified?.(e, i);
                        const t = teams.find(x => x._id === e.teamId);
                        return (
                            <tr key={e.teamId} className={cn('border-b border-line last:border-0', q && 'bg-emerald-400/[0.05]')}>
                                <td className={cn(CELL, 'py-2.5 text-fg-muted')}>{i + 1}</td>
                                <td className="px-2.5 py-2">
                                    <span className="flex min-w-0 items-center gap-2 text-fg">
                                        <TeamLogo size="sm" name={e.teamName} logo={t?.logo} color={t?.primaryColor} />
                                        <span className="truncate">{e.teamName}</span>
                                        {q && (
                                            <span title="Qualified" className="rounded px-1.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/25">
                                                <span aria-hidden>Q</span><span className="sr-only">Qualified</span>
                                            </span>
                                        )}
                                        {championId === e.teamId && <Trophy role="img" aria-label="Champion" className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                                    </span>
                                </td>
                                {cols.map(c => (
                                    <td key={c.key} className={cn(CELL, 'py-2.5', c.key === 'points' ? 'font-semibold text-fg' : 'text-fg-muted')}>{e[c.key]}</td>
                                ))}
                            </tr>
                        );
                    })}
                    {rows.length === 0 && (
                        <tr><td colSpan={cols.length + 2} className="py-4 text-center text-fg-subtle">No teams yet</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export const ChampionBanner = ({ entry }: { entry: StandingEntry }) => (
    <div className={cn(PANEL, 'flex flex-col items-center gap-1.5 px-6 py-8 text-center ring-1 ring-inset ring-amber-400/20')}>
        <Trophy aria-hidden className="mb-1 h-8 w-8 text-amber-300" />
        <p className="text-lg font-semibold text-fg">{entry.teamName}</p>
        <p className="text-[13px] font-medium text-amber-300">Team league champion</p>
        <p className="text-[13px] text-fg-muted">Won {entry.won} of {entry.played} ties · {entry.subMatchesWon} sub-matches won</p>
    </div>
);

export default function GroupStandingsTable({ categoryId, stageNumber, standings, teams, topNPerGroup, onAdvanced }: Props) {
    const [format, setFormat] = useState<'knockout' | 'groups'>('knockout');
    const [groupCount, setGroupCount] = useState('1');
    const [confirming, setConfirming] = useState(false);
    const [advancing, setAdvancing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const readOnly = useReadOnly();

    if (!standings) return <Spinner label="Loading standings" />;
    if (standings.length === 0) {
        return (
            <div className={PANEL}>
                <EmptyState title="No standings yet" text="Set up groups and play ties to see standings." />
            </div>
        );
    }

    const allComplete = standings.every(gs => gs.completedTies > 0 && gs.completedTies === gs.totalTies);
    const tiesLeft = standings.reduce((n, gs) => n + Math.max(0, gs.totalTies - gs.completedTies), 0);
    // A single group of two or fewer teams is the final: crown a champion instead of advancing.
    const totalTeams = standings.reduce((n, gs) => n + (gs.standings?.length || 0), 0);
    const isFinal = standings.length === 1 && totalTeams <= 2;
    const champion = allComplete && isFinal ? standings[0]?.standings?.[0] : null;
    // Rows arrive sorted; rank falls back to the row position.
    const inTopN = (e: StandingEntry, i: number) => (e.rank ?? i + 1) <= topNPerGroup;
    const isQualified = (e: StandingEntry, i: number) => allComplete && inTopN(e, i);

    // Top N from each group, by rank.
    const qualified = standings.flatMap(gs => (gs.standings || [])
        .filter(inTopN)
        .map(e => ({ teamId: e.teamId, teamName: e.teamName, groupName: gs.group.groupName })));
    const groupsToMake = Math.min(Math.max(1, qualified.length), Math.max(1, Math.round(Number(groupCount)) || 1));
    const next = stageNumber + 1;

    const advance = async () => {
        setAdvancing(true);
        setError(null);
        try {
            await teamLeagueApi.advanceTeams(categoryId, stageNumber, {
                format,
                numberOfGroups: format === 'groups' ? groupsToMake : undefined,
                teamAdvancement: qualified.map((t, idx) => ({
                    teamId: t.teamId,
                    ...(format === 'groups' ? { groupNumber: (idx % groupsToMake) + 1 } : {}),
                })),
            });
            setConfirming(false);
            onAdvanced();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to advance teams');
        } finally {
            setAdvancing(false);
        }
    };

    return (
        <div className="space-y-4">
            {champion && <ChampionBanner entry={champion} />}

            <div className="grid gap-3 xl:grid-cols-2">
                {standings.map(gs => (
                    <section key={gs.group._id} className={cn(PANEL, 'min-w-0')}>
                        <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-fg">
                            {gs.group.groupName} <span aria-hidden className="font-normal text-fg-subtle">·</span>{' '}
                            <span className="font-normal text-fg-subtle">{gs.completedTies} of {gs.totalTies} ties played</span>
                        </h3>
                        <div className="px-2 py-1">
                            <StandingsTable rows={gs.standings || []} teams={teams} isQualified={isQualified} />
                        </div>
                    </section>
                ))}
            </div>

            {!isFinal && !readOnly && (
                <section aria-label={`Advance to stage ${next}`} className={cn(PANEL, 'overflow-hidden')}>
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-fg">Advance to stage {next}</h3>
                            <p className="mt-0.5 text-[13px] text-fg-muted">
                                {allComplete
                                    ? `The top ${topNPerGroup} from each group move on.`
                                    : <>Available once every tie in stage {stageNumber} is played.{' '}
                                        {tiesLeft > 0 ? `${tiesLeft} tie${tiesLeft === 1 ? '' : 's'} left.` : 'Some groups have no ties yet.'}{' '}
                                        The top {topNPerGroup} from each group move on.</>}
                            </p>
                        </div>
                        {!allComplete && <button type="button" disabled className={BTN_SECONDARY}>Advance teams</button>}
                    </div>

                    {allComplete && <>
                        <div className="grid gap-4 border-t border-line p-4">
                            <Field label={`Qualified teams (${qualified.length})`}>
                                <ul className="flex flex-wrap gap-2">
                                    {qualified.map(q => {
                                        const t = teams.find(x => x._id === q.teamId);
                                        return (
                                            <li key={q.teamId} className="flex items-center gap-2 rounded-lg bg-canvas py-1 pl-1 pr-2.5 text-[13px] text-fg ring-1 ring-inset ring-line">
                                                <TeamLogo size="sm" name={q.teamName} logo={t?.logo} color={t?.primaryColor} />
                                                {q.teamName}<span className="text-fg-subtle">{q.groupName}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Field>
                            <Field label="Next stage format">
                                <div role="radiogroup" aria-label="Next stage format" className="grid gap-2 sm:grid-cols-2">
                                    {([
                                        { value: 'knockout', title: 'Knockout', text: 'Single elimination. Top seeds get byes when needed.' },
                                        { value: 'groups', title: 'New groups', text: 'A fresh round robin in new groups.' },
                                    ] as const).map(o => (
                                        <label key={o.value} className={CHOICE}>
                                            <input type="radio" name="advance-format" className="mt-0.5 accent-primary"
                                                checked={format === o.value} onChange={() => setFormat(o.value)} />
                                            <span>
                                                <span className="block text-sm font-medium text-fg">{o.title}</span>
                                                <span className="mt-0.5 block text-[13px] text-fg-muted">{o.text}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </Field>
                            {format === 'groups' && (
                                <Field id="advance-groups" label="Number of groups">
                                    <input id="advance-groups" type="number" min={1} max={Math.max(1, qualified.length)} value={groupCount}
                                        onChange={e => setGroupCount(e.target.value)} onBlur={() => setGroupCount(String(groupsToMake))}
                                        className={cn(INPUT, 'w-24')} />
                                </Field>
                            )}
                            {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}
                        </div>
                        {confirming ? (
                            <ConfirmBar
                                message={`Move ${qualified.length} teams to stage ${next}? This can't be undone.`}
                                confirmLabel="Advance teams"
                                onConfirm={advance}
                                onCancel={() => setConfirming(false)}
                                busy={advancing}
                            />
                        ) : (
                            <div className="flex justify-end border-t border-line px-4 py-3">
                                <button type="button" disabled={qualified.length === 0} onClick={() => setConfirming(true)} className={BTN_PRIMARY}>
                                    Advance teams
                                </button>
                            </div>
                        )}
                    </>}
                </section>
            )}
        </div>
    );
}
