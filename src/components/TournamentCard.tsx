import React from 'react';
import { Calendar, Users, Trophy, MapPin, Clock, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tournament } from '@/store/slices/tournamentSlice';

interface TournamentCardProps {
    tournament: Tournament;
    onClick?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
    registration_open: { label: 'Open', dot: 'bg-green-400', text: 'text-green-400' },
    registration_closed: { label: 'Closed', dot: 'bg-red-400', text: 'text-red-400' },
    ongoing: { label: 'Live', dot: 'bg-primary animate-pulse', text: 'text-primary' },
    upcoming: { label: 'Upcoming', dot: 'bg-blue-400', text: 'text-blue-400' },
    completed: { label: 'Ended', dot: 'bg-gray-500', text: 'text-gray-500' },
    draft: { label: 'Draft', dot: 'bg-gray-500', text: 'text-gray-500' },
};

export function TournamentCard({ tournament, onClick }: TournamentCardProps) {
    const statusCfg = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.draft;

    const deadlineDate = new Date(tournament.registrationDeadline);
    const now = new Date();
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const showCountdown = tournament.status === 'registration_open' && daysLeft > 0 && daysLeft <= 7;

    return (
        <div
            onClick={onClick}
            className={cn(
                'group relative w-full rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer',
                'bg-[#161616] border border-white/8',
                'transition-all duration-500',
                'hover:-translate-y-1 sm:hover:-translate-y-2',
                'hover:border-white/20 hover:shadow-2xl hover:shadow-black/60',
                'active:scale-[0.99]',
                'flex flex-col',
            )}
        >
            {/* ── Image ──────────────────────────────────────────────────── */}
            <div className="relative h-44 sm:h-56 w-full overflow-hidden flex-shrink-0">
                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#161616] via-[#161616]/20 to-transparent z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent z-10" />

                <img
                    src={tournament.bannerImage || 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=3269&auto=format&fit=crop'}
                    alt={tournament.name}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                />

                {/* Top badges */}
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-20">
                    {/* Status pill */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
                        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', statusCfg.dot)} />
                        <span className={cn('text-[10px] font-bold uppercase tracking-wider', statusCfg.text)}>
                            {statusCfg.label}
                        </span>
                    </div>

                    {/* Sport badge */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 capitalize">
                            {tournament.sport?.replace('_', ' ')}
                        </span>
                    </div>
                </div>

                {/* Bottom — title overlay on image */}
                <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3">
                    {showCountdown && (
                        <div className="flex items-center gap-1 mb-1.5">
                            <Clock className="h-3 w-3 text-amber-400" />
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                                {daysLeft === 1 ? 'Last day' : `${daysLeft} days left`}
                            </span>
                        </div>
                    )}
                    <h3 className="text-base sm:text-xl font-oswald font-bold text-white tracking-wide leading-tight line-clamp-2">
                        {tournament.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="text-xs text-gray-300 font-medium truncate">
                            {tournament.venue?.city || 'TBD'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Stats + Dates ───────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col px-4 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5 gap-3 sm:gap-4">
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 transition-colors group-hover:bg-white/[0.06]">
                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm sm:text-base font-bold text-white leading-tight">{tournament.registeredPlayersCount ?? 0}</p>
                            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-600 font-bold">Players</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 transition-colors group-hover:bg-white/[0.06]">
                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                            <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm sm:text-base font-bold text-white leading-tight">
                                {tournament.teamsCount ?? 0}
                                <span className="text-gray-600 font-normal text-xs">/{tournament.settings?.maxTeams || '∞'}</span>
                            </p>
                            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-600 font-bold">Teams</p>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/6" />

                {/* Dates + CTA row */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-gray-600 flex-shrink-0" />
                            <span className="text-[10px] text-gray-600 font-medium truncate">
                                Reg. closes {new Date(tournament.registrationDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-primary flex-shrink-0" />
                            <span className="text-[10px] text-gray-400 font-semibold truncate">
                                {new Date(tournament.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                {' – '}
                                {new Date(tournament.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                        </div>
                    </div>

                    {/* Arrow CTA */}
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0 text-gray-500 group-hover:border-primary group-hover:text-primary group-hover:bg-primary/10 transition-all duration-300">
                        <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                </div>
            </div>

            {/* Subtle primary glow on hover */}
            <div className="absolute inset-0 rounded-2xl sm:rounded-3xl ring-1 ring-primary/0 group-hover:ring-primary/20 transition-all duration-500 pointer-events-none" />
        </div>
    );
}
