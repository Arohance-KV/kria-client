/**
 * Winning the final wins the category — so that match deserves saying so
 * rather than "advanced in the bracket automatically", which is what every
 * other round gets and is meaningless when there is no next round.
 *
 * A knockout's last round is named 'Final' by the generator's round names, and
 * only that match is left without a `nextMatchId`. Both are checked: a league
 * carries `bracketRound: 'League'` and no forward link either, so testing the
 * link alone would crown whoever won the last fixture of a round robin.
 *
 * A tied final has no `winnerId` until an organizer names who went through,
 * so it is not decided yet and no champion is announced.
 */
export function isDecidedFinal(match: {
    bracketRound?: string;
    status?: string;
    winnerId?: string;
    nextMatchId?: string;
} | null | undefined): boolean {
    if (!match) return false;
    return (
        match.bracketRound === 'Final' &&
        !match.nextMatchId &&
        (match.status === 'completed' || match.status === 'walkover') &&
        !!match.winnerId
    );
}
