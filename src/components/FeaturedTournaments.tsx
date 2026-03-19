import React, { useEffect } from 'react';
import { TournamentCard } from '@/components/TournamentCard';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchPublicTournaments } from '@/store/slices/tournamentSlice';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export const FeaturedTournaments = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { publicTournaments, isLoading } = useAppSelector((state) => state.tournament);

    useEffect(() => {
        // Fetch upcoming, registration open, and ongoing tournaments
        dispatch(fetchPublicTournaments({ limit: 6 }));
    }, [dispatch]);

    return (
        <div className="w-full max-w-7xl px-4 sm:px-8 mt-8 sm:mt-20 mb-16 sm:mb-32 flex flex-col gap-6 sm:gap-10 min-h-[400px]">
            {/* Header */}
            <div className="flex items-end justify-between w-full">
                <div>
                    <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-primary font-bold mb-2">
                        Discover
                    </p>
                    <h2 className="text-2xl sm:text-4xl font-oswald font-bold tracking-wide text-white uppercase">
                        Featured Tournaments
                    </h2>
                    <p className="text-gray-500 mt-1.5 text-xs sm:text-sm max-w-xl leading-relaxed hidden sm:block">
                        Discover and join the most anticipated sports events in your city. From casual leagues to professional championships.
                    </p>
                </div>
                {publicTournaments.length > 0 && (
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-600 border border-white/10 rounded-full px-3 py-1.5 flex-shrink-0">
                        {publicTournaments.length} events
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            ) : publicTournaments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                    {publicTournaments.map((tournament) => (
                        <TournamentCard
                            key={tournament._id}
                            tournament={tournament}
                            onClick={() => navigate(`/player/tournament/${tournament._id}`)}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-white/5 rounded-2xl border border-white/10 p-8 text-center">
                    <p className="text-base sm:text-lg">No tournaments available right now.</p>
                    <p className="text-sm text-gray-600 mt-1">Check back soon for upcoming events.</p>
                </div>
            )}
        </div>
    );
};
