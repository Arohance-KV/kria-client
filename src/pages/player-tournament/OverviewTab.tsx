import React from 'react';
import { ExternalLink, Lock, MessageCircle } from 'lucide-react';
import { Registration } from '../../store/slices/registrationSlice';
import { Team } from '../../store/slices/teamSlice';
import LiveNowBanner from './LiveNowBanner';

interface Props {
    description?: string;
    user: any;
    myTeam: Team | null | undefined;
    myTeamAssignment: Registration | undefined;
    isTeamDataReady: boolean;
    tournamentId?: string;
    sport?: string;
}

const OverviewTab: React.FC<Props> = ({ description, user, myTeam, myTeamAssignment, isTeamDataReady, tournamentId, sport }) => {
    return (
        <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {tournamentId && <LiveNowBanner tournamentId={tournamentId} sport={sport} />}


            {/* My Team Banner — shows skeleton while loading, full banner once data is ready */}
            {user && !isTeamDataReady && (
                <div className="animate-pulse rounded-3xl border border-white/10 p-6 flex items-center gap-5 bg-white/5 h-36" />
            )}
            {user && isTeamDataReady && myTeam && (
                <div
                    className="relative overflow-hidden rounded-3xl border p-6 flex flex-col gap-5"
                    style={{
                        borderColor: `${myTeam.primaryColor || '#F97316'}50`,
                        background: `linear-gradient(135deg, ${myTeam.primaryColor || '#F97316'}15, transparent 60%)`,
                        boxShadow: `0 0 40px ${myTeam.primaryColor || '#F97316'}20`,
                    }}
                >
                    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ background: myTeam.primaryColor || '#F97316' }} />

                    <div className="flex items-center gap-2 z-10">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white" style={{ background: myTeam.primaryColor || '#F97316' }}>
                            🎉 You've been drafted!
                        </span>
                    </div>

                    <div className="flex items-center gap-5 z-10">
                        {myTeam.logo ? (
                            <img src={myTeam.logo} alt={myTeam.name} className="w-20 h-20 rounded-2xl object-cover border-4 shadow-xl" style={{ borderColor: myTeam.primaryColor || '#F97316' }} />
                        ) : (
                            <div
                                className="w-20 h-20 rounded-2xl border-4 shadow-xl flex items-center justify-center text-white font-oswald font-black text-3xl shrink-0"
                                style={{ backgroundColor: myTeam.primaryColor || '#F97316', borderColor: myTeam.primaryColor || '#F97316' }}
                            >
                                {myTeam.name.substring(0, 2).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-gray-400 font-medium uppercase tracking-widest mb-1">Your Team</p>
                            <h3 className="text-4xl font-oswald font-black tracking-wide text-white leading-tight">{myTeam.name}</h3>
                            {myTeamAssignment?.auctionData?.soldPrice && (
                                <p className="text-sm mt-1" style={{ color: myTeam.primaryColor || '#F97316' }}>
                                    {myTeamAssignment.status === 'auctioned' ? 'Sold for' : 'Assigned for'} ₹{myTeamAssignment.auctionData.soldPrice.toLocaleString()}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="z-10">
                        {myTeam.whatsappGroupLink ? (
                            <a
                                href={myTeam.whatsappGroupLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)', boxShadow: '0 8px 24px rgba(37,211,102,0.3)' }}
                            >
                                <MessageCircle className="h-5 w-5" />
                                Join Team WhatsApp Group
                                <ExternalLink className="h-4 w-4 opacity-70" />
                            </a>
                        ) : (
                            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl text-gray-500 bg-white/5 border border-white/10 cursor-not-allowed">
                                <Lock className="h-4 w-4" />
                                <span className="text-sm">WhatsApp link not added yet — check back later</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <section>
                <h3 className="text-2xl font-oswald font-bold tracking-wide mb-4">About the Tournament</h3>
                <div className="prose prose-invert max-w-none">
                    <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                        {description || 'No description provided for this tournament.'}
                    </p>
                </div>
            </section>
        </div>
    );
};

export default OverviewTab;
