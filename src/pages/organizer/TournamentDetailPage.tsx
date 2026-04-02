import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Save, Trash2, MapPin, Calendar, Users, DollarSign, Settings, Image as ImageIcon,
    Loader2, AlertCircle, CheckCircle, Play, XCircle, DoorOpen, Lock, Gavel,
    LayoutDashboard, ListTree, Trophy, UserCog, Swords, Target, Menu, X,
    Shield, Sliders, UserCheck,
} from 'lucide-react';
import HoverFooter from '@/components/HoverFooter';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
    fetchTournament, updateTournament, deleteTournament,
    openRegistration, closeRegistration, startAuction,
    startTournament, completeTournament, cancelTournament,
    clearCurrentTournament,
} from '../../store/slices/tournamentSlice';
import { fetchTournamentCategories } from '../../store/slices/registrationSlice';
import TeamsSection from './components/TeamsSection';
import StaffSection from './components/StaffSection';
import CategoriesSection from './components/CategoriesSection';
import RegistrationsSection from './components/RegistrationsSection';
import AuctionSection from './components/AuctionSection';
import MatchManagementSection from './components/MatchManagementSection';
import BracketManagementSection from './components/BracketManagementSection';
import TeamLeagueSection from './components/TeamLeagueSection';
import PaymentsSection from './components/PaymentsSection';

// ─── Types ───────────────────────────────────────────────────────────────────

type GroupKey = 'dashboard' | 'info' | 'players' | 'teams' | 'compete' | 'admin' | 'danger';

type SectionKey =
    | 'overview'
    | 'basic'
    | 'schedule'
    | 'location'
    | 'settings'
    | 'categories'
    | 'registrations'
    | 'payments'
    | 'teams'
    | 'auction'
    | 'brackets'
    | 'matches'
    | 'team_league'
    | 'staff'
    | 'danger';

interface NavItem {
    key: SectionKey;
    label: string;
    icon: React.ElementType;
    condition?: (status: string) => boolean;
}

interface NavGroup {
    key: GroupKey;
    icon: React.ElementType;
    label: string;
    items: NavItem[];
    danger?: boolean;
    condition?: (status: string) => boolean;
}

