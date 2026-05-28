/**
 * Badminton sport plugin — side-effect import.
 *
 * Importing this file registers badminton with sportRegistry. It must be
 * imported in main.tsx ABOVE the store import so the registry is populated
 * before store.ts reads it.
 *
 * Phase 1: contributes the team-league section (organizer) and tab (player).
 * Both are shown only if the tournament has at least one team_league category.
 */

import { sportRegistry } from '@/sports/registry';
import TeamLeagueSection from './pages/organizer/TeamLeagueSection';
import TeamLeagueTab from './pages/player-tournament/TeamLeagueTab';
import BadmintonCategoryForm from './pages/organizer/BadmintonCategoryForm';
import BadmintonMatchResultSection from './pages/organizer/BadmintonMatchResultSection';

sportRegistry.register({
    sportKey: 'badminton',
    displayName: 'Badminton',
    categoryForm: BadmintonCategoryForm,
    matchResultSection: BadmintonMatchResultSection,
    organizerTournamentSections: [
        {
            key: 'team_league',
            label: 'Team League',
            component: TeamLeagueSection,
            visible: (categories) => categories.some(c => c.bracketType === 'team_league'),
        },
    ],
    playerTournamentTabs: [
        {
            key: 'team_league',
            label: 'Team League',
            component: TeamLeagueTab,
            visible: (categories) => categories.some(c => c.bracketType === 'team_league'),
        },
    ],
    // organizerRoutes, reducer remain empty — no badminton-specific routes or
    // global Redux state in Stream 1. Add when needed in later phases.
});
