import { describe, expect, it } from 'vitest';
import { drawMatchesPairs, pairSummary, teamCards, type PairingState } from './pairs';

const p = (registrationId: string, name: string, teamId: string, partnerRegistrationId: string | null = null) =>
    ({ registrationId, name, teamId, partnerRegistrationId });

const state = (over: Partial<PairingState> = {}): PairingState => ({
    players: [
        p('a', 'Asha Rao', 't1', 'b'), p('b', 'Priya Nair', 't1', 'a'), p('c', 'Kiran Shetty', 't1'),
        p('d', 'Rohan Desai', 't2', 'e'), p('e', 'Vikram Rao', 't2', 'd'),
    ],
    teams: [{ _id: 't1', name: 'Smashers' }, { _id: 't2', name: 'Hawks' }],
    drawn: false, locked: false, sideIds: [],
    ...over,
});

describe('teamCards', () => {
    it('lists each pair once and the unpaired players, per team', () => {
        const cards = teamCards(state());
        expect(cards.map((c) => c.team.name)).toEqual(['Smashers', 'Hawks']);
        expect(cards[0].pairs.map(([x, y]) => `${x.name} / ${y.name}`)).toEqual(['Asha Rao / Priya Nair']);
        expect(cards[0].unpaired.map((x) => x.name)).toEqual(['Kiran Shetty']);
        expect(cards[1].pairs).toHaveLength(1);
        expect(cards[1].unpaired).toEqual([]);
    });
});

describe('pairSummary', () => {
    it('counts pairs and names the unpaired players with their team', () => {
        expect(pairSummary(state())).toEqual({ pairs: 2, unpaired: ['Kiran Shetty (Smashers)'] });
    });
});

describe('drawMatchesPairs', () => {
    it('is true with no draw, and when every pair has exactly one id on the draw', () => {
        expect(drawMatchesPairs(state())).toBe(true);
        expect(drawMatchesPairs(state({ drawn: true, sideIds: ['a', 'd'] }))).toBe(true);
    });

    it('is false when a drawn side is unpaired, a pair is on twice, or a pair is missing', () => {
        expect(drawMatchesPairs(state({ drawn: true, sideIds: ['a', 'd', 'c'] }))).toBe(false);
        expect(drawMatchesPairs(state({ drawn: true, sideIds: ['a', 'b', 'd'] }))).toBe(false);
        expect(drawMatchesPairs(state({ drawn: true, sideIds: ['a'] }))).toBe(false);
    });
});