const NAV_GROUPS: NavGroup[] = [
    {
        key: 'dashboard',
        icon: LayoutDashboard,
        label: 'OVERVIEW',
        items: [
            { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        key: 'info',
        icon: Sliders,
        label: 'TOURNAMENT',
        items: [
            { key: 'basic', label: 'Basic Info', icon: ImageIcon },
            { key: 'schedule', label: 'Schedule', icon: Calendar },
            { key: 'location', label: 'Location', icon: MapPin },
            { key: 'settings', label: 'Rules & Settings', icon: Settings },
        ],
    },
    {
        key: 'players',
        icon: Users,
        label: 'PLAYERS',
        items: [
            { key: 'categories', label: 'Categories', icon: ListTree },
            { key: 'registrations', label: 'Registrations', icon: UserCheck },
            { key: 'payments', label: 'Payments', icon: DollarSign },
        ],
    },
    {
        key: 'teams',
        icon: Shield,
        label: 'TEAMS',
        items: [
            { key: 'teams', label: 'Manage Teams', icon: Users },
            { key: 'auction', label: 'Auction', icon: Gavel, condition: (s) => !['draft', 'cancelled', 'completed'].includes(s) },
        ],
    },
    {
        key: 'compete',
        icon: Swords,
        label: 'COMPETITION',
        condition: (s) => !['draft', 'cancelled'].includes(s),
        items: [
            { key: 'brackets', label: 'Brackets', icon: Target },
            { key: 'matches', label: 'Matches', icon: Swords },
            { key: 'team_league', label: 'Team League', icon: Trophy },
        ],
    },
    {
        key: 'admin',
        icon: UserCog,
        label: 'MANAGEMENT',
        items: [
            { key: 'staff', label: 'Staff', icon: Trophy },
        ],
    },
    {
        key: 'danger',
        icon: Trash2,
        label: 'DANGER ZONE',
        danger: true,
        condition: (s) => !['completed', 'cancelled'].includes(s),
        items: [
            { key: 'danger', label: 'Delete Tournament', icon: Trash2 },
        ],
    },
];

const statusColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
    draft: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Draft' },
    registration_open: { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30', label: 'Registration Open' },
    registration_closed: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30', label: 'Registration Closed' },
    auction_in_progress: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30', label: 'Auction In Progress' },
    ongoing: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30', label: 'Ongoing' },
    completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30', label: 'Completed' },
    cancelled: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30', label: 'Cancelled' },
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

const TournamentDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { currentTournament, isLoading, error } = useAppSelector((state) => state.tournament);
    const { categories } = useAppSelector((state) => state.registration);

    const [activeGroup, setActiveGroup] = useState<GroupKey>('dashboard');
    const [activeSection, setActiveSection] = useState<SectionKey>('overview');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [formData, setFormData] = useState({
        name: '', description: '', sport: 'badminton', bannerImage: '',
        startDate: '', endDate: '', registrationDeadline: '',
        venue: { name: '', address: '', city: '' },
        settings: { maxTeams: 8, defaultBudget: 100000, auctionType: 'manual', allowLateRegistration: false },
    });

    useEffect(() => {
        if (id) {
            dispatch(fetchTournament(id));
            dispatch(fetchTournamentCategories(id));
        }
        return () => { dispatch(clearCurrentTournament()); };
    }, [id, dispatch]);

    useEffect(() => {
        if (currentTournament) {
            setFormData({
                name: currentTournament.name || '',
                description: currentTournament.description || '',
                sport: currentTournament.sport || 'badminton',
                bannerImage: currentTournament.bannerImage || '',
                startDate: currentTournament.startDate ? currentTournament.startDate.split('T')[0] : '',
                endDate: currentTournament.endDate ? currentTournament.endDate.split('T')[0] : '',
                registrationDeadline: currentTournament.registrationDeadline ? currentTournament.registrationDeadline.split('T')[0] : '',
                venue: {
                    name: currentTournament.venue?.name || '',
                    address: currentTournament.venue?.address || '',
                    city: currentTournament.venue?.city || '',
                },
                settings: {
                    maxTeams: currentTournament.settings?.maxTeams || 8,
                    defaultBudget: currentTournament.settings?.defaultBudget || 100000,
                    auctionType: currentTournament.settings?.auctionType || 'manual',
                    allowLateRegistration: currentTournament.settings?.allowLateRegistration || false,
                },
            });
        }
    }, [currentTournament]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (name.startsWith('venue.')) {
            const field = name.split('.')[1];
            setFormData(prev => ({ ...prev, venue: { ...prev.venue, [field]: value } }));
        } else if (name.startsWith('settings.')) {
            const field = name.split('.')[1];
            let parsed: any = value;
            if (type === 'number') parsed = Number(value);
            if (type === 'checkbox') parsed = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, settings: { ...prev.settings, [field]: parsed } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = async () => {
        if (!id) return;
        const result = await dispatch(updateTournament({ id, data: formData }));
        if (updateTournament.fulfilled.match(result)) setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!id) return;
        const result = await dispatch(deleteTournament(id));
        if (deleteTournament.fulfilled.match(result)) navigate('/organizer/home');
    };

    const handleStatusAction = async (action: any) => {
        if (!id) return;
        await dispatch(action(id));
    };

    const handleGroupClick = (group: NavGroup) => {
        setActiveGroup(group.key);
        // Always auto-navigate to the first visible item in the group
        const visible = group.items.filter(i => !i.condition || i.condition(tournamentStatus));
        if (visible.length > 0) setActiveSection(visible[0].key);
        setSidebarOpen(false);
        setIsEditing(false);
    };

    const handleSectionClick = (section: SectionKey) => {
        setActiveSection(section);
        setSidebarOpen(false);
        setIsEditing(false);
    };

    // ─── Loading / Not Found ─────────────────────────────────────────────────

    if (isLoading && !currentTournament) {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!currentTournament && !isLoading) {
        return (
            <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center text-white gap-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="text-lg">Tournament not found</p>
                <button onClick={() => navigate('/organizer/home')} className="px-6 py-2 bg-primary rounded-full text-white font-medium">
                    Go Back
                </button>
            </div>
        );
    }

    const tournamentStatus = currentTournament?.status || 'draft';
    const status = statusColors[tournamentStatus] || statusColors.draft;

    const visibleGroups = NAV_GROUPS.filter(g => !g.condition || g.condition(tournamentStatus));
    const activeGroupData = visibleGroups.find(g => g.key === activeGroup) || visibleGroups[0];
    const visibleItems = activeGroupData?.items.filter(i => !i.condition || i.condition(tournamentStatus)) || [];

    const isEditableSection = ['basic', 'schedule', 'location', 'settings'].includes(activeSection);

    const getStatusActions = () => {
        const s = currentTournament?.status;
        const actions: { label: string; icon: any; action: any; color: string }[] = [];
        if (s === 'draft') actions.push({ label: 'Open Registration', icon: DoorOpen, action: openRegistration, color: 'bg-green-600 hover:bg-green-700' });
        if (s === 'registration_open') actions.push({ label: 'Close Registration', icon: Lock, action: closeRegistration, color: 'bg-yellow-600 hover:bg-yellow-700' });
        if (s === 'registration_closed') actions.push({ label: 'Start Auction', icon: Gavel, action: startAuction, color: 'bg-blue-600 hover:bg-blue-700' });
        if (s === 'auction_in_progress') actions.push({ label: 'Start Tournament', icon: Play, action: startTournament, color: 'bg-primary hover:bg-primary/90' });
        if (s === 'ongoing') actions.push({ label: 'Complete Tournament', icon: CheckCircle, action: completeTournament, color: 'bg-emerald-600 hover:bg-emerald-700' });
        if (s && !['completed', 'cancelled'].includes(s)) actions.push({ label: 'Cancel Tournament', icon: XCircle, action: cancelTournament, color: 'bg-red-600 hover:bg-red-700' });
        return actions;
    };

    return (
        <div className="min-h-screen bg-[#111] text-white font-montserrat flex flex-col">

            {/* ─── Top Header ───────────────────────────────────────────────── */}
            <header className="w-full flex items-center justify-between px-5 py-3.5 bg-[#0d0d0d] border-b border-white/5 sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                    <button
                        onClick={() => navigate('/organizer/home')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                    <div className="hidden sm:block h-5 w-px bg-white/10" />
                    <h1 className="hidden sm:block text-sm font-semibold text-white truncate max-w-[260px]">
                        {currentTournament?.name}
                    </h1>
                </div>
                <div className="flex items-center gap-2.5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.text} border ${status.border}`}>
                        {status.label}
                    </span>
                    {isEditableSection && !isEditing && currentTournament?.status === 'draft' && (
                        <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 rounded-full bg-white/8 hover:bg-white/15 text-white text-sm font-medium transition-all border border-white/10">
                            Edit
                        </button>
                    )}
                    {isEditing && (
                        <>
                            <button onClick={() => setIsEditing(false)} className="px-4 py-1.5 rounded-full bg-white/8 hover:bg-white/15 text-white text-sm border border-white/10">Cancel</button>
                            <button onClick={handleSave} disabled={isLoading} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-white text-sm font-medium disabled:opacity-50">
                                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                            </button>
                        </>
                    )}
                </div>
            </header>

            {error && (
                <div className="px-5 pt-3">
                    <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-900/50 rounded-xl text-red-200 text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" /> <span>{error}</span>
                    </div>
                </div>
            )}

            {/* ─── Body ─────────────────────────────────────────────────────── */}
            <div className="flex flex-1 min-h-0">

                {/* Mobile overlay */}
                {sidebarOpen && (
                    <div className="fixed inset-0 bg-black/70 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
                )}

                {/* ── DUAL-TIER SIDEBAR ──────────────────────────────────────── */}
                <div className={`
                    fixed lg:sticky top-[57px] left-0 z-20
                    flex h-[calc(100vh-57px)] flex-shrink-0
                    transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                    {/* Tier 1 — Icon Rail */}
                    <div className="w-[56px] bg-[#0d0d0d] border-r border-white/5 flex flex-col items-center py-3 gap-1 overflow-y-auto">
                        {visibleGroups.map((group) => {
                            const Icon = group.icon;
                            const isActive = activeGroup === group.key;
                            return (
                                <button
                                    key={group.key}
                                    onClick={() => handleGroupClick(group)}
                                    title={group.label}
                                    className={`
                                        w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 relative
                                        ${group.danger
                                            ? isActive
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'text-red-500/40 hover:bg-red-500/10 hover:text-red-400'
                                            : isActive
                                                ? 'bg-primary/20 text-primary'
                                                : 'text-gray-600 hover:bg-white/6 hover:text-gray-300'
                                        }
                                    `}
                                >
                                    {isActive && (
                                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r ${group.danger ? 'bg-red-400' : 'bg-primary'}`} />
                                    )}
                                    <Icon className="h-4 w-4" />
                                </button>
                            );
                        })}
                    </div>

                    {/* Tier 2 — Label Panel */}
                    <div className={`w-[188px] border-r flex flex-col overflow-y-auto
                        ${activeGroupData?.danger
                            ? 'bg-[#110a0a] border-red-900/20'
                            : 'bg-[#111] border-white/5'
                        }`}
                    >
                        {/* Group header */}
                        <div className="px-4 pt-5 pb-3">
                            <p className={`text-[10px] font-bold tracking-[0.12em] ${activeGroupData?.danger ? 'text-red-500/50' : 'text-gray-600'}`}>
                                {activeGroupData?.label}
                            </p>
                        </div>

                        {/* Section items */}
                        <div className="flex flex-col gap-0.5 px-2 pb-4">
                            {visibleItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeSection === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => handleSectionClick(item.key)}
                                        className={`
                                            w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 text-left
                                            ${activeGroupData?.danger
                                                ? isActive
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : 'text-red-400/50 hover:bg-red-500/8 hover:text-red-400'
                                                : isActive
                                                    ? 'bg-primary/10 text-primary font-medium'
                                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                            }
                                        `}
                                    >
                                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span className="truncate">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Spacer to push content down if needed */}
                        <div className="flex-1" />

                        {/* Tournament name at bottom of panel */}
                        <div className="px-4 py-4 border-t border-white/5">
                            <p className="text-[10px] text-gray-600 font-medium truncate">{currentTournament?.name}</p>
                            <p className="text-[10px] text-gray-700 capitalize mt-0.5">{currentTournament?.sport?.replace('_', ' ')}</p>
                        </div>
                    </div>
                </div>

                {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 lg:p-10 pb-24 w-full max-w-[1600px]">
                        {renderSection()}
                    </div>
                </main>
            </div>

            <HoverFooter />
        </div>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION RENDERER
    // ═════════════════════════════════════════════════════════════════════════

    function renderSection() {
        switch (activeSection) {
            case 'overview': return <OverviewSection />;
            case 'basic': return <BasicInfoSection />;
            case 'schedule': return <ScheduleSection />;
            case 'location': return <LocationSection />;
            case 'settings': return <SettingsSection />;
            case 'categories': return currentTournament && id ? <CategoriesSection tournamentId={id} /> : null;
            case 'teams': return currentTournament && id ? <TeamsSection tournamentId={id} defaultBudget={currentTournament.settings?.defaultBudget || 100000} /> : null;
            case 'registrations': return currentTournament && id ? <RegistrationsSection tournamentId={id} /> : null;
            case 'payments': return currentTournament && id ? <PaymentsSection tournamentId={id} /> : null;
            case 'auction': return currentTournament && id ? <AuctionSection tournamentId={id} categories={categories.map(c => ({ _id: c._id, name: c.name, status: c.status }))} /> : null;
            case 'brackets': return currentTournament && id ? <BracketManagementSection tournamentId={id} categories={categories.map(c => ({ _id: c._id, name: c.name, status: c.status }))} /> : null;
            case 'matches': return currentTournament && id ? <MatchManagementSection tournamentId={id} categories={categories.map(c => ({ _id: c._id, name: c.name, status: c.status }))} /> : null;
            case 'team_league': return currentTournament && id ? <TeamLeagueSection tournamentId={id} categories={categories.map(c => ({ _id: c._id, name: c.name, status: c.status, bracketType: c.bracketType, teamLeagueConfig: c.teamLeagueConfig }))} /> : null;
            case 'staff': return currentTournament && id ? <StaffSection tournamentId={id} staffIds={currentTournament.staffIds || []} /> : null;
            case 'danger': return <DangerSection />;
            default: return null;
        }
    }

    // ─── Overview ────────────────────────────────────────────────────────────

    function OverviewSection() {
        const statusActions = getStatusActions();
        return (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                    <h2 className="text-2xl md:text-3xl font-oswald font-bold tracking-wide text-white">{currentTournament?.name}</h2>
                    <p className="text-gray-500 mt-1 text-sm capitalize">{currentTournament?.sport?.replace('_', ' ')} · {currentTournament?.venue?.city}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Reg. Players', value: currentTournament?.registeredPlayersCount ?? 0, icon: Users, color: 'text-primary', accent: 'bg-primary/10' },
                        { label: 'Teams', value: `${currentTournament?.teamsCount ?? 0}/${currentTournament?.settings?.maxTeams || '∞'}`, icon: Shield, color: 'text-emerald-400', accent: 'bg-emerald-500/10' },
                        { label: 'Categories', value: categories.length, icon: ListTree, color: 'text-blue-400', accent: 'bg-blue-500/10' },
                        { label: 'Status', value: status.label, icon: LayoutDashboard, color: status.text, accent: `${status.bg}` },
                    ].map(({ label, value, icon: Icon, color, accent }) => (
                        <div key={label} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 flex flex-col gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
                                <Icon className={`h-4 w-4 ${color}`} />
                            </div>
                            <div>
                                <p className={`text-xl font-oswald font-bold ${color}`}>{value}</p>
                                <p className="text-[10px] uppercase tracking-wider text-gray-600 mt-0.5">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Status Actions */}
                {statusActions.length > 0 && (
                    <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Quick Actions</h3>
                        <div className="flex flex-wrap gap-2">
                            {statusActions.map(({ label, icon: Icon, action, color }) => (
                                <button
                                    key={label}
                                    onClick={() => handleStatusAction(action)}
                                    disabled={isLoading}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-white font-medium text-sm transition-all disabled:opacity-50 ${color}`}
                                >
                                    <Icon className="h-3.5 w-3.5" /> {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Key Dates */}
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Key Dates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { label: 'Start Date', date: currentTournament?.startDate },
                            { label: 'End Date', date: currentTournament?.endDate },
                            { label: 'Reg. Deadline', date: currentTournament?.registrationDeadline },
                        ].map(({ label, date }) => (
                            <div key={label} className="flex items-center gap-3 p-3 bg-black/20 rounded-xl">
                                <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-gray-600">{label}</p>
                                    <p className="text-white text-sm font-medium mt-0.5">
                                        {date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Venue */}
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Venue</h3>
                    <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-white font-medium">{currentTournament?.venue?.name || '—'}</p>
                            <p className="text-gray-500 text-sm mt-0.5">{currentTournament?.venue?.city}{currentTournament?.venue?.address ? `, ${currentTournament.venue.address}` : ''}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Basic Info ──────────────────────────────────────────────────────────

    function BasicInfoSection() {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SectionHeader icon={ImageIcon} title="Basic Information" />
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5 md:col-span-2">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Tournament Name</Label>
                            {isEditing ? (
                                <Input name="name" value={formData.name} onChange={handleInputChange} className="bg-black/40 border-white/10 text-white text-lg font-oswald font-bold" />
                            ) : (
                                <p className="text-white font-oswald font-bold text-xl">{currentTournament?.name}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Sport</Label>
                            {isEditing ? (
                                <select name="sport" className="flex h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white appearance-none" value={formData.sport} onChange={handleInputChange}>
                                    <option value="badminton">Badminton</option>
                                    <option value="cricket">Cricket</option>
                                    <option value="football">Football</option>
                                    <option value="kabaddi">Kabaddi</option>
                                    <option value="table_tennis">Table Tennis</option>
                                    <option value="tennis">Tennis</option>
                                </select>
                            ) : (
                                <p className="text-white font-medium capitalize">{currentTournament?.sport?.replace('_', ' ')}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Banner Image URL</Label>
                            {isEditing ? (
                                <Input name="bannerImage" value={formData.bannerImage} onChange={handleInputChange} className="bg-black/40 border-white/10 text-white" placeholder="https://..." />
                            ) : (
                                <p className="text-white font-medium truncate text-sm">{currentTournament?.bannerImage || '—'}</p>
                            )}
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Description</Label>
                            {isEditing ? (
                                <textarea name="description" rows={4} className="flex w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white resize-none" value={formData.description} onChange={handleInputChange} />
                            ) : (
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{currentTournament?.description || 'No description provided.'}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Schedule ────────────────────────────────────────────────────────────

    function ScheduleSection() {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SectionHeader icon={Calendar} title="Schedule" />
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {(['startDate', 'endDate', 'registrationDeadline'] as const).map(field => (
                            <div key={field} className="space-y-1.5">
                                <Label className="text-gray-500 text-xs uppercase tracking-wider">
                                    {field === 'registrationDeadline' ? 'Reg. Deadline' : field === 'startDate' ? 'Start Date' : 'End Date'}
                                </Label>
                                {isEditing ? (
                                    <Input name={field} type="date" className="bg-black/40 border-white/10 text-white [color-scheme:dark]" value={(formData as any)[field]} onChange={handleInputChange} />
                                ) : (
                                    <p className="text-white font-medium text-sm">
                                        {(currentTournament as any)?.[field]
                                            ? new Date((currentTournament as any)[field]).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                                            : '—'}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Location ────────────────────────────────────────────────────────────

    function LocationSection() {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SectionHeader icon={MapPin} title="Location" />
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5 md:col-span-2">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Venue Name</Label>
                            {isEditing ? <Input name="venue.name" value={formData.venue.name} onChange={handleInputChange} className="bg-black/40 border-white/10 text-white" /> : <p className="text-white font-medium">{currentTournament?.venue?.name || '—'}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">City</Label>
                            {isEditing ? <Input name="venue.city" value={formData.venue.city} onChange={handleInputChange} className="bg-black/40 border-white/10 text-white" /> : <p className="text-white font-medium">{currentTournament?.venue?.city || '—'}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Full Address</Label>
                            {isEditing ? <Input name="venue.address" value={formData.venue.address} onChange={handleInputChange} className="bg-black/40 border-white/10 text-white" /> : <p className="text-white font-medium">{currentTournament?.venue?.address || '—'}</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Settings ────────────────────────────────────────────────────────────

    function SettingsSection() {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SectionHeader icon={Settings} title="Rules & Auction Settings" />
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Max Teams</Label>
                            {isEditing ? (
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                    <Input name="settings.maxTeams" type="number" min="2" value={formData.settings.maxTeams} onChange={handleInputChange} className="bg-black/40 border-white/10 text-white pl-9" />
                                </div>
                            ) : <p className="text-white font-medium">{currentTournament?.settings?.maxTeams}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Default Auction Budget</Label>
                            {isEditing ? (
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                    <Input name="settings.defaultBudget" type="number" min="0" value={formData.settings.defaultBudget} onChange={handleInputChange} className="bg-black/40 border-white/10 text-white pl-9" />
                                </div>
                            ) : <p className="text-white font-medium">₹{currentTournament?.settings?.defaultBudget?.toLocaleString()}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Auction Type</Label>
                            {isEditing ? (
                                <select name="settings.auctionType" className="flex h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white appearance-none" value={formData.settings.auctionType} onChange={handleInputChange}>
                                    <option value="manual">Manual (Offline Draft)</option>
                                    <option value="live">Live Interactive Auction</option>
                                </select>
                            ) : <p className="text-white font-medium capitalize">{currentTournament?.settings?.auctionType}</p>}
                        </div>
                        <div className="flex items-center pt-5">
                            {isEditing ? (
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input type="checkbox" name="settings.allowLateRegistration" className="w-4 h-4 rounded border-white/20 bg-black/50 text-primary" checked={formData.settings.allowLateRegistration} onChange={handleInputChange} />
                                    <span className="text-gray-300 text-sm">Allow Late Registration</span>
                                </label>
                            ) : (
                                <p className="text-white font-medium text-sm">{currentTournament?.settings?.allowLateRegistration ? 'Late Registration Allowed' : 'No Late Registration'}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Danger Zone ─────────────────────────────────────────────────────────

    function DangerSection() {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SectionHeader icon={Trash2} title="Danger Zone" danger />
                <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-6 flex flex-col gap-5">
                    <p className="text-red-300/60 text-sm">Deleting a tournament is permanent and cannot be undone. All associated data will be lost.</p>
                    {!showDeleteConfirm ? (
                        <button onClick={() => setShowDeleteConfirm(true)} className="w-fit flex items-center gap-2 px-5 py-2 rounded-full border border-red-500/40 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-all">
                            <Trash2 className="h-4 w-4" /> Delete Tournament
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="text-red-300 text-sm">Are you absolutely sure?</span>
                            <button onClick={handleDelete} disabled={isLoading} className="flex items-center gap-2 px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Yes, Delete
                            </button>
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-5 py-2 rounded-full bg-white/8 hover:bg-white/15 text-white text-sm">
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }
};

// ─── Shared Section Header ────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, danger }: { icon: React.ElementType; title: string; danger?: boolean }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${danger ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                <Icon className="h-4 w-4" />
            </div>
            <h2 className={`text-xl font-oswald font-bold tracking-wide ${danger ? 'text-red-400' : 'text-white'}`}>{title}</h2>
        </div>
    );
}

export default TournamentDetailPage;
