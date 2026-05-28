/**
 * Cricket sport plugin — side-effect import.
 * Registered in main.tsx below badminton, above the store import.
 */

import React from 'react';
import { Route } from 'react-router-dom';
import { sportRegistry } from '@/sports/registry';
import CricketCategoryForm from './pages/organizer/CricketCategoryForm';
import CricketScoreButton from './pages/organizer/CricketScoreButton';
import CricketScoringConsole from './pages/organizer/CricketScoringConsole';
import CricketLiveScoreboard from './pages/public/CricketLiveScoreboard';
import cricketLiveStateReducer from './store/cricketLiveStateSlice';

sportRegistry.register({
    sportKey: 'cricket',
    displayName: 'Cricket',
    categoryForm: CricketCategoryForm,
    matchResultSection: CricketScoreButton,
    liveScoreboardRenderer: CricketLiveScoreboard,
    reducer: { cricketLiveState: cricketLiveStateReducer },
    organizerRoutes: [
        React.createElement(Route, {
            key: 'cricket:score',
            path: '/organizer/cricket/match/:matchId/score',
            element: React.createElement(CricketScoringConsole),
        }),
    ],
});
