import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, UserPlus, Share2, Settings, CalendarCheck, Bookmark, FileText,
    Users, Newspaper, User, PlusCircle, Store, Pencil, Save, Loader2,
    Trophy, TrendingUp, CheckCircle2, Building2, Camera,
} from 'lucide-react';
import HoverFooter from '@/components/HoverFooter';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout, updateProfile, fetchOrganizerStats, OrganizerStats, uploadOrganizerProfileImage } from '../../store/slices/authSlice';
import { fetchMyTournaments, Tournament } from '../../store/slices/tournamentSlice';
import { Badge } from '@/components/ui/badge';

// ─── Dashboard card ───────────────────────────────────────────────────────────
const DashboardCard = ({ icon: Icon, title, onClick, badge }: { icon: any; title: string; onClick?: () => void; badge?: string | number }) => (
    <div
        onClick={onClick}
        className="group relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-white/5 border border-white/10 cursor-pointer transition-all duration-300 hover:bg-white/10 hover:border-primary/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 overflow-hidden aspect-square"
    >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {badge !== undefined && (
            <span className="absolute top-3 right-3 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full z-10">
                {badge}
            </span>
        )}
        <Icon className="h-12 w-12 text-primary group-hover:scale-110 transition-transform duration-300 ease-out z-10" strokeWidth={1.5} />
        <span className="text-lg font-bold font-oswald tracking-wide text-white z-10 group-hover:text-primary transition-colors">{title}</span>
    </div>
);

// ─── Stat chip ────────────────────────────────────────────────────────────────
const StatChip = ({ icon: Icon, label, value, accent = false }: { icon: any; label: string; value: string | number; accent?: boolean }) => (
    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 text-gray-500">
            <Icon className={`h-3.5 w-3.5 ${accent ? 'text-primary' : ''}`} />
            <span className="text-xs uppercase tracking-wider font-oswald">{label}</span>
        </div>
        <span className={`text-xl font-bold font-oswald ${accent ? 'text-primary' : 'text-white'}`}>{value}</span>
    </div>
);

// ─── Tournament status badge colours ──────────────────────────────────────────
const statusColor = (status: string) => {
    if (status === 'ongoing' || status === 'registration_open')  return 'text-green-400 border-green-400/20 bg-green-400/10';
    if (status === 'completed')                                   return 'text-blue-400  border-blue-400/20  bg-blue-400/10';
    if (status === 'cancelled')                                   return 'text-red-400   border-red-400/20   bg-red-400/10';
    if (status === 'draft')                                       return 'text-gray-400  border-gray-400/20  bg-gray-400/10';
    return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
};

// ─── Sport emoji ──────────────────────────────────────────────────────────────
const sportEmoji = (sport?: string) => {
    const map: Record<string, string> = { badminton: '🏸', cricket: '🏏', football: '⚽', tennis: '🎾', table_tennis: '🏓', kabaddi: '🤼' };
    return sport ? (map[sport.toLowerCase()] ?? '🏅') : '🏅';
};

