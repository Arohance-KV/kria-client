import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { LenisProvider, getAppLenis } from '@/context/LenisContext';
import HomePage from './pages/HomePage';
import SignInPage from './pages/auth/SignInPage';
import SignUpPage from './pages/auth/SignUpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import PlayerHomePage from './pages/PlayerHomePage';
import PlayerProfilePage from './pages/PlayerProfilePage';
import PublicPlayerProfilePage from './pages/PublicPlayerProfilePage';
import PlayerTournamentDetailPage from './pages/PlayerTournamentDetailPage';
import OrganizerHomePage from './pages/organizer/OrganizerHomePage';
import CreateTournamentPage from './pages/organizer/CreateTournamentPage';
import TournamentDetailPage from './pages/organizer/TournamentDetailPage';
import AuctionDisplay from './pages/AuctionDisplay';
import BracketPage from './pages/BracketPage';
import ContactPage from './pages/ContactPage';
import SupportPage from './pages/SupportPage';
import OurStoryPage from './pages/OurStoryPage';
import LiveScoreboardPage from './pages/LiveScoreboardPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import OrganizerProfilePage from './pages/organizer/OrganizerProfilePage';
import { sportRegistry } from '@/sports/registry';

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
            </Router>
        </LenisProvider>
    );
}

export default App;
