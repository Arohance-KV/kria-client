import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, UserPlus, Share2, Settings, CalendarCheck, Bookmark, FileText,
    Users, Newspaper, User, PlusCircle, Store, Pencil, Save, Loader2,
    Trophy, Swords, Star, MapPin, TrendingUp, Award, IndianRupee, Camera,
} from 'lucide-react';
import HoverFooter from '@/components/HoverFooter';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout, updateProfile, fetchPlayerStats, uploadPlayerProfileImage } from '../store/slices/authSlice';
import { fetchMyRegistrations, withdrawRegistration, fetchPlayerTournamentHistory, TournamentHistoryEntry } from '../store/slices/registrationSlice';
import { Badge } from '@/components/ui/badge';
import { getMyPayments } from '@/api/payment';

// ─── Dashboard card ──────────────────────────────────────────────────────────
const DashboardCard = ({ icon: Icon, title, onClick }: { icon: any; title: string; onClick?: () => void }) => (
    <div
        onClick={onClick}
        className="group relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-white/5 border border-white/10 cursor-pointer transition-all duration-300 hover:bg-white/10 hover:border-primary/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 overflow-hidden aspect-square"
    >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <Icon className="h-12 w-12 text-primary group-hover:scale-110 transition-transform duration-300 ease-out z-10" strokeWidth={1.5} />
        <span className="text-lg font-bold font-oswald tracking-wide text-white z-10 group-hover:text-primary transition-colors">{title}</span>
    </div>
);

// ─── Skill badge ─────────────────────────────────────────────────────────────
const skillColor = (level?: string) => {
    switch (level?.toLowerCase()) {
        case 'beginner':     return 'text-blue-400  border-blue-400/30  bg-blue-400/10';
        case 'intermediate': return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
        case 'advanced':     return 'text-primary   border-primary/30   bg-primary/10';
        case 'professional': return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
        default:             return 'text-gray-400  border-gray-400/30  bg-gray-400/10';
    }
};

// ─── Tournament status badge ──────────────────────────────────────────────────
const tournamentStatusColor = (status: string) => {
    switch (status) {
        case 'completed':   return 'text-green-400 border-green-400/20 bg-green-400/10';
        case 'ongoing':     return 'text-blue-400  border-blue-400/20  bg-blue-400/10';
        case 'cancelled':   return 'text-red-400   border-red-400/20   bg-red-400/10';
        default:            return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
    }
};

// ─── Registration status badge ────────────────────────────────────────────────
const regStatusColor = (status: string) => {
    if (status === 'approved' || status === 'assigned') return 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10';
    if (status === 'auctioned')                          return 'text-primary border-primary/20 bg-primary/10';
    if (status === 'rejected' || status === 'withdrawn') return 'text-red-400 border-red-400/20 bg-red-400/10';
    return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
};

// ─── Sport emoji ──────────────────────────────────────────────────────────────
const sportEmoji = (sport?: string) => {
    const map: Record<string, string> = { badminton: '🏸', cricket: '🏏', football: '⚽', tennis: '🎾', table_tennis: '🏓', kabaddi: '🤼' };
    return sport ? (map[sport.toLowerCase()] ?? '🏅') : '🏅';
};

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

