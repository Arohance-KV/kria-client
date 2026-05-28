import React, { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { cricketMatchApi } from '@/sports/cricket/api/cricketMatch';
import { recordLineup } from '@/sports/cricket/store/cricketLiveStateSlice';

interface Props {
    matchId: string;
    team: { id: string; name: string };
    playersPerTeam: number;
}

interface RosterPlayer {
    _id: string;
    name?: string;
    profile?: { firstName?: string; lastName?: string };
}

// The roster endpoint returns raw TournamentRegistration docs whose names live
// under `profile`. Mirror the server's slot-name logic, with a safe fallback.
const playerName = (p: RosterPlayer): string =>
    p.name?.trim()
    || `${p.profile?.firstName ?? ''} ${p.profile?.lastName ?? ''}`.trim()
    || 'Unknown';

export default function LineupSetup({ matchId, team, playersPerTeam }: Props) {
    const dispatch = useAppDispatch();
    const [players, setPlayers] = useState<RosterPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [startingXI, setStartingXI] = useState<string[]>([]);
    const [reserves, setReserves] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        cricketMatchApi.getTeamRoster(team.id)
            .then((data: any) => { if (active) setPlayers(data?.players || []); })
            .catch(() => { if (active) setError('Failed to load team roster.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [team.id]);

    const toggleXI = (id: string) => {
        setStartingXI(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        setReserves(prev => prev.filter(x => x !== id));
    };
    const toggleReserve = (id: string) => {
        setReserves(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        setStartingXI(prev => prev.filter(x => x !== id));
    };

    const submit = async () => {
        if (startingXI.length === 0) return;
        setSaving(true); setError(null);
        try {
            await dispatch(recordLineup({ matchId, payload: { teamId: team.id, startingXI, reserves } })).unwrap();
        } catch (e: any) {
            setError(e?.message || 'Failed to save lineup.');
        } finally { setSaving(false); }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

    return (
        <div className="max-w-2xl mx-auto bg-black/30 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Lineup — {team.name}</h3>
                <span className={`text-sm font-semibold ${startingXI.length === playersPerTeam ? 'text-emerald-400' : 'text-gray-400'}`}>
                    Starting XI: {startingXI.length}/{playersPerTeam}
                </span>
            </div>
            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
                {players.map(p => {
                    const inXI = startingXI.includes(p._id);
                    const inRes = reserves.includes(p._id);
                    return (
                        <div key={p._id} className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                            <span className="text-sm text-white">{playerName(p)}</span>
                            <div className="flex gap-2">
                                <button onClick={() => toggleXI(p._id)} className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 ${inXI ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                                    {inXI && <Check className="h-3 w-3" />} XI
                                </button>
                                <button onClick={() => toggleReserve(p._id)} className={`px-3 py-1 rounded text-xs font-bold ${inRes ? 'bg-amber-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                                    Reserve
                                </button>
                            </div>
                        </div>
                    );
                })}
                {players.length === 0 && <p className="text-sm text-gray-500 text-center p-4">No players found on this team's roster.</p>}
            </div>

            <button onClick={submit} disabled={startingXI.length === 0 || saving} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold disabled:opacity-40">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Lineup
            </button>
            {startingXI.length !== playersPerTeam && startingXI.length > 0 && (
                <p className="text-xs text-amber-400 text-center">Note: expected {playersPerTeam} players; you selected {startingXI.length}. You can still save.</p>
            )}
        </div>
    );
}
