import { useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Plus, Shuffle, X } from 'lucide-react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import { CHOICE, ConfirmBar, Drawer, EmptyState, INPUT, INPUT_SM, Notice, PANEL, Spinner, TeamLogo, useReadOnly } from '@/pages/organizer/ui';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, FOCUS } from '@/pages/organizer/shared';
import { cn } from '@/lib/utils';

interface Team {
    _id: string;
    name: string;
    logo?: string;
    primaryColor?: string;
}

interface Group {
    _id: string;
    groupName: string;
    groupNumber: number;
    teamIds: string[];
    teams?: (Team | null)[];
}

interface Props {
    categoryId: string;
    categoryStatus: string;
    stageNumber: number;
    groups: Group[] | null;
    teams: Team[];
    onRefresh: () => void;
    setError: (err: string | null) => void;
}

// Mirrors the server (teamLeague.service configureGroups): stage-1 groups can be set and
// reset while the category is in auction or groups_configured, i.e. until play starts.
const EDITABLE_STATUSES = ['auction', 'groups_configured'];

const clampGroups = (v: string) => Math.min(10, Math.max(1, Math.round(Number(v)) || 1));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function GroupConfigPanel({ categoryId, categoryStatus, stageNumber, groups, teams, onRefresh, setError }: Props) {
    const [confirmRandomize, setConfirmRandomize] = useState(false);
    const [groupCount, setGroupCount] = useState('2');
    const [randomizing, setRandomizing] = useState(false);
    const [editing, setEditing] = useState(false);
    const readOnly = useReadOnly();

    const canConfigure = !readOnly && EDITABLE_STATUSES.includes(categoryStatus) && stageNumber === 1;

    const randomize = async () => {
        setRandomizing(true);
        setError(null);
        try {
            await teamLeagueApi.randomizeGroups(categoryId, clampGroups(groupCount));
            setConfirmRandomize(false);
            onRefresh();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to randomize groups');
        } finally {
            setRandomizing(false);
        }
    };

    if (!groups) return <Spinner label="Loading groups" />;

    const teamIn = (g: Group, id: string) => teams.find(t => t._id === id) ?? g.teams?.find(t => t?._id === id);
    const assigned = new Set(groups.flatMap(g => g.teamIds));
    const unassigned = teams.filter(t => !assigned.has(t._id));

    return (
        <div className="space-y-4">
            {canConfigure && (
                <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setConfirmRandomize(true)} className={BTN_SECONDARY}>
                        <Shuffle aria-hidden className="h-4 w-4" />Randomize groups
                    </button>
                    <button type="button" onClick={() => setEditing(true)} className={BTN_SECONDARY}>
                        <Pencil aria-hidden className="h-4 w-4" />{groups.length ? 'Edit groups' : 'Set up groups'}
                    </button>
                </div>
            )}

            {confirmRandomize && (
                <div className={cn(PANEL, 'overflow-hidden')}>
                    <ConfirmBar
                        className="border-t-0"
                        message={<>
                            Randomize teams into{' '}
                            <input type="number" min={1} max={10} aria-label="Number of groups" value={groupCount}
                                onChange={e => setGroupCount(e.target.value)} onBlur={() => setGroupCount(String(clampGroups(groupCount)))}
                                className={cn(INPUT_SM, 'w-14 text-center')} />
                            {' '}groups?{groups.length > 0 && ' This replaces the current groups.'}
                        </>}
                        confirmLabel="Randomize"
                        onConfirm={randomize}
                        onCancel={() => setConfirmRandomize(false)}
                        busy={randomizing}
                    />
                </div>
            )}

            {groups.length === 0 ? (
                <div className={PANEL}>
                    <EmptyState title="No groups yet" text={canConfigure
                        ? 'Randomize teams into groups, or set them up yourself.'
                        : stageNumber > 1 ? 'This stage has no groups.' : 'Groups can be set up while the category is in the auction stage.'} />
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {groups.map(g => (
                        <section key={g._id} aria-label={g.groupName} className={PANEL}>
                            <div className="flex items-baseline gap-2 border-b border-line px-4 py-3">
                                <h3 className="text-sm font-semibold text-fg">{g.groupName}</h3>
                                <span className="text-[13px] text-fg-subtle">{plural(g.teamIds.length, 'team')}</span>
                            </div>
                            <ul className="divide-y divide-line">
                                {g.teamIds.map(id => {
                                    const t = teamIn(g, id);
                                    const name = t?.name ?? 'Unknown team';
                                    return (
                                        <li key={id} className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] text-fg">
                                            <TeamLogo size="sm" name={name} logo={t?.logo} color={t?.primaryColor} />
                                            <span className="truncate">{name}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            {stageNumber === 1 && groups.length > 0 && unassigned.length > 0 && (
                <Notice tone="amber" icon={AlertTriangle}>
                    {unassigned.length === 1 ? "1 team isn't" : `${unassigned.length} teams aren't`} in any group: {unassigned.map(t => t.name).join(', ')}.
                </Notice>
            )}

            {editing && (
                <EditGroupsDrawer
                    categoryId={categoryId}
                    groups={groups}
                    teams={teams}
                    onClose={() => setEditing(false)}
                    onSaved={() => { setEditing(false); onRefresh(); }}
                />
            )}
        </div>
    );
}

function EditGroupsDrawer({ categoryId, groups, teams, onClose, onSaved }: {
    categoryId: string; groups: Group[]; teams: Team[]; onClose: () => void; onSaved: () => void;
}) {
    const [draft, setDraft] = useState(() => groups.length
        ? groups.map(g => ({ name: g.groupName, teamIds: [...g.teamIds] }))
        : [{ name: 'Group A', teamIds: [] as string[] }, { name: 'Group B', teamIds: [] as string[] }]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const update = (i: number, patch: Partial<{ name: string; teamIds: string[] }>) =>
        setDraft(d => d.map((g, j) => (j === i ? { ...g, ...patch } : g)));
    const toggle = (i: number, id: string) =>
        update(i, { teamIds: draft[i].teamIds.includes(id) ? draft[i].teamIds.filter(x => x !== id) : [...draft[i].teamIds, id] });

    const save = async () => {
        if (draft.some(g => !g.name.trim())) { setError('Every group needs a name.'); return; }
        if (draft.some(g => g.teamIds.length === 0)) { setError('Every group needs at least one team.'); return; }
        setSaving(true);
        setError(null);
        try {
            await teamLeagueApi.configureGroups(categoryId, draft.map(g => ({ name: g.name.trim(), teamIds: g.teamIds })));
            onSaved();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to save groups');
            setSaving(false);
        }
    };

    const unassigned = teams.filter(t => !draft.some(g => g.teamIds.includes(t._id))).length;

    return (
        <Drawer wide title="Edit groups" description="Tick the teams that play in each group. A team can be in one group only." onClose={onClose}
            footer={<>
                {error && <p role="alert" className="mr-auto min-w-0 text-[13px] text-red-300">{error}</p>}
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY}>
                    {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}Save groups
                </button>
            </>}>
            <div className="grid gap-5">
                {teams.length === 0
                    ? <Notice tone="amber" icon={AlertTriangle}>This tournament has no teams yet.</Notice>
                    : unassigned > 0 && <p className="text-[13px] text-fg-muted">{unassigned === 1 ? '1 team is' : `${unassigned} teams are`} not in a group yet.</p>}
                {draft.map((g, i) => (
                    <section key={i} className="grid gap-3 border-t border-line pt-5 first:border-t-0 first:pt-0">
                        <div className="flex items-center gap-2">
                            <input aria-label={`Group ${i + 1} name`} value={g.name} onChange={e => update(i, { name: e.target.value })} className={INPUT} />
                            <button type="button" aria-label={`Remove ${g.name || `group ${i + 1}`}`} disabled={draft.length === 1}
                                onClick={() => setDraft(d => d.filter((_, j) => j !== i))}
                                className={cn(BTN_GHOST, 'w-9 px-0')}>
                                <X aria-hidden className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {teams.map(t => {
                                const other = draft.findIndex((x, j) => j !== i && x.teamIds.includes(t._id));
                                return (
                                    <label key={t._id} className={cn(CHOICE, 'items-center')}>
                                        <input type="checkbox" className={cn('accent-primary', FOCUS)} checked={g.teamIds.includes(t._id)}
                                            disabled={other >= 0} onChange={() => toggle(i, t._id)} />
                                        <TeamLogo size="sm" name={t.name} logo={t.logo} color={t.primaryColor} />
                                        <span className="min-w-0">
                                            <span className="block truncate text-[13px] font-medium text-fg">{t.name}</span>
                                            {other >= 0 && <span className="block truncate text-xs text-fg-subtle">In {draft[other].name || `group ${other + 1}`}</span>}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </section>
                ))}
                <button type="button" onClick={() => setDraft(d => [...d, { name: `Group ${String.fromCharCode(65 + d.length)}`, teamIds: [] }])}
                    className={cn(BTN_SECONDARY, 'justify-self-start')}>
                    <Plus aria-hidden className="h-4 w-4" />Add group
                </button>
            </div>
        </Drawer>
    );
}
