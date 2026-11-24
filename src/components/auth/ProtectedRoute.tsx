import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { Role, fetchProfile } from '../../store/slices/authSlice';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    allowedRoles: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { accessToken, role, user, isLoading } = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();
    const location = useLocation();
    const profileFetched = useRef(false);
    // The account didn't load (server down, a deploy). The session is kept; only a 401 ends it (LAUNCH-AUDIT H20).
    const [loadFailed, setLoadFailed] = useState(false);

    const load = useCallback(async () => {
        setLoadFailed(false);
        const r = await dispatch(fetchProfile());
        if (fetchProfile.rejected.match(r)) setLoadFailed(true);
    }, [dispatch]);

    // Rehydrate user on refresh: token exists but user was lost from Redux
    useEffect(() => {
        if (accessToken && !user && !isLoading && !profileFetched.current) {
            profileFetched.current = true;
            load();
        }
    }, [accessToken, user, isLoading, load]);

    // Not logged in at all -> send to login page
    if (!accessToken) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Still rehydrating user after a refresh — show spinner
    if (!user && isLoading) {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!user && loadFailed) {
        return (
            <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-base font-semibold text-white">Couldn't load your account</p>
                <p className="text-sm text-white/60">Check your connection and try again. You're still signed in.</p>
                <button type="button" onClick={load}
                    className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                    Try again
                </button>
            </div>
        );
    }

    // Finished logging in, but they're trying to access a page outside of their role
    if (role && !allowedRoles.includes(role)) {
        // Route them back to their respective home
        return <Navigate to={`/${role}/home`} replace />;
    }

    // Role is allowed and accessToken exists, render child routes
    return <Outlet />;
};
