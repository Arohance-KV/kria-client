/**
 * Cricket sport plugin — side-effect import.
 * Registered in main.tsx below badminton, above the store import.
 */

import React from 'react';
import { Route } from 'react-router-dom';
import { sportRegistry } from '@/sports/registry';
import CricketCategoryForm from './pages/organizer/CricketCategoryForm';
import CricketScoreButton from './pages/organizer/CricketScoreButton';
import CricketLeaderboard from './pages/public/CricketLeaderboard';
import cricketLiveStateReducer from './store/cricketLiveStateSlice';

// Full-page, so they load on first visit; App and LiveScoreboardPage hold the Suspense.
const CricketScoringConsole = React.lazy(() => import('./pages/organizer/CricketScoringConsole'));
const CricketLiveScoreboard = React.lazy(() => import('./pages/public/CricketLiveScoreboard'));

sportRegistry.register({
    sportKey: 'cricket',
    displayName: 'Cricket',
    categoryForm: CricketCategoryForm,
    matchResultSection: CricketScoreButton,
    liveScoreboardRenderer: CricketLiveScoreboard,
    leaderboardRenderer: CricketLeaderboard,
    reducer: { cricketLiveState: cricketLiveStateReducer },
    organizerRoutes: [
        React.createElement(Route, {
            key: 'cricket:score',
            path: '/organizer/cricket/match/:matchId/score',
            element: React.createElement(CricketScoringConsole),
        }),
    ],
});
