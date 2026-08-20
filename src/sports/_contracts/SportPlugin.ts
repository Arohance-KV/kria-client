/**
 * SportPlugin contract — implemented by each sport folder under `client/src/sports/<sport>/`.
 *
 * Boundary rules (enforced by ESLint in Phase 2):
 *   1. Files outside `client/src/sports/` may import from `@/sports/_contracts/*`
 *      and `@/sports/registry` only — never from `@/sports/<sport>/*`.
 *   2. Files inside `client/src/sports/<sport>/` may not import from
 *      `client/src/sports/<other-sport>/*`.
 *
 * The contract grows additively. When a future sport needs a new slot
 * (e.g. publicBracketRenderer, liveScoreRenderer, categoryFormFields),
 * add it as a new OPTIONAL key — never modify or remove existing keys.
 */

import type { ComponentType, ReactElement } from 'react';
import type { Reducer } from '@reduxjs/toolkit';

export interface SportPlugin {
    /** Stable identifier — matches the tournament's `sport` field on the server. */
    sportKey: string;

    /** Human-readable name for menus, badges, page titles. */
    displayName: string;

    /**
     * Routes the plugin contributes to the organizer's protected route tree.
     * Each entry is an already-constructed <Route> JSX element. The shell
     * renders them inside <Routes> as siblings of the static organizer routes.
     *
     * Each element MUST have a unique `key` prop set by the plugin
     * (React renders these inside a list — missing keys produce console warnings).
     * Convention: prefix with the sportKey, e.g. <Route key="badminton:team-league/:id" .../>.
     *
     * For Phase 0 this is empty; populated in Phase 1 if a sport needs its
     * own organizer pages.
     */
    organizerRoutes?: ReactElement[];

    /**
     * Tabs the plugin contributes to the player-tournament page's tab strip.
     * The shell shows the union of all plugins' tabs, filtered by `visible(categories)`.
     */
    playerTournamentTabs?: PlayerTournamentTab[];

    /**
     * Sections the plugin contributes to the organizer's TournamentDetailPage.
     * Same model as tabs.
     */
    organizerTournamentSections?: OrganizerTournamentSection[];

    /**
     * Redux slices the plugin owns. Keyed by slice name; merged into the root reducer
     * at store-build time. Plugins MUST namespace slice keys to avoid collision
     * (e.g., 'badmintonMatch', 'cricketLiveState'). The registry throws at register()
     * time if two plugins declare the same slice key.
     */
    reducer?: Record<string, Reducer>;

    /**
     * The sport's complete category create/edit form. Rendered by the shared
     * CategoriesSection shell, which looks this up by the tournament's sport.
     * Each sport owns its entire form (full split) because the sport-specific
     * portion (config + bracketType options) is the majority of the form.
     * Generic inputs (name/gender/age/fee) are shared via the core
     * CategoryCommonFields component, which each form composes.
     * Populated in Phase F1.
     */
    categoryForm?: ComponentType<CategoryFormProps>;

    /**
     * Renders the sport-specific result-entry affordance for a single match
     * (e.g. badminton's "Record Result" button + inline game-score form).
     * The shared bracket/match sections render the generic card frame
     * (competitor names, status, swap) and drop this in where scoring belongs.
     * A sport without inline result entry (e.g. cricket in the foundation —
     * its scoring is a separate live-scoring flow) simply omits this slot,
     * and no scorer is shown.
     */
    matchResultSection?: ComponentType<MatchResultSectionProps>;

    /**
     * Renders a sport's public, read-only live scoreboard for a single match.
     * The core /live/:matchId shell resolves the match's sport and delegates here.
     * A sport without a live scoreboard simply omits this slot.
     */
    liveScoreboardRenderer?: ComponentType<{ matchId: string }>;
}

export interface PlayerTournamentTab {
    /** Stable key for React lists & URL deep-linking. Must match a key the shell knows about. */
    key: string;
    label: string;
    component: ComponentType<TabProps>;
    /**
     * Predicate over the tournament's categories list. Tab is shown if the
     * predicate returns true. Tabs in the player-tournament shell span the
     * whole tournament (user picks a category INSIDE the tab), so visibility
     * is "does any category here make this tab relevant?" — not "is this
     * single category relevant?".
     *
     * Categories are typed `any[]` because shells currently pass differently-shaped
     * category projections (organizer shell maps to `{ _id, name, status, bracketType,
     * teamLeagueConfig }`; player shell passes registration-slice `Category`).
     * Plugin predicates inspect only the fields they need (typically `bracketType`).
     * Tightening this type is post-Stream-2 cleanup work.
     */
    visible: (categories: any[]) => boolean;
}

export interface OrganizerTournamentSection {
    /** Stable key. Must match a section key the shell knows about (e.g. 'team_league'). */
    key: string;
    label: string;
    component: ComponentType<SectionProps>;
    /** Same list-level loose signature as PlayerTournamentTab.visible. */
    visible: (categories: any[]) => boolean;
}

/**
 * Minimal generic shape for a category as the core knows it.
 *
 * Intentionally NO sport-specific fields — plugins fetch their own detail
 * via their own API module.
 *
 * NOT currently used by the `visible` predicate or by `TabProps.categories`
 * (both are `any[]` in Phase 1 because shells still pass differently-shaped
 * rich category objects with badminton-specific fields). After the
 * post-Stream-2 cleanup that slims `categorySlice`, the shells will project
 * to this shape and `any[]` here can tighten to `CategoryContext[]`.
 */
export interface CategoryContext {
    id: string;
    sport: string;
    bracketType: string;
    status: string;
}

export interface TabProps {
    tournamentId: string;
    /**
     * The tournament's full categories list, passed through from the shell.
     * Plugin components filter/project as needed. Type is loose (`any[]`) on purpose:
     * shells currently pass rich category objects with sport-specific fields
     * (e.g., badminton's `teamLeagueConfig`) — that leak is acknowledged tech debt
     * to be cleaned up after Stream 2 along with the categorySlice slim.
     */
    categories: any[];
}

export type SectionProps = TabProps;

export interface CategoryFormProps {
    tournamentId: string;
    /** Existing category → edit mode; null/undefined → create mode. */
    category?: unknown | null;
    /** Called after a successful save; the shell refetches the list and closes the form. */
    onSuccess: () => void;
    /** Called to close the form without saving. */
    onCancel: () => void;
    /** The sport this category is being created under (create mode). Sent in the create payload so the server routes to the right sport. */
    sport?: string;
}

export interface MatchResultSectionProps {
    /** Sport-specific match shape; the renderer reads what it needs (e.g. matchConfig.bestOf). */
    match: any;
    /** 'player' (singles/doubles) or 'team' — how to read competitor identity from the match. */
    competitorType: 'player' | 'team';
    /** Called after a result is successfully recorded; the host refetches matches. */
    onRecorded: () => void;
}
