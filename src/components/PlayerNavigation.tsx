import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Users, LogOut, Menu, X } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/slices/authSlice';

export const PlayerNavigation = () => {
    const { user } = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Lock body scroll when drawer is open
    useEffect(() => {
        document.body.style.overflow = drawerOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [drawerOpen]);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
        setDrawerOpen(false);
    };

    const avatar = (size: string) => (
        <div className={`${size} rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center text-white font-bold flex-shrink-0`}>
            {user?.profileImage
                ? <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                : <span>{user ? user.firstName[0].toUpperCase() : 'U'}</span>
            }
        </div>
    );

    return (
        <>
            <nav className="w-full max-w-7xl flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2.5 sm:gap-3">
                    <img src={logo} alt="Kria Sports Logo" className="h-8 sm:h-10 w-auto" />
                    <span className="text-xl sm:text-2xl font-oswald font-bold tracking-widest text-white">KRIA</span>
                </Link>

                {/* Desktop: Center nav */}
                <div className="hidden md:flex items-center gap-10 pt-2">
                    <div className="flex flex-col items-center cursor-pointer">
                        <div className="flex items-center gap-2 text-white">
                            <MapPin className="h-5 w-5 text-primary" />
                            <span className="text-lg font-medium">Tournaments</span>
                        </div>
                        <div className="h-0.5 w-full bg-primary mt-1" />
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 hover:text-white cursor-pointer transition-colors pb-1.5">
                        <Users className="h-5 w-5 text-primary" />
                        <span className="text-lg font-medium">Players</span>
                    </div>
                </div>

                {/* Desktop: Profile + Logout */}
                <div className="hidden md:flex items-center gap-6">
                    <Link to="/player/profile" className="flex items-center gap-3 cursor-pointer group">
                        <span className="text-primary font-oswald text-xl font-medium tracking-wide group-hover:text-white transition-colors">
                            {user ? user.firstName.toUpperCase() : 'PROFILE'}
                        </span>
                        <div className="h-10 w-10 rounded-full border border-white/20 overflow-hidden bg-zinc-800 flex items-center justify-center group-hover:border-primary transition-colors text-white font-bold text-lg">
                            {user?.profileImage
                                ? <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                                : (user ? user.firstName[0].toUpperCase() : 'U')
                            }
                        </div>
                    </Link>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors">
                        <LogOut className="h-5 w-5" />
                        <span className="font-oswald tracking-wide font-medium hidden lg:inline">LOGOUT</span>
                    </button>
                </div>

                {/* Mobile: Avatar pill + Hamburger */}
                <div className="flex md:hidden items-center gap-2.5">
                    <Link
                        to="/player/profile"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
                    >
                        {avatar('h-6 w-6 text-xs')}
                        <span className="text-white text-sm font-medium">{user?.firstName || 'Profile'}</span>
                    </Link>
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white"
                        aria-label="Open menu"
                    >
                        <Menu className="h-4.5 w-4.5" />
                    </button>
                </div>
            </nav>

            {/* ── Mobile Drawer ───────────────────────────────────────────── */}
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setDrawerOpen(false)}
            />

            {/* Panel */}
            <div className={`fixed top-0 right-0 h-full w-[300px] max-w-[85vw] bg-[#0d0d0d] border-l border-white/8 z-50 flex flex-col md:hidden transition-transform duration-300 ease-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-5 border-b border-white/8">
                    <img src={logo} alt="Kria" className="h-7 w-auto opacity-80" />
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="h-8 w-8 rounded-full bg-white/8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Profile card */}
                <Link
                    to="/player/profile"
                    onClick={() => setDrawerOpen(false)}
                    className="mx-4 mt-4 flex items-center gap-4 p-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/6 hover:border-primary/30 transition-all"
                >
                    <div className="h-12 w-12 rounded-full border-2 border-primary/40 overflow-hidden bg-zinc-800 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {user?.profileImage
                            ? <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                            : (user ? user.firstName[0].toUpperCase() : 'U')
                        }
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-semibold truncate">{user?.firstName} {user?.lastName}</p>
                        <p className="text-gray-500 text-xs mt-0.5">View Profile →</p>
                    </div>
                </Link>

                {/* Nav links */}
                <div className="flex flex-col gap-1 px-4 mt-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 px-2 mb-2 font-bold">Navigation</p>
                    {[
                        { icon: MapPin, label: 'Tournaments', active: true },
                        { icon: Users, label: 'Players', active: false },
                    ].map(({ icon: Icon, label, active }) => (
                        <button
                            key={label}
                            onClick={() => setDrawerOpen(false)}
                            className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                                active
                                    ? 'bg-primary/12 text-primary border border-primary/20'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                            }`}
                        >
                            <Icon className="h-4.5 w-4.5" />
                            {label}
                            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                        </button>
                    ))}
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Sign out */}
                <div className="px-4 pb-8 border-t border-white/8 pt-4">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/8 border border-transparent hover:border-red-500/15 transition-all"
                    >
                        <LogOut className="h-4.5 w-4.5" />
                        Sign Out
                    </button>
                </div>
            </div>
        </>
    );
};
