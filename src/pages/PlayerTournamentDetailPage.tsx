import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchTournament } from '../store/slices/tournamentSlice';
import { fetchTournamentCategories, registerForCategory, fetchRegistrationsByCategory, fetchMyRegistrations } from '../store/slices/registrationSlice';
import { fetchTournamentTeams } from '../store/slices/teamSlice';
import { Calendar, MapPin, Trophy, ChevronLeft, Loader2, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SmoothScroll from '@/components/SmoothScroll';
import { PlayerNavigation } from '@/components/PlayerNavigation';
import HoverFooter from '@/components/HoverFooter';
import { createPaymentOrder, verifyPayment } from '@/api/payment';

// Tab sub-components
import OverviewTab from './player-tournament/OverviewTab';
import CategoriesTab from './player-tournament/CategoriesTab';
import PlayersTab from './player-tournament/PlayersTab';
import TeamsTab from './player-tournament/TeamsTab';
import AuctionTab from './player-tournament/AuctionTab';
import BracketTab from './player-tournament/BracketTab';
import LeaderboardTab from './player-tournament/LeaderboardTab';
import AwardsTab from './player-tournament/AwardsTab';
import { sportRegistry } from '@/sports/registry';

type TabKey = 'overview' | 'categories' | 'players' | 'teams' | 'auction' | 'bracket' | 'team_league' | 'leaderboard' | 'awards';

const TABS: TabKey[] = ['overview', 'categories', 'players', 'teams', 'auction', 'bracket', 'team_league', 'leaderboard', 'awards'];

const PlayerTournamentDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const { currentTournament: tournament, isLoading, error } = useAppSelector(s => s.tournament);
    const { categories, myRegistrations, categoryRegistrations, isLoading: isRegLoading, error: regError } = useAppSelector(s => s.registration);
    const { teams, isLoading: isTeamsLoading } = useAppSelector(s => s.team);
    const { user } = useAppSelector(s => s.auth);

    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [selectedPlayerCategory, setSelectedPlayerCategory] = useState<string>('');
    const [registeringCategoryId, setRegisteringCategoryId] = useState<string | null>(null);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [regForm, setRegForm] = useState({ skillLevel: 'intermediate' });
    const [paymentLoading, setPaymentLoading] = useState(false);

    // ─── Data fetching ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (id) {
            dispatch(fetchTournament(id));
            dispatch(fetchTournamentCategories(id));
            dispatch(fetchTournamentTeams(id));
        }
    }, [dispatch, id]);

    // Separate effect for myRegistrations — fires whenever user becomes available
    useEffect(() => {
        if (user) dispatch(fetchMyRegistrations());
    }, [dispatch, user]);

    useEffect(() => {
        if (activeTab === 'players' && categories.length > 0 && !selectedPlayerCategory) {
            setSelectedPlayerCategory(categories[0]._id);
        }
    }, [activeTab, categories, selectedPlayerCategory]);

    useEffect(() => {
        if (activeTab === 'players' && selectedPlayerCategory) {
            dispatch(fetchRegistrationsByCategory(selectedPlayerCategory));
        }
    }, [activeTab, selectedPlayerCategory, dispatch]);

    // ─── Team assignment lookup ─────────────────────────────────────────────────
    // `teamId` is the DB field name (not `assignedTeamId`). Both myRegistrations AND
    // teams must be loaded for this to resolve — guarded by isTeamDataReady below.
    const myTeamAssignment = user ? myRegistrations.find(
        reg => reg.tournamentId === id && (reg.status === 'auctioned' || reg.status === 'assigned') && reg.teamId
    ) : undefined;
    const myTeam = myTeamAssignment && teams.length > 0
        ? teams.find(t => t._id === myTeamAssignment.teamId) ?? null
        : null;
    // True only when both async loads are done — prevents intermittent banner disappearance
    const isTeamDataReady = !isRegLoading && !isTeamsLoading;

    // ─── Registration handlers ──────────────────────────────────────────────────
    const handleOpenRegisterModal = (categoryId: string) => {
        if (!user) { navigate('/player/auth/login'); return; }
        setRegisteringCategoryId(categoryId);
        setShowRegisterModal(true);
    };

    const computeAge = () => {
        if (!user?.dateOfBirth) return 0;
        const dob = new Date(user.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        return age;
    };

    const buildProfile = () => ({
        firstName: user!.firstName,
        lastName: user!.lastName,
        age: computeAge(),
        gender: user!.gender || 'male',
        phone: user!.phone || '',
        skillLevel: regForm.skillLevel,
    });

    const closeRegModal = () => {
        setShowRegisterModal(false);
        setRegisteringCategoryId(null);
        setRegForm({ skillLevel: 'intermediate' });
        setPaymentLoading(false);
    };

    const handleConfirmRegister = async () => {
        if (!tournament || !user || !registeringCategoryId) return;

        const selectedCategory = categories.find(c => c._id === registeringCategoryId);

        // ── Paid category → Razorpay flow ──
        if (selectedCategory?.isPaidRegistration) {
            setPaymentLoading(true);
            try {
                // Load Razorpay script on-demand if not already loaded
                if (!(window as any).Razorpay) {
                    await new Promise<void>((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
                        s.onload = () => resolve();
                        s.onerror = () => reject(new Error('Failed to load Razorpay'));
                        document.head.appendChild(s);
                    });
                }

                const order = await createPaymentOrder({
                    tournamentId: tournament._id,
                    categoryId: registeringCategoryId,
                });

                const options = {
                    key: order.keyId,
                    amount: Math.round(order.amount * 100),
                    currency: order.currency,
                    name: 'Kria Sports',
                    description: `Registration: ${selectedCategory.name}`,
                    order_id: order.orderId,
                    handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
                        try {
                            const result = await verifyPayment({
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpaySignature: response.razorpay_signature,
                                profile: buildProfile(),
                            });
                            // Add the new registration to Redux state
                            if (result?.registration) {
                                dispatch(fetchMyRegistrations());
                            }
                            closeRegModal();
                        } catch {
                            setPaymentLoading(false);
                        }
                    },
                    modal: {
                        ondismiss: () => setPaymentLoading(false),
                    },
                    prefill: {
                        name: `${user.firstName} ${user.lastName}`,
                        contact: user.phone || '',
                    },
                    theme: { color: '#F97316' },
                };

                const rzp = new (window as any).Razorpay(options);
                rzp.open();
            } catch {
                setPaymentLoading(false);
            }
            return;
        }

        // ── Free category → direct registration ──
        const result = await dispatch(registerForCategory({
            tournamentId: tournament._id,
            categoryId: registeringCategoryId,
            profile: buildProfile(),
        }));
        if (registerForCategory.fulfilled.match(result)) {
            closeRegModal();
        }
    };

    // ─── Loading / error states ─────────────────────────────────────────────────
    if (isLoading || !tournament) return (
        <div className="min-h-screen bg-[#111] flex flex-col items-center">
            <PlayerNavigation />
            <div className="flex-1 flex justify-center items-center h-full w-full pt-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <HoverFooter />
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#111] flex flex-col items-center">
            <PlayerNavigation />
            <div className="flex-1 flex justify-center items-center pt-20">
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-2xl text-center max-w-md">
                    <h2 className="text-xl font-bold mb-2">Error Loading Tournament</h2>
                    <p>{error}</p>
                    <button onClick={() => navigate('/player/home')} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm transition-colors">Back to Home</button>
                </div>
            </div>
            <HoverFooter />
        </div>
    );

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'registration_open': return { label: 'Registration Open', className: 'bg-green-500/10 text-green-500 border-green-500/20' };
            case 'registration_closed': return { label: 'Registration Closed', className: 'bg-red-500/10 text-red-500 border-red-500/20' };
            case 'ongoing': return { label: 'Ongoing', className: 'bg-primary/10 text-primary border-primary/20' };
            case 'completed': return { label: 'Completed', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
            default: return { label: status, className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
        }
    };
    const statusConfig = getStatusConfig(tournament.status);

    // Fallback rule: legacy single-sport tournaments only have `sport`.
    const tournamentSports: string[] = tournament.sports?.length
        ? tournament.sports
        : [tournament.sport].filter(Boolean);
    // team_league is a badminton bracket type — resolve its plugin from the badminton
    // sport when the tournament hosts it, else fall back to the tournament's first sport.
    const teamLeagueSportKey = tournamentSports.find(s => s === 'badminton') || tournamentSports[0];

    return (
        <SmoothScroll>
            <div className="min-h-screen bg-[#111] text-white font-montserrat flex flex-col items-center">
                <PlayerNavigation />
                <main className="w-full pt-16 flex-1 flex flex-col items-center">

                    {/* ── Hero Banner ── */}
                    <div className="w-full relative h-[400px] border-b border-white/10">
                        <div className="absolute inset-0 z-0">
                            {tournament.bannerImage
                                ? <img src={tournament.bannerImage} alt={tournament.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/80 to-transparent" />
                        </div>
                        <div className="max-w-7xl mx-auto w-full px-8 relative z-10 h-full flex flex-col justify-end pb-10">
                            <button onClick={() => navigate('/player/home')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-fit mb-6">
                                <ChevronLeft className="h-4 w-4" /> Back to Tournaments
                            </button>
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                                <div>
                                    <div className="flex flex-wrap gap-3 mb-4">
                                        <Badge variant="outline" className={`px-3 py-1 uppercase tracking-wider text-[10px] font-bold backdrop-blur-md ${statusConfig.className}`}>
                                            {statusConfig.label}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-white/10 text-white backdrop-blur-md border border-white/10 uppercase tracking-wider text-[10px] font-bold">
                                            {tournamentSports.join(', ')}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-white/10 text-white backdrop-blur-md border border-white/10 uppercase tracking-wider text-[10px] font-bold flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3 text-primary" /> {tournament.venue?.city || 'TBD'}
                                        </Badge>
                                    </div>
                                    <h1 className="text-5xl md:text-6xl font-oswald font-extrabold tracking-wide uppercase leading-tight text-white max-w-4xl drop-shadow-xl">
                                        {tournament.name}
                                    </h1>
                                </div>
                                {tournament.status === 'registration_open' && (
                                    <button
                                        onClick={() => setActiveTab('categories')}
                                        className="px-8 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-primary/20"
                                    >
                                        Register Now <ArrowRight className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Main Layout ── */}
                    <div className="w-full max-w-7xl px-8 mt-10 mb-32 flex flex-col lg:flex-row gap-10">
                        <div className="flex-1 flex flex-col gap-8">
                            {/* Tab Bar */}
                            <div className="flex gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl w-fit overflow-x-auto max-w-full no-scrollbar">
                                {TABS
                                    .filter(tab => {
                                        if (tab === 'team_league') {
                                            const plugin = teamLeagueSportKey ? sportRegistry.get(teamLeagueSportKey) : undefined;
                                            const pluginTab = plugin?.playerTournamentTabs?.find(t => t.key === 'team_league');
                                            return pluginTab ? pluginTab.visible(categories) : false;
                                        }
                                        return true;
                                    })
                                    .map(tab => {
                                        const label = tab === 'team_league' ? 'Team League' : tab;
                                        return (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`px-6 py-2.5 rounded-xl capitalize font-medium text-sm transition-all focus:outline-none whitespace-nowrap ${activeTab === tab ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                            </div>

                            {/* Tab Content */}
                            {activeTab === 'overview' && (
                                <OverviewTab
                                    description={tournament.description}
                                    user={user}
                                    myTeam={myTeam}
                                    myTeamAssignment={myTeamAssignment}
                                    isTeamDataReady={isTeamDataReady}
                                    tournamentId={tournament._id}
                                    // LiveNowBanner gates its cricket fetch on sport === 'cricket'; make sure a
                                    // multi-sport tournament that hosts cricket still shows live cricket matches
                                    // even when cricket isn't the tournament's first/primary sport.
                                    sport={tournamentSports.includes('cricket') ? 'cricket' : tournamentSports[0]}
                                />
                            )}
                            {activeTab === 'categories' && (
                                <CategoriesTab
                                    categories={categories}
                                    myRegistrations={myRegistrations}
                                    tournamentStatus={tournament.status}
                                    isRegLoading={isRegLoading}
                                    registeringCategoryId={registeringCategoryId}
                                    onRegister={handleOpenRegisterModal}
                                />
                            )}
                            {activeTab === 'players' && (
                                <PlayersTab
                                    categories={categories}
                                    selectedPlayerCategory={selectedPlayerCategory}
                                    setSelectedPlayerCategory={setSelectedPlayerCategory}
                                    categoryRegistrations={categoryRegistrations}
                                    isRegLoading={isRegLoading}
                                    teams={teams}
                                />
                            )}
                            {activeTab === 'teams' && (
                                <TeamsTab
                                    teams={teams}
                                    isTeamsLoading={isTeamsLoading}
                                    myTeam={myTeam}
                                />
                            )}
                            {activeTab === 'auction' && id && (
                                <AuctionTab
                                    categories={categories}
                                    tournamentId={id}
                                />
                            )}
                            {activeTab === 'bracket' && id && (
                                <BracketTab
                                    categories={categories}
                                    tournamentId={id}
                                />
                            )}
                            {activeTab === 'team_league' && id && teamLeagueSportKey && (() => {
                                const plugin = sportRegistry.get(teamLeagueSportKey);
                                const pluginTab = plugin?.playerTournamentTabs?.find(t => t.key === 'team_league');
                                if (!pluginTab) return null;
                                const TabComponent = pluginTab.component;
                                return <TabComponent tournamentId={id} categories={categories} />;
                            })()}
                            {activeTab === 'leaderboard' && id && tournament && (
                                <LeaderboardTab
                                    categories={categories}
                                    tournamentId={id}
                                    sport={tournamentSports[0]}
                                />
                            )}
                            {activeTab === 'awards' && tournament && (
                                <AwardsTab awards={tournament.awards || []} />
                            )}
                        </div>

                        {/* ── Sidebar ── */}
                        <aside className="w-full lg:w-[350px] flex flex-col gap-6 shrink-0">
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-6 sticky top-24">
                                <h3 className="font-oswald font-bold text-xl tracking-wide uppercase border-b border-white/10 pb-4">Tournament Info</h3>
                                <div className="flex flex-col gap-5">
                                    <div className="flex gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <Calendar className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Schedule</p>
                                            <p className="text-white font-medium">
                                                {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <MapPin className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Venue</p>
                                            <p className="text-white font-medium">{tournament.venue?.name}</p>
                                            <p className="text-gray-400 text-sm mt-0.5">{tournament.venue?.city}</p>
                                        </div>
                                    </div>
                                    <div className="h-px bg-white/10 w-full my-2" />
                                    <div className="flex gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <Trophy className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Registration</p>
                                            {tournament.status === 'registration_open' ? (
                                                <p className="text-emerald-400 font-medium">Open until {new Date(tournament.registrationDeadline).toLocaleDateString()}</p>
                                            ) : tournament.status === 'registration_closed' ? (
                                                <p className="text-red-400 font-medium">Closed</p>
                                            ) : (
                                                <p className="text-gray-300 font-medium">Opens {new Date(tournament.registrationDeadline).toLocaleDateString()}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </main>

                {/* ── Registration Modal ── */}
                {showRegisterModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
                            <h3 className="text-2xl font-oswald font-bold mb-6">Complete Registration</h3>
                            {(() => {
                                const selectedCategory = categories.find(c => c._id === registeringCategoryId);
                                if (!selectedCategory?.isPaidRegistration) return null;
                                const base = selectedCategory.registrationFee;
                                const razorpayFee = Math.round(base * 0.02 * 100) / 100;
                                const platformFee = Math.round(base * 0.02 * 100) / 100;
                                const gst = Math.round((razorpayFee + platformFee) * 0.18 * 100) / 100;
                                const convenienceFee = Math.round((razorpayFee + platformFee + gst) * 100) / 100;
                                const total = Math.round((base + convenienceFee) * 100) / 100;
                                return (
                                    <div className="mb-4 p-4 bg-primary/10 border border-primary/30 rounded-xl">
                                        <p className="text-primary font-semibold text-sm mb-3">Payment Summary</p>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between text-gray-300">
                                                <span>Registration Fee</span>
                                                <span className="font-mono">₹{base.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Convenience Fee <span className="text-[10px] text-gray-500">(incl. GST)</span></span>
                                                <span className="font-mono">₹{convenienceFee.toFixed(2)}</span>
                                            </div>
                                            <div className="h-px bg-white/10 my-1" />
                                            <div className="flex justify-between text-white font-bold">
                                                <span>Total</span>
                                                <span className="font-mono text-primary">₹{total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">Payment secured via Razorpay.</p>
                                    </div>
                                );
                            })()}
                            {(!user?.gender || !user?.dateOfBirth) && (
                                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
                                    Please update your <span className="font-bold underline cursor-pointer" onClick={() => { closeRegModal(); navigate('/player/profile'); }}>profile</span> with your gender and date of birth before registering.
                                </div>
                            )}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Player Name</label>
                                    <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300">
                                        {user?.firstName} {user?.lastName}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400">Age</label>
                                        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300">
                                            {user?.dateOfBirth ? computeAge() : '—'}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400">Gender</label>
                                        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 capitalize">
                                            {user?.gender || '—'}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-primary/80 -mt-2">Synced from your profile.</p>
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Skill Level</label>
                                    <select
                                        value={regForm.skillLevel}
                                        onChange={e => setRegForm({ ...regForm, skillLevel: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
                                    >
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>
                                        <option value="professional">Professional</option>
                                    </select>
                                </div>
                            </div>
                            {regError && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-sm rounded-xl">{regError}</div>
                            )}
                            <div className="flex justify-end gap-3 mt-8">
                                <button onClick={closeRegModal} className="px-5 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors font-medium">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmRegister}
                                    disabled={isRegLoading || paymentLoading || !user?.gender || !user?.dateOfBirth}
                                    className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {(isRegLoading || paymentLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {(() => {
                                        const cat = categories.find(c => c._id === registeringCategoryId);
                                        if (!cat?.isPaidRegistration) return 'Submit';
                                        const b = cat.registrationFee;
                                        const fees = Math.round((b * 0.02 + b * 0.02) * 1.18 * 100) / 100;
                                        return `Pay ₹${(b + fees).toFixed(2)} & Register`;
                                    })()}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <HoverFooter />
            </div>
        </SmoothScroll>
    );
};

export default PlayerTournamentDetailPage;