import { describe, expect, it } from 'vitest';
import { titleLabel } from './titles';

// The server now stores titles as objects; a player's own profile document can
// still hold the old plain strings beside them. Rendering an object as text
// throws in React, so every title must become one line of text first.
describe('titleLabel', () => {
    it('keeps an old plain-string title as it is', () => {
        expect(titleLabel('Winner of Mens Doubles at HSR Shuttle Cup')).toBe('Winner of Mens Doubles at HSR Shuttle Cup');
    });

    it('words a winner the way the old strings did', () => {
        expect(titleLabel({ place: 'winner', categoryName: 'Mens Doubles', tournamentName: 'HSR Shuttle Cup' }))
            .toBe('Winner of Mens Doubles at HSR Shuttle Cup');
    });

    it('words a runner-up', () => {
        expect(titleLabel({ place: 'runner_up', categoryName: 'Mens Singles', tournamentName: 'Cup' }))
            .toBe('Runner-up in Mens Singles at Cup');
    });

    it('still reads when the names are missing', () => {
        expect(titleLabel({ place: 'winner' })).toBe('Winner');
        expect(titleLabel({ place: 'runner_up', tournamentName: 'Cup' })).toBe('Runner-up at Cup');
    });
});
