import { describe, expect, it } from 'vitest';
import { isDecidedFinal } from './champion';

const final = (over: Record<string, unknown> = {}) => ({
    bracketRound: 'Final',
    status: 'completed',
    winnerId: 't1',
    ...over,
});

describe('isDecidedFinal', () => {
    it('is true for a won final', () => {
        expect(isDecidedFinal(final())).toBe(true);
    });

    it('is false before the final is played', () => {
        expect(isDecidedFinal(final({ status: 'scheduled', winnerId: undefined }))).toBe(false);
    });

    it('is false while the final is tied and unresolved', () => {
        // The engine records a tie as no winner. No champion until an
        // organizer names who went through.
        expect(isDecidedFinal(final({ winnerId: undefined }))).toBe(false);
    });

    it('is false for a league, which has no final to win', () => {
        // League fixtures carry bracketRound 'League' and no nextMatchId, so a
        // test on nextMatchId alone would crown the last fixture's winner.
        expect(isDecidedFinal(final({ bracketRound: 'League' }))).toBe(false);
    });

    it('is false for a match that still feeds another', () => {
        expect(isDecidedFinal(final({ nextMatchId: 'later' }))).toBe(false);
    });

    it('is false for a semi-final', () => {
        expect(isDecidedFinal(final({ bracketRound: 'Semi-Final', nextMatchId: 'f1' }))).toBe(false);
    });
});