// ─── Main Component ───────────────────────────────────────────────────────────
const PlayerProfilePage = () => {
    const navigate  = useNavigate();
    const dispatch  = useAppDispatch();
    const { user, role, isLoading, playerStats, statsLoading, error } = useAppSelector(s => s.auth);
    const { myRegistrations, isLoading: isRegLoading, tournamentHistory, historyLoading } = useAppSelector(s => s.registration);

    const [isEditing, setIsEditing] = useState(false);
    const [editData,  setEditData]  = useState({ firstName: '', lastName: '', phone: '', gender: '', dateOfBirth: '', sport: '', location: '' });
    const [activeView, setActiveView] = useState<'dashboard' | 'registrations' | 'history' | 'invoices'>('dashboard');
    const [invoices, setInvoices]     = useState<any[]>([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await dispatch(uploadPlayerProfileImage(file));
        // Reset input so same file can be re-selected if needed
        e.target.value = '';
    };

    React.useEffect(() => {
        dispatch(fetchMyRegistrations());
        dispatch(fetchPlayerStats());
    }, [dispatch]);

    React.useEffect(() => {
        if (activeView === 'history' && tournamentHistory.length === 0) {
            dispatch(fetchPlayerTournamentHistory());
        }
        if (activeView === 'invoices' && invoices.length === 0) {
            setInvoicesLoading(true);
            getMyPayments().then(data => setInvoices(data || [])).catch(() => {}).finally(() => setInvoicesLoading(false));
        }
    }, [activeView, dispatch]);

    const handleLogout = () => { dispatch(logout()); navigate('/login'); };

    const startEditing = () => {
        setEditData({
            firstName: user?.firstName || '',
            lastName:  user?.lastName  || '',
            phone:     user?.phone     || '',
            gender:    user?.gender    || '',
            dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
            sport:     user?.sport     || '',
            location:  user?.location  || '',
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!role) return;
        // Required fields are always sent; optional fields are omitted when blank.
        // The server validators use `.optional()`, which only skips `undefined` —
        // an empty string (e.g. dateOfBirth: "") still hits isISO8601() and 400s.
        // Omitting blank keys also leaves existing values untouched ($set semantics).
        const payload: Record<string, string> = {
            firstName: editData.firstName,
            lastName:  editData.lastName,
            phone:     editData.phone,
        };
        (['gender', 'dateOfBirth', 'sport', 'location'] as const).forEach(key => {
            const val = editData[key]?.trim();
            if (val) payload[key] = val;
        });
        const result = await dispatch(updateProfile({ role, data: payload }));
        if (updateProfile.fulfilled.match(result)) setIsEditing(false);
    };

    const handleWithdraw = async (id: string) => {
        if (window.confirm('Are you sure you want to withdraw this registration?'))
            await dispatch(withdrawRegistration(id));
    };

    // ── Computed stats from registrations (fast, no extra API) ────────────────
    const activeRegs = myRegistrations.filter(r => !['withdrawn', 'rejected'].includes(r.status));

    return (
        <div className="min-h-screen bg-[#111] text-white font-montserrat flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />

            {/* Header */}
            <header className="w-full flex items-center justify-between px-8 py-6 max-w-7xl z-10">
                <button
                    onClick={() => navigate('/player/home')}
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
                        <h2 className="text-2xl font-oswald font-bold tracking-widest text-white">PROFILE</h2>
                        <div className="flex gap-4 text-gray-400">
                            <UserPlus className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
                            <Share2  className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
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
                                        user ? user.firstName[0].toUpperCase() : 'U'
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

                            {/* Sport badge on avatar */}
                            {user?.sport && (
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-sm">
                                    {sportEmoji(user.sport)}
                                </div>
                            )}
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
                                <select
                                    value={(editData as any).gender}
                                    onChange={e => setEditData(p => ({ ...p, gender: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-full bg-black/50 border border-white/10 text-white text-center focus:outline-none focus:border-primary text-sm appearance-none"
                                >
                                    <option value="">Select Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                                <DOBPicker
                                    value={editData.dateOfBirth}
                                    onChange={val => setEditData(p => ({ ...p, dateOfBirth: val }))}
                                />
                                {[
                                    { key: 'sport',    placeholder: 'Sport (e.g. Badminton)' },
                                    { key: 'location', placeholder: 'Location (e.g. Bangalore)' },
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
                                    {user ? `${user.firstName} ${user.lastName}` : 'Player Name'}
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">{user?.email}</p>
                                {user?.location && (
                                    <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                                        <MapPin className="h-3 w-3" /> {user.location}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-2 w-full mt-1">
                            {isEditing && error && (
                                <p className="text-xs text-red-400 text-center bg-red-500/10 border border-red-500/30 rounded-full px-3 py-2">
                                    {error}
                                </p>
                            )}
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

                    {/* ── Dynamic stats grid ─────────────────────────────────── */}
                    {statsLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <StatChip icon={Trophy}       label="Tournaments" value={playerStats?.totalTournaments ?? activeRegs.length} />
                            <StatChip icon={Swords}        label="Matches"    value={playerStats?.totalMatchesPlayed ?? 0} />
                            <StatChip icon={Star}          label="Wins"       value={playerStats?.totalMatchesWon ?? 0} />
                            <StatChip icon={TrendingUp}    label="Points"     value={playerStats?.totalPointsContributed ?? 0} />
                            {(playerStats?.highestBid ?? 0) > 0 && (
                                <div className="col-span-2">
                                    <StatChip icon={IndianRupee} label="Highest Bid" value={`₹${(playerStats?.highestBid ?? 0).toLocaleString()}`} accent />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Titles ─────────────────────────────────────────────── */}
                    {user?.titles && user.titles.length > 0 && (
                        <div className="flex flex-col gap-3 mt-6">
                            <span className="text-sm uppercase tracking-wider font-oswald text-gray-400">Honors & Titles</span>
                            <div className="flex flex-col gap-2">
                                {user.titles.map((t: string, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 bg-gradient-to-r from-primary/20 to-transparent border border-primary/30 p-3 rounded-xl shadow-inner shadow-primary/10">
                                        <Award className="h-5 w-5 text-primary shrink-0" />
                                        <span className="text-sm font-semibold text-white tracking-wide">{t}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="h-px w-full bg-white/10 my-6" />

                    {/* ── Profile fields ────────────────────────────────────── */}
                    <div className="flex flex-col gap-4">
                        <StatField label="Mobile" value={user?.phone || '—'} />
                        <StatField label="Gender" value={user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : '—'} />
                        <StatField label="Date of Birth" value={user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : '—'} />
                        <StatField label="Sport"  value={user?.sport || '—'} />
                        <StatField label="Location" value={user?.location || '—'} />
                    </div>
                </div>

                {/* ── RIGHT: Tabs + Content ─────────────────────────────────── */}
                <div className="w-full flex flex-col gap-6">
                    {/* Tabs */}
                    <div className="flex gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl w-fit flex-wrap">
                        {(['dashboard', 'registrations', 'history', 'invoices'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveView(tab)}
                                className={`px-5 py-2.5 rounded-xl capitalize font-medium text-sm transition-all focus:outline-none ${
                                    activeView === tab
                                        ? 'bg-white/10 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {tab === 'history' ? 'Tournament History' : tab === 'registrations' ? 'My Registrations' : tab === 'invoices' ? 'Invoices' : 'Dashboard'}
                            </button>
                        ))}
                    </div>

                    {/* ── Dashboard ───────────────────────────────────────── */}
                    {activeView === 'dashboard' && (
                        <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <DashboardCard icon={CalendarCheck} title="My Events"         onClick={() => setActiveView('registrations')} />
                            <DashboardCard icon={Trophy}        title="History"            onClick={() => setActiveView('history')} />
                            <DashboardCard icon={Bookmark}      title="Saved" />
                            <DashboardCard icon={FileText}      title="Invoice"            onClick={() => setActiveView('invoices')} />
                            <DashboardCard icon={Users}         title="My Team" />
                            <DashboardCard icon={Newspaper}     title="My News" />
                            <DashboardCard icon={User}          title="Profile"            onClick={startEditing} />
                            <DashboardCard icon={PlusCircle}    title="Find Tournaments"   onClick={() => navigate('/player/home')} />
                            <DashboardCard icon={Store}         title="Store" />
                        </div>
                    )}

                    {/* ── My Registrations ────────────────────────────────── */}
                    {activeView === 'registrations' && (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-2xl font-oswald font-bold tracking-wide">Tournament Registrations</h3>

                            {isRegLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                </div>
                            ) : myRegistrations.length === 0 ? (
                                <EmptyState icon={Trophy} message="You haven't registered for any tournaments yet." cta="Find Tournaments" onCta={() => navigate('/player/home')} />
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {myRegistrations.map((reg: any) => (
                                        <div key={reg._id} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-white/20 transition-colors">
                                            <div className="flex flex-col gap-2">
                                                <h4 className="text-xl font-bold font-oswald tracking-wide text-white">
                                                    {reg.tournamentDetails?.name || 'Tournament'}
                                                </h4>
                                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                                    <span className="text-gray-400">Category: {reg.categoryDetails?.name || 'Category'}</span>
                                                    <span className="text-gray-600">•</span>
                                                    <span className="text-gray-400 border border-white/10 px-2 py-0.5 rounded-md text-xs bg-black/20">
                                                        Fee: ₹{reg.categoryDetails?.registrationFee || 0}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <Badge variant="outline" className={`px-2 py-0.5 text-[10px] uppercase font-bold ${regStatusColor(reg.status)}`}>
                                                        {reg.status}
                                                    </Badge>
                                                    <Badge variant="outline" className="px-2 py-0.5 text-[10px] uppercase font-bold text-gray-400 border-gray-400/20 bg-gray-400/10">
                                                        {reg.paymentStatus} Payment
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0">
                                                <button onClick={() => navigate(`/player/tournament/${reg.tournamentId}`)} className="flex-1 md:flex-none px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors text-center">
                                                    View
                                                </button>
                                                {(reg.status === 'pending' || reg.status === 'approved') && (
                                                    <button onClick={() => handleWithdraw(reg._id)} className="flex-1 md:flex-none px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors text-center">
                                                        Withdraw
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Invoices ──────────────────────────────────────── */}
                    {activeView === 'invoices' && (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-2xl font-oswald font-bold tracking-wide">Payment Invoices</h3>

                            {invoicesLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                </div>
                            ) : invoices.length === 0 ? (
                                <EmptyState icon={IndianRupee} message="No payments made yet." cta="Find Tournaments" onCta={() => navigate('/player/home')} />
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {invoices.map((inv: any) => (
                                        <div key={inv._id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
                                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                                <div className="flex flex-col gap-2 flex-1 min-w-0">
                                                    <h4 className="text-lg font-bold font-oswald tracking-wide text-white truncate">
                                                        {inv.tournament?.name || 'Tournament'}
                                                    </h4>
                                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                                                        {inv.category?.name && <span>Category: {inv.category.name}</span>}
                                                        <span className="text-gray-600">|</span>
                                                        <span>Order: {inv.razorpayOrderId}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="px-2 py-0.5 text-[10px] uppercase font-bold text-emerald-400 border-emerald-400/20 bg-emerald-400/10">
                                                            {inv.status}
                                                        </Badge>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end justify-center shrink-0">
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-oswald">Amount Paid</span>
                                                    <span className="text-2xl font-mono font-black text-primary">
                                                        ₹{inv.amount?.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Total */}
                                    <div className="flex justify-end pt-4 border-t border-white/10">
                                        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-6 py-3">
                                            <span className="text-sm font-oswald uppercase tracking-wider text-gray-300">Total Paid</span>
                                            <span className="text-2xl font-mono font-black text-primary">
                                                ₹{invoices.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Tournament History ──────────────────────────────── */}
                    {activeView === 'history' && (
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-2xl font-oswald font-bold tracking-wide">Tournament History</h3>

                            {/* Aggregate stats banner */}
                            {playerStats && playerStats.totalTournaments > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <MiniStat label="Tournaments" value={playerStats.totalTournaments} color="text-white" />
                                    <MiniStat label="Matches"     value={playerStats.totalMatchesPlayed} color="text-blue-400" />
                                    <MiniStat label="Wins"        value={playerStats.totalMatchesWon}    color="text-green-400" />
                                    {playerStats.totalEarnings > 0 && (
                                        <MiniStat label="Total Earnings" value={`₹${playerStats.totalEarnings.toLocaleString()}`} color="text-primary" />
                                    )}
                                </div>
                            )}

                            {historyLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                </div>
                            ) : tournamentHistory.length === 0 ? (
                                <EmptyState icon={Award} message="No tournament history yet. Register and participate to see your journey here." cta="Find Tournaments" onCta={() => navigate('/player/home')} />
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {tournamentHistory.map((entry: TournamentHistoryEntry) => (
                                        <HistoryCard key={entry._id} entry={entry} />
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

// ─── History card ─────────────────────────────────────────────────────────────
const HistoryCard = ({ entry }: { entry: TournamentHistoryEntry }) => {
    const t    = entry.tournament;
    const cat  = entry.category;
    const team = entry.team;
    const stats = entry.stats;

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                {/* Left info */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xl">{sportEmoji(t?.sport)}</span>
                        <h4 className="text-lg font-bold font-oswald tracking-wide text-white truncate">
                            {t?.name || 'Tournament'}
                        </h4>
                        {t?.status && (
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0.5 ${tournamentStatusColor(t.status)}`}>
                                {t.status}
                            </Badge>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                        {cat?.name && <span>📂 {cat.name}</span>}
                        {t?.venue?.city && <><span className="text-gray-600">•</span><span>📍 {t.venue.city}</span></>}
                        {t?.startDate && (
                            <><span className="text-gray-600">•</span>
                            <span>🗓 {new Date(t.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span></>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0.5 ${regStatusColor(entry.status)}`}>
                            {entry.status}
                        </Badge>
                        {entry.profile?.skillLevel && (
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0.5 ${skillColor(entry.profile.skillLevel)}`}>
                                {entry.profile.skillLevel}
                            </Badge>
                        )}
                        {team && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-white/5 border-white/20 text-white flex items-center gap-1">
                                {team.primaryColor && (
                                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: team.primaryColor }} />
                                )}
                                {team.name}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Right: stats + auction price */}
                <div className="flex flex-col gap-2 items-end shrink-0">
                    {entry.auctionData?.soldPrice ? (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-oswald">{entry.status === 'auctioned' ? 'Auction Price' : 'Price'}</span>
                            <span className="text-2xl font-mono font-black text-primary">
                                ₹{entry.auctionData.soldPrice.toLocaleString()}
                            </span>
                        </div>
                    ) : entry.auctionData?.basePrice ? (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-oswald">Base Price</span>
                            <span className="text-lg font-mono font-bold text-gray-300">
                                ₹{entry.auctionData.basePrice.toLocaleString()}
                            </span>
                        </div>
                    ) : null}

                    {stats && (stats.matchesPlayed > 0 || stats.matchesWon > 0) && (
                        <div className="flex gap-3 mt-1">
                            <MiniStat label="Played" value={stats.matchesPlayed} color="text-white" small />
                            <MiniStat label="Won"    value={stats.matchesWon}    color="text-green-400" small />
                            {stats.pointsContributed > 0 && (
                                <MiniStat label="Pts" value={stats.pointsContributed} color="text-primary" small />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const StatField = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-1">
        <span className="text-primary font-medium text-sm">{label}</span>
        <div className="bg-white/5 border border-white/10 rounded-full px-5 py-2.5 text-white font-medium">
            {value}
        </div>
    </div>
);

const MiniStat = ({ label, value, color, small }: { label: string; value: string | number; color: string; small?: boolean }) => (
    <div className={`flex flex-col items-center bg-white/5 border border-white/10 rounded-xl px-4 ${small ? 'py-2' : 'py-3'}`}>
        <span className={`${small ? 'text-lg' : 'text-2xl'} font-bold font-oswald ${color}`}>{value}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-oswald">{label}</span>
    </div>
);

const EmptyState = ({ icon: Icon, message, cta, onCta }: { icon: any; message: string; cta: string; onCta: () => void }) => (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center flex flex-col items-center gap-4">
        <Icon className="h-10 w-10 text-gray-500" />
        <p className="text-gray-400 max-w-xs">{message}</p>
        <button onClick={onCta} className="mt-2 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-full transition-colors font-medium">
            {cta}
        </button>
    </div>
);

// ─── Date of Birth Picker ──────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const selectCls = 'flex-1 px-3 py-2.5 rounded-full bg-black/50 border border-white/10 text-white text-sm text-center focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer hover:bg-black/70';

const DOBPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);

    // Keep the three parts in local state. Driving the <select>s straight from
    // `value` meant an incomplete pick (e.g. only the year) resolved back to ''
    // and the dropdowns snapped to their placeholder, so a full date could never
    // be assembled and DOB was never sent. Seed once from the incoming value.
    const [day, setDay]     = React.useState(() => (value ? value.split('-')[2] || '' : ''));
    const [month, setMonth] = React.useState(() => (value ? value.split('-')[1] || '' : ''));
    const [year, setYear]   = React.useState(() => (value ? value.split('-')[0] || '' : ''));

    const daysInMonth = React.useMemo(() => {
        if (!month || !year) return 31;
        return new Date(parseInt(year), parseInt(month), 0).getDate();
    }, [month, year]);

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Emit a combined ISO date (YYYY-MM-DD) only once all three parts are set.
    const emit = (d: string, m: string, y: string) => {
        if (d && m && y) {
            const maxDay = new Date(parseInt(y), parseInt(m), 0).getDate();
            const safeDay = Math.min(parseInt(d), maxDay).toString().padStart(2, '0');
            onChange(`${y}-${m.padStart(2, '0')}-${safeDay}`);
        } else {
            onChange('');
        }
    };

    const pickDay   = (d: string) => { setDay(d); emit(d, month, year); };
    const pickMonth = (m: string) => {
        // Clamp an already-chosen day to the new month's length (e.g. 31 → Feb).
        const max = year ? new Date(parseInt(year), parseInt(m), 0).getDate() : 31;
        const d   = day && parseInt(day) > max ? String(max).padStart(2, '0') : day;
        setMonth(m); setDay(d); emit(d, m, year);
    };
    const pickYear  = (y: string) => {
        const max = month ? new Date(parseInt(y), parseInt(month), 0).getDate() : 31;
        const d   = day && parseInt(day) > max ? String(max).padStart(2, '0') : day;
        setYear(y); setDay(d); emit(d, month, y);
    };

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <span className="text-xs text-gray-500 text-center tracking-wide uppercase font-medium">Date of Birth</span>
            <div className="flex gap-2 w-full">
                {/* Day */}
                <select
                    value={day}
                    onChange={e => pickDay(e.target.value)}
                    className={selectCls}
                    style={{ WebkitAppearance: 'none' }}
                >
                    <option value="" disabled>Day</option>
                    {days.map(d => (
                        <option key={d} value={String(d).padStart(2, '0')} className="bg-zinc-900">
                            {d}
                        </option>
                    ))}
                </select>

                {/* Month */}
                <select
                    value={month}
                    onChange={e => pickMonth(e.target.value)}
                    className={selectCls}
                    style={{ WebkitAppearance: 'none', flex: '1.6' }}
                >
                    <option value="" disabled>Month</option>
                    {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1).padStart(2, '0')} className="bg-zinc-900">
                            {m}
                        </option>
                    ))}
                </select>

                {/* Year */}
                <select
                    value={year}
                    onChange={e => pickYear(e.target.value)}
                    className={selectCls}
                    style={{ WebkitAppearance: 'none', flex: '1.3' }}
                >
                    <option value="" disabled>Year</option>
                    {years.map(y => (
                        <option key={y} value={String(y)} className="bg-zinc-900">
                            {y}
                        </option>
                    ))}
                </select>
            </div>
            {day && month && year && (
                <p className="text-xs text-primary/70 text-center mt-0.5">
                    {parseInt(day)} {MONTHS[parseInt(month) - 1]} {year}
                </p>
            )}
        </div>
    );
};

export default PlayerProfilePage;
