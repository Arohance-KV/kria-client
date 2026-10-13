import { useEffect, useState } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store/hooks';
import { BTN_PRIMARY } from '@/pages/organizer/shared';
import { Avatar, Notice, PANEL, Segmented, Spinner } from '@/pages/organizer/ui';
import { cricketMatchApi } from '@/sports/cricket/api/cricketMatch';
import { recordLineup } from '@/sports/cricket/store/cricketLiveStateSlice';

interface Props {
    matchId: string;
    team: { id: string; name: string };
    /** Exactly this many must play: the server's rule (match.matchConfig.playersPerTeam ?? 11). */
    playersPerTeam: number;
}

interface RosterPlayer {
    _id: string;
    name?: string;
    status?: string;
    profile?: { firstName?: string; lastName?: string; photo?: string };
}

type Pick = 'xi' | 'res' | 'out';

// The roster endpoint returns raw TournamentRegistration docs whose names live
// under `profile`. Mirror the server's slot-name logic, with a safe fallback.
const playerName = (p: RosterPlayer): string =>
    p.name?.trim()
    || `${p.profile?.firstName ?? ''} ${p.profile?.lastName ?? ''}`.trim()
    || 'Unknown';

// The server only lets auctioned or assigned registrations play.
const BLOCKED: Record<string, string> = {
    pending: 'Registration not approved yet',
    approved: 'Not assigned to this team yet',
    rejected: 'Registration rejected',
    withdrawn: 'Withdrew from the tournament',
};
const blockedReason = (p: RosterPlayer) =>
    p.status && p.status !== 'auctioned' && p.status !== 'assigned' ? (BLOCKED[p.status] ?? `Not eligible (${p.status})`) : null;

export default function LineupSetup({ matchId, team, playersPerTeam: n }: Props) {
    const dispatch = useAppDispatch();
    const [players, setPlayers] = useState<RosterPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [pick, setPick] = useState<Record<string, Pick>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        cricketMatchApi.getTeamRoster(team.id)
            .then((data: any) => { if (active) setPlayers(data?.players || []); })
            .catch(() => { if (active) setError('Failed to load the team roster.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [team.id]);

    const idsWith = (v: Pick) => players.filter(p => !blockedReason(p) && pick[p._id] === v).map(p => p._id);
    const startingXI = idsWith('xi');
    const reserves = idsWith('res');
    const ok = startingXI.length === n;

    const submit = async () => {
        if (!ok) return;
        setSaving(true); setError(null);
        try {
            await dispatch(recordLineup({ matchId, payload: { teamId: team.id, startingXI, reserves } })).unwrap();
        } catch (e: any) {
            setError(e?.message || 'Failed to save the lineup.');
        } finally { setSaving(false); }
    };

    if (loading) return <Spinner label="Loading roster" />;

    return (
        <section className={cn(PANEL, 'overflow-hidden')}>
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
                <div>
                    <h1 className="text-lg font-semibold">{team.name} lineup</h1>
                    <p className="mt-0.5 text-[13px] text-fg-muted">Pick exactly {n} to play. Reserves can come in as substitutes.</p>
                </div>
                <p className="text-[13px] tabular-nums">
                    <span className={ok ? 'text-emerald-300' : 'text-amber-300'}>Playing {startingXI.length} / {n}</span>
                    <span className="text-fg-subtle"> · Reserves {reserves.length}</span>
                </p>
            </header>
            {error && <Notice tone="red" icon={CircleAlert} className="m-4">{error}</Notice>}
            <ul className="divide-y divide-line">
                {players.map(p => {
                    const name = playerName(p);
                    const blocked = blockedReason(p);
                    return (
                        <li key={p._id} className={cn('flex items-center gap-3 px-4 py-2 sm:px-5', blocked && 'opacity-50')}>
                            <Avatar name={name} src={p.profile?.photo} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium">{name}</p>
                                {blocked && <p className="text-[11px] text-fg-subtle">{blocked}</p>}
                            </div>
                            {blocked ? <span className="text-xs text-fg-subtle">Can&apos;t play</span> : (
                                <div className="w-[200px] shrink-0 [&_label]:py-1 [&_label]:text-xs">
                                    <Segmented name={`lineup-${p._id}`} label={name} value={pick[p._id] ?? 'out'}
                                        onChange={v => setPick(prev => ({ ...prev, [p._id]: v }))}
                                        options={[{ value: 'xi', label: 'Playing' }, { value: 'res', label: 'Reserve' }, { value: 'out', label: 'Out' }]} />
                                </div>
                            )}
                        </li>
                    );
                })}
                {players.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-fg-subtle">No players found on this team&apos;s roster.</li>}
            </ul>
            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-3 sm:px-5">
                {!ok && (
                    <span className="mr-auto text-[13px] text-amber-300">
                        {startingXI.length > n ? `Remove ${startingXI.length - n} from playing.` : `Add ${n - startingXI.length} more to playing.`}
                    </span>
                )}
                <button type="button" disabled={!ok || saving} onClick={submit} className={BTN_PRIMARY}>
                    {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}Save {team.name} lineup
                </button>
            </footer>
        </section>
    );
}
