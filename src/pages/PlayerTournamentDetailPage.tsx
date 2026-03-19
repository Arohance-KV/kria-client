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

// Tab sub-components
import OverviewTab from './player-tournament/OverviewTab';
import CategoriesTab from './player-tournament/CategoriesTab';
import PlayersTab from './player-tournament/PlayersTab';
import TeamsTab from './player-tournament/TeamsTab';
import AuctionTab from './player-tournament/AuctionTab';
import BracketTab from './player-tournament/BracketTab';
import LeaderboardTab from './player-tournament/LeaderboardTab';

type TabKey = 'overview' | 'categories' | 'players' | 'teams' | 'auction' | 'bracket' | 'leaderboard';

const TABS: TabKey[] = ['overview', 'categories', 'players', 'teams', 'auction', 'bracket', 'leaderboard'];

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
    const [regForm, setRegForm] = useState({ age: '', gender: 'male', skillLevel: 'intermediate' });

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

    const handleConfirmRegister = async () => {
        if (!tournament || !user || !registeringCategoryId || !regForm.age) return;
        const result = await dispatch(registerForCategory({
            tournamentId: tournament._id,
            categoryId: registeringCategoryId,
            profile: {
                firstName: user.firstName,
                lastName: user.lastName,
                age: parseInt(regForm.age),
                gender: regForm.gender,
                phone: user.phone || '',
                skillLevel: regForm.skillLevel,
            },
        }));
        if (registerForCategory.fulfilled.match(result)) {
            setShowRegisterModal(false);
            setRegisteringCategoryId(null);
            setRegForm({ age: '', gender: 'male', skillLevel: 'intermediate' });
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
                                            {tournament.sport}
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
                                {TABS.map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-6 py-2.5 rounded-xl capitalize font-medium text-sm transition-all focus:outline-none whitespace-nowrap ${activeTab === tab ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            {activeTab === 'overview' && (
                                <OverviewTab
                                    description={tournament.description}
                                    user={user}
                                    myTeam={myTeam}
                                    myTeamAssignment={myTeamAssignment}
                                    isTeamDataReady={isTeamDataReady}
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
                            {activeTab === 'leaderboard' && id && tournament && (
                                <LeaderboardTab
                                    categories={categories}
                                    tournamentId={id}
                                    sport={tournament.sport}
                                />
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
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Player Name</label>
                                    <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300">
                                        {user?.firstName} {user?.lastName}
                                    </div>
                                    <p className="text-xs text-primary/80">Name is synced with your profile.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Age *</label>
                                    <input
                                        type="number" min="1"
                                        value={regForm.age}
                                        onChange={e => setRegForm({ ...regForm, age: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="Enter your age"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Gender *</label>
                                    <select
                                        value={regForm.gender}
                                        onChange={e => setRegForm({ ...regForm, gender: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-primary transition-colors"
                                    >
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
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
                                <button onClick={() => setShowRegisterModal(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors font-medium">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmRegister}
                                    disabled={isRegLoading || !regForm.age}
                                    className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isRegLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit
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