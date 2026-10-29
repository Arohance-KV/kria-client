/** A tournament title as the server now stores it (server: shared/results/titles.ts). */
export interface Title {
    place: 'winner' | 'runner_up';
    tournamentId?: string;
    categoryId?: string;
    tournamentName?: string;
    categoryName?: string;
    awardedAt?: string;
}

/**
 * One line of text for a title. Older titles are plain strings and a player's own
 * profile document can still hold them beside the newer objects; rendering an
 * object as text throws in React, so every title passes through here first.
 */
export function titleLabel(t: string | Title): string {
    if (typeof t === 'string') return t;
    const won = t.place === 'winner';
    const what = won ? 'Winner' : 'Runner-up';
    const of = t.categoryName ? ` ${won ? 'of' : 'in'} ${t.categoryName}` : '';
    const at = t.tournamentName ? ` at ${t.tournamentName}` : '';
    return what + of + at;
}
