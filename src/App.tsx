import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { LenisProvider, getAppLenis } from '@/context/LenisContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { sportRegistry } from '@/sports/registry';

// Pages load on first visit, keeping marketing-only libraries (framer-motion) out of the app bundle.
const HomePage = lazy(() => import('./pages/HomePage'));
const SignInPage = lazy(() => import('./pages/auth/SignInPage'));
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const PlayerHomePage = lazy(() => import('./pages/PlayerHomePage'));
const PlayerProfilePage = lazy(() => import('./pages/PlayerProfilePage'));
const PublicPlayerProfilePage = lazy(() => import('./pages/PublicPlayerProfilePage'));
const PlayerTournamentDetailPage = lazy(() => import('./pages/PlayerTournamentDetailPage'));
const OrganizerHomePage = lazy(() => import('./pages/organizer/OrganizerHomePage'));
const CreateTournamentPage = lazy(() => import('./pages/organizer/CreateTournamentPage'));
const TournamentDetailPage = lazy(() => import('./pages/organizer/TournamentDetailPage'));
const AuctionDisplay = lazy(() => import('./pages/AuctionDisplay'));
const BracketPage = lazy(() => import('./pages/BracketPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const OurStoryPage = lazy(() => import('./pages/OurStoryPage'));
const LiveScoreboardPage = lazy(() => import('./pages/LiveScoreboardPage'));
const OrganizerProfilePage = lazy(() => import('./pages/organizer/OrganizerProfilePage'));

function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => {
        const lenis = getAppLenis();
        if (lenis) {
            lenis.scrollTo(0, { immediate: true });
        } else {
            window.scrollTo(0, 0);
        }
    }, [pathname]);
    return null;
}

function App() {
    return (
        <LenisProvider>
            <Router>
                <ScrollToTop />
                <Suspense fallback={null}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/contact" element={<ContactPage />} />
                        <Route path="/support" element={<SupportPage />} />
                        <Route path="/story" element={<OurStoryPage />} />
                        <Route path="/login" element={<SignInPage />} />
                        <Route path="/register" element={<SignUpPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                        {/* Public Auction Display (Broadcast Screen) */}
                        <Route path="/auction/:tournamentId/:categoryId" element={<AuctionDisplay />} />

                        {/* Public Bracket View */}
                        <Route path="/bracket/:tournamentId/:categoryId" element={<BracketPage />} />

                        {/* Public Live Scoreboard (Broadcast Screen) */}
                        <Route path="/live/:matchId" element={<LiveScoreboardPage />} />

                        {/* Public Player Profile (anyone can view a player's sports + stats) */}
                        <Route path="/players/:id" element={<PublicPlayerProfilePage />} />

                        {/* Protected Player Routes */}
                        <Route element={<ProtectedRoute allowedRoles={['player']} />}>
                            <Route path="/player/home" element={<PlayerHomePage />} />
                            <Route path="/player/profile" element={<PlayerProfilePage />} />
                            <Route path="/player/tournament/:id" element={<PlayerTournamentDetailPage />} />
                        </Route>

                        {/* Protected Organizer Routes */}
                        <Route element={<ProtectedRoute allowedRoles={['organizer']} />}>
                            <Route path="/organizer/home" element={<OrganizerHomePage />} />
                            <Route path="/organizer/profile" element={<OrganizerProfilePage />} />
                            <Route path="/organizer/tournament/create" element={<CreateTournamentPage />} />
                            <Route path="/organizer/tournament/:id" element={<TournamentDetailPage />} />

                            {/* Sport-plugin-contributed organizer routes. Empty in Phase 0. */}
                            {sportRegistry.list().flatMap(plugin => plugin.organizerRoutes ?? [])}
                        </Route>
                    </Routes>
                </Suspense>
            </Router>
        </LenisProvider>
    );
}

export default App;