// ─── Main Component ───────────────────────────────────────────────────────────
const OrganizerProfilePage = () => {
    const navigate  = useNavigate();
    const dispatch  = useAppDispatch();
    const { user, role, isLoading, organizerStats, statsLoading } = useAppSelector(s => s.auth);
    const { myTournaments, isLoading: isTournamentLoading } = useAppSelector(s => s.tournament);

    const [isEditing,  setIsEditing]  = useState(false);
    const [editData,   setEditData]   = useState({ firstName: '', lastName: '', phone: '' });
    const [activeView, setActiveView] = useState<'dashboard' | 'tournaments'>('dashboard');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await dispatch(uploadOrganizerProfileImage(file));
        e.target.value = '';
    };

    React.useEffect(() => {
        dispatch(fetchOrganizerStats());
        dispatch(fetchMyTournaments());
    }, [dispatch]);

    const handleLogout = () => { dispatch(logout()); navigate('/login'); };

    const startEditing = () => {
        setEditData({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '' });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!role) return;
        const result = await dispatch(updateProfile({ role, data: editData }));
        if (updateProfile.fulfilled.match(result)) setIsEditing(false);
    };

    // Compute quick stats from already-loaded tournaments
    const activeTournaments = myTournaments.filter(t =>
        ['registration_open', 'registration_closed', 'auction_in_progress', 'ongoing'].includes(t.status)
    );

    return (
        <div className="min-h-screen bg-[#111] text-white font-montserrat flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />

            {/* Header */}
            <header className="w-full flex items-center justify-between px-8 py-6 max-w-7xl z-10">
                <button
                    onClick={() => navigate('/organizer/home')}
                    className="flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-primary/20 hover:border-primary hover:text-primary transition-all text-white font-medium"
                >
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
            </header>

            {/* Main grid */}
            <main className="w-full max-w-7xl px-8 mt-4 mb-24 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-10 z-10">

                {/* ── LEFT: Profile Card ────────────────────────────────────── */}
                <div className="w-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 flex flex-col shadow-2xl relative overflow-hidden h-fit">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-oswald font-bold tracking-widest text-white">ORGANIZER</h2>
                        <div className="flex gap-4 text-gray-400">
                            <UserPlus className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
                            <Share2   className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
                            <Settings className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
                        </div>
                    </div>

                    {/* Avatar + name */}
                    <div className="flex flex-col items-center gap-4 mb-8">
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpg,image/jpeg,image/gif"
                            className="hidden"
                            onChange={handleImageUpload}
                        />

                        <div className="relative group">
                            <div className="h-28 w-28 rounded-full border-2 border-primary bg-black flex items-center justify-center">
                                <div className="h-full w-full rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-4xl">
                                    {user?.profileImage ? (
                                        <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                                    ) : (
                                        user ? user.firstName[0].toUpperCase() : 'O'
                                    )}
                                </div>
                            </div>

                            {/* Camera upload overlay */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                                title="Change photo"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                                ) : (
                                    <Camera className="h-6 w-6 text-white" />
                                )}
                            </button>
                        </div>

                        {isEditing ? (
                            <div className="flex flex-col gap-2.5 w-full">
                                {[
                                    { key: 'firstName', placeholder: 'First Name' },
                                    { key: 'lastName',  placeholder: 'Last Name'  },
                                    { key: 'phone',     placeholder: 'Phone'      },
                                ].map(({ key, placeholder }) => (
                                    <input
                                        key={key}
                                        value={(editData as any)[key]}
                                        onChange={e => setEditData(p => ({ ...p, [key]: e.target.value }))}
                                        placeholder={placeholder}
                                        className="w-full px-4 py-2.5 rounded-full bg-black/50 border border-white/10 text-white text-center focus:outline-none focus:border-primary text-sm"
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center">
                                <h3 className="text-2xl font-bold font-oswald tracking-wide text-white">
                                    {user ? `${user.firstName} ${user.lastName}` : 'Organizer Name'}
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">{user?.email}</p>
                                {user?.organization?.name && (
                                    <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                                        <Building2 className="h-3 w-3" /> {user.organization.name}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-2 w-full mt-1">
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditing(false)} className="flex-1 py-2 rounded-full border border-white/20 text-sm font-medium hover:bg-white/10 transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={handleSave} disabled={isLoading} className="flex-1 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                                    </button>
                                </div>
                            ) : (
                                <button onClick={startEditing} className="w-full py-2 rounded-full border border-white/20 text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                                    <Pencil className="h-3.5 w-3.5" /> Edit Profile
                                </button>
                            )}
                            <button onClick={handleLogout} className="w-full py-2 rounded-full border border-red-500/50 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors">
                                Logout
                            </button>
                        </div>
                    </div>

                    <div className="h-px w-full bg-white/10 mb-6" />

                    {/* ── Dynamic stats ─────────────────────────────────────── */}
                    {statsLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <StatChip
                                icon={Trophy}
                                label="Total Events"
                                value={organizerStats?.totalTournaments ?? myTournaments.length}
                            />
                            <StatChip
                                icon={TrendingUp}
                                label="Active"
                                value={organizerStats?.activeTournaments ?? activeTournaments.length}
                                accent
                            />
                            <StatChip
                                icon={CheckCircle2}
                                label="Completed"
                                value={organizerStats?.completedTournaments ?? myTournaments.filter(t => t.status === 'completed').length}
                            />
                            <StatChip
                                icon={Users}
                                label="Players Hosted"
                                value={organizerStats?.totalPlayersHosted ?? '—'}
                            />
                        </div>
                    )}

                    <div className="h-px w-full bg-white/10 my-6" />

                    {/* Static profile fields */}
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-primary font-medium text-sm">Mobile</span>
                            <div className="bg-white/5 border border-white/10 rounded-full px-5 py-2.5 text-white font-medium">
                                {user?.phone || '—'}
                            </div>
                        </div>
                        {user?.organization?.description && (
                            <div className="flex flex-col gap-1">
                                <span className="text-primary font-medium text-sm">About</span>
                                <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white font-medium text-sm leading-relaxed">
                                    {user.organization.description}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: Tabs + Content ─────────────────────────────────── */}
                <div className="w-full flex flex-col gap-6">
                    {/* Tabs */}
                    <div className="flex gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl w-fit">
                        {(['dashboard', 'tournaments'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveView(tab)}
                                className={`px-5 py-2.5 rounded-xl capitalize font-medium text-sm transition-all focus:outline-none ${
                                    activeView === tab
                                        ? 'bg-white/10 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {tab === 'tournaments' ? 'My Tournaments' : 'Dashboard'}
                            </button>
                        ))}
                    </div>

                    {/* ── Dashboard ───────────────────────────────────────── */}
                    {activeView === 'dashboard' && (
                        <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <DashboardCard
                                icon={CalendarCheck} title="Tournaments"
                                badge={activeTournaments.length || undefined}
                                onClick={() => setActiveView('tournaments')}
                            />
                            <DashboardCard icon={Bookmark}      title="Drafts"            badge={organizerStats?.draftTournaments || undefined} />
                            <DashboardCard icon={FileText}      title="Invoice" />
                            <DashboardCard icon={Users}         title="Organizers" />
                            <DashboardCard icon={UserPlus}      title="Partners" />
                            <DashboardCard icon={Newspaper}     title="Notices" />
                            <DashboardCard icon={User}          title="Profile"            onClick={startEditing} />
                            <DashboardCard icon={PlusCircle}    title="Create Tournament"  onClick={() => navigate('/organizer/tournament/create')} />
                            <DashboardCard icon={Store}         title="Sponsors" />
                        </div>
                    )}

                    {/* ── My Tournaments ──────────────────────────────────── */}
                    {activeView === 'tournaments' && (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-oswald font-bold tracking-wide">My Tournaments</h3>
                                <button
                                    onClick={() => navigate('/organizer/tournament/create')}
                                    className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-full text-sm font-medium transition-colors"
                                >
                                    <PlusCircle className="h-4 w-4" /> Create New
                                </button>
                            </div>

                            {isTournamentLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                </div>
                            ) : myTournaments.length === 0 ? (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center flex flex-col items-center gap-4">
                                    <Trophy className="h-10 w-10 text-gray-500" />
                                    <p className="text-gray-400">You haven't created any tournaments yet.</p>
                                    <button
                                        onClick={() => navigate('/organizer/tournament/create')}
                                        className="mt-2 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-full transition-colors font-medium"
                                    >
                                        Create Tournament
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {myTournaments.map((t: Tournament) => (
                                        <div
                                            key={t._id}
                                            className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-white/20 transition-colors"
                                        >
                                            <div className="flex gap-4 items-start">
                                                <span className="text-3xl mt-0.5">{sportEmoji(t.sport)}</span>
                                                <div className="flex flex-col gap-1.5">
                                                    <h4 className="text-xl font-bold font-oswald tracking-wide text-white">{t.name}</h4>
                                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                                                        <span>📍 {t.venue?.city || 'TBD'}</span>
                                                        <span className="text-gray-600">•</span>
                                                        <span>🗓 {new Date(t.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    </div>
                                                    <Badge variant="outline" className={`w-fit text-[10px] uppercase font-bold px-2 py-0.5 ${statusColor(t.status)}`}>
                                                        {t.status.replace(/_/g, ' ')}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 w-full md:w-auto shrink-0">
                                                <button
                                                    onClick={() => navigate(`/organizer/tournament/${t._id}`)}
                                                    className="flex-1 md:flex-none px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors text-center"
                                                >
                                                    Manage
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <HoverFooter />
        </div>
    );
};

export default OrganizerProfilePage;
