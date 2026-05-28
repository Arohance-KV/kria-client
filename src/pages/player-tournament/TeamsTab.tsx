import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink, Lock, MessageCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Team } from '../../store/slices/teamSlice';
import API from '../../api/axios';

interface RosterPlayer {
    _id: string;
    profile: {
        firstName: string;
        lastName: string;
        gender: string;
        skillLevel?: string;
        age?: number;
    };
    auctionData?: { soldPrice?: number };
    status: string;
}

interface Props {
    teams: Team[];
    isTeamsLoading: boolean;
    myTeam: Team | null | undefined;
}

const TeamsTab: React.FC<Props> = ({ teams, isTeamsLoading, myTeam }) => {
    // Expand player's team by default
    const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
    const [rosters, setRosters] = useState<Record<string, RosterPlayer[]>>({});
    const [loadingRoster, setLoadingRoster] = useState<Record<string, boolean>>({});
    const fetchedRef = useRef<Set<string>>(new Set());

    const fetchRoster = async (teamId: string) => {
        if (fetchedRef.current.has(teamId)) return;
        fetchedRef.current.add(teamId);
        setLoadingRoster(p => ({ ...p, [teamId]: true }));
        try {
            const res = await API.get(`/registrations/teams/${teamId}/roster`);
            // Server wraps: { data: { success, message, data: { team, players, totalPlayers } } }
            const payload = res.data?.data?.data || res.data?.data || {};
            const players = Array.isArray(payload?.players) ? payload.players : [];
            setRosters(p => ({ ...p, [teamId]: players }));
        } catch {
            setRosters(p => ({ ...p, [teamId]: [] }));
        } finally {
            setLoadingRoster(p => ({ ...p, [teamId]: false }));
        }
    };

    // Proactively fetch ALL team rosters when teams list loads — so data is always ready
    useEffect(() => {
        if (teams.length === 0) return;
        teams.forEach(t => fetchRoster(t._id));
        // Auto-expand player's own team
        if (myTeam?._id) {
            setExpandedTeamId(myTeam._id);
        }
    }, [teams.map(t => t._id).join(','), myTeam?._id]);

    const toggleTeam = (teamId: string) => {
        setExpandedTeamId(prev => (prev === teamId ? null : teamId));
    };

    if (isTeamsLoading) return (
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    );

    if (teams.length === 0) return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center text-gray-400">
            No teams have registered for this tournament yet.
        </div>
    );

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-oswald font-bold tracking-wide mb-2">Participating Teams</h3>
            <div className="flex flex-col gap-4">
                {teams.map(team => {
                    const isMyTeam = myTeam?._id === team._id;
                    const isExpanded = expandedTeamId === team._id;
                    const roster: RosterPlayer[] = rosters[team._id] ?? [];
                    const isLoadingThisRoster = loadingRoster[team._id] ?? false;
                    const playerCount = roster.length;

                    return (
                        <div
                            key={team._id}
                            className="relative overflow-hidden rounded-3xl bg-black/40 backdrop-blur-xl border transition-all duration-300"
                            style={{
                                borderColor: isMyTeam ? `${team.primaryColor || '#F97316'}60` : 'rgba(255,255,255,0.08)',
                                boxShadow: isMyTeam ? `0 8px 32px -8px ${team.primaryColor || '#F97316'}35` : undefined,
                            }}
                        >
                            {/* Color accent strip */}
                            <div
                                className="h-1 w-full"
                                style={{ background: `linear-gradient(90deg, ${team.primaryColor || '#F97316'}, ${team.secondaryColor || '#1a1a1a'})` }}
                            />

                            {/* Clickable header */}
                            <button
                                onClick={() => toggleTeam(team._id)}
                                className="w-full flex items-center gap-4 p-5 text-left focus:outline-none"
                            >
                                {/* Logo */}
                                {team.logo ? (
                                    <img src={team.logo} alt={team.name} className="w-14 h-14 rounded-xl object-cover border-2 border-white/10 shrink-0" />
                                ) : (
                                    <div
                                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-oswald font-bold text-2xl shrink-0 border-2 border-white/10"
                                        style={{ backgroundColor: team.primaryColor || '#333' }}
                                    >
                                        {team.name.substring(0, 2).toUpperCase()}
                                    </div>
                                )}

                                {/* Name + meta */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-xl font-black font-oswald tracking-wide text-white">{team.name}</h3>
                                        {isMyTeam && (
                                            <span
                                                className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white"
                                                style={{ background: team.primaryColor || '#F97316' }}
                                            >
                                                ⚡ Your Team
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5" />
                                        {isLoadingThisRoster
                                            ? 'Loading...'
                                            : `${playerCount} player${playerCount !== 1 ? 's' : ''}`}
                                    </p>
                                </div>

                                {/* Expand icon */}
                                <div className="text-gray-400 shrink-0">
                                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </div>
                            </button>

                            {/* Expanded panel */}
                            {isExpanded && (
                                <div className="px-5 pb-5 border-t border-white/10 flex flex-col gap-4">
                                    {/* WhatsApp — only for my team */}
                                    {isMyTeam && (
                                        <div className="pt-4">
                                            {team.whatsappGroupLink ? (
                                                <a
                                                    href={team.whatsappGroupLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-white text-sm transition-all hover:scale-105 active:scale-95"
                                                    style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                                                >
                                                    <MessageCircle className="h-4 w-4" />
                                                    Join WhatsApp Group
                                                    <ExternalLink className="h-3 w-3 opacity-70" />
                                                </a>
                                            ) : (
                                                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-gray-500 bg-white/5 border border-white/10 text-sm">
                                                    <Lock className="h-4 w-4" /> WhatsApp link not added yet
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Player roster */}
                                    {isLoadingThisRoster ? (
                                        <div className="flex justify-center py-6">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    ) : roster.length === 0 ? (
                                        <div className="py-6 text-center text-gray-500 text-sm">
                                            No players assigned to this team yet.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                            {roster.map((player, idx) => (
                                                <div
                                                    key={player._id}
                                                    className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-2xl p-3 hover:border-white/15 transition-colors"
                                                >
                                                    <div className="relative shrink-0">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10">
                                                            <img
                                                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${player.profile.firstName}${player.profile.lastName}&backgroundColor=transparent`}
                                                                alt={player.profile.firstName}
                                                                className="w-full h-full object-cover mix-blend-screen scale-125"
                                                            />
                                                        </div>
                                                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#111] border border-white/10 flex items-center justify-center text-[8px] font-bold text-gray-400">
                                                            #{idx + 1}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white font-semibold text-sm capitalize truncate">
                                                            {player.profile.firstName} {player.profile.lastName}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] text-gray-500 capitalize">{player.profile.gender}</span>
                                                            {player.profile.skillLevel && (
                                                                <span className="text-[10px] text-gray-600">· {player.profile.skillLevel}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {player.auctionData?.soldPrice ? (
                                                        <span
                                                            className="text-xs font-bold shrink-0"
                                                            style={{ color: team.primaryColor || '#F97316' }}
                                                        >
                                                            ₹{player.auctionData.soldPrice.toLocaleString()}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TeamsTab;
