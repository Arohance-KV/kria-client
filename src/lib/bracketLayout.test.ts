import { describe, expect, it } from 'vitest';
import {
    BYE_SLOT_H, CARD_GAP, CARD_H, computeCardPositions, isHiddenBye, resolveSwapSlot,
    type LayoutMatch, type LayoutRound,
} from './bracketLayout';

/**
 * A draw where two competitors have a bye:
 *
 *   R1                R2 (semi)        R3 (final)
 *   Meera — bye ──┐
 *                 ├──── Meera v Sneha ──┐
 *   Sneha — bye ──┘                     │
 *                                       ├──── Final
 *   C v D       ──┐                     │
 *                 ├──── W v W        ───┘
 *   E v F       ──┘
 *
 * Hiding the two byes used to compact R1 to two cards while R2 kept two, so
 * R2's first card had no visible source and the layout collapsed onto itself.
 */
const m = (over: Partial<LayoutMatch> & { _id: string }): LayoutMatch => ({
    bracketRound: 'R1',
    matchNumber: 1,
    roundNumber: 1,
    status: 'scheduled',
    player1: { registrationId: 'p1', name: 'P1', teamId: '', teamName: '' },
    player2: { registrationId: 'p2', name: 'P2', teamId: '', teamName: '' },
    ...over,
});

const bye = (id: string, name: string, next: string, slot: 'player1' | 'player2'): LayoutMatch =>
    m({
        _id: id,
        status: 'walkover',
        winReason: 'bye',
        nextMatchId: next,
        nextMatchSlot: slot,
        // The generator puts the lone competitor in the slot it will feed.
        player1: slot === 'player1'
            ? { registrationId: `reg-${name}`, name, teamId: '', teamName: '' }
            : { registrationId: 'TBD', name: 'TBD', teamId: '', teamName: '' },
        player2: slot === 'player2'
            ? { registrationId: `reg-${name}`, name, teamId: '', teamName: '' }
            : { registrationId: 'TBD', name: 'TBD', teamId: '', teamName: '' },
    });

const tbd = { registrationId: 'TBD', name: 'TBD', teamId: '', teamName: '' };

const draw = (): LayoutMatch[] => [
    bye('byeA', 'Meera', 'semi1', 'player1'),
    bye('byeB', 'Sneha', 'semi1', 'player2'),
    m({ _id: 'r1c', nextMatchId: 'semi2', nextMatchSlot: 'player1' }),
    m({ _id: 'r1d', nextMatchId: 'semi2', nextMatchSlot: 'player2' }),
    m({
        _id: 'semi1', roundNumber: 2, bracketRound: 'R2', nextMatchId: 'final', nextMatchSlot: 'player1',
        player1: { registrationId: 'reg-Meera', name: 'Meera', teamId: '', teamName: '' },
        player2: { registrationId: 'reg-Sneha', name: 'Sneha', teamId: '', teamName: '' },
    }),
    m({
        _id: 'semi2', roundNumber: 2, bracketRound: 'R2', nextMatchId: 'final', nextMatchSlot: 'player2',
        player1: tbd, player2: tbd,
    }),
    m({ _id: 'final', roundNumber: 3, bracketRound: 'Final', player1: tbd, player2: tbd }),
];

/** Rounds as the view groups them — byes included, because they hold the geometry. */
const roundsOf = (all: LayoutMatch[]): LayoutRound[] =>
    ['R1', 'R2', 'Final']
        .map(name => ({ name, matches: all.filter(x => x.bracketRound === name) }))
        .filter(r => r.matches.length > 0);

const centreOf = (pos: Map<string, number>, id: string) => pos.get(id)! + CARD_H / 2;

describe('computeCardPositions', () => {
    it('leaves every card on screen', () => {
        const pos = computeCardPositions(roundsOf(draw()));
        [...pos.values()].forEach(top => expect(top).toBeGreaterThanOrEqual(0));
    });

    it('never overlaps two visible cards in a round', () => {
        const rounds = roundsOf(draw());
        const pos = computeCardPositions(rounds);
        rounds.forEach(round => {
            const tops = round.matches.filter(x => !isHiddenBye(x)).map(x => pos.get(x._id)!).sort((a, b) => a - b);
            for (let i = 1; i < tops.length; i++) {
                expect(tops[i] - tops[i - 1]).toBeGreaterThanOrEqual(CARD_H + CARD_GAP);
            }
        });
    });

    it('centres every card on its feeders, so the elbow lands on the card', () => {
        const all = draw();
        const rounds = roundsOf(all);
        const pos = computeCardPositions(rounds);
        for (let ri = 1; ri < rounds.length; ri++) {
            rounds[ri].matches.forEach(parent => {
                const kids = rounds[ri - 1].matches.filter(k => k.nextMatchId === parent._id);
                expect(kids.length).toBeGreaterThan(0);
                const want = kids.reduce((s, k) => s + centreOf(pos, k._id), 0) / kids.length;
                expect(centreOf(pos, parent._id)).toBeCloseTo(want, 5);
            });
        }
    });

    it('reserves a slim slot for a hidden bye instead of a full card', () => {
        const pos = computeCardPositions(roundsOf(draw()));
        // byeA and byeB are adjacent hidden byes.
        expect(centreOf(pos, 'byeB') - centreOf(pos, 'byeA')).toBeCloseTo(BYE_SLOT_H + CARD_GAP, 5);
    });

    it('keeps a bye-fed card clear of the card above it', () => {
        // Two adjacent pairs of byes feed two adjacent visible cards. If the
        // reserved bye slot is too short, those two cards overlap.
        const all: LayoutMatch[] = [
            bye('b1', 'A', 's1', 'player1'), bye('b2', 'B', 's1', 'player2'),
            bye('b3', 'C', 's2', 'player1'), bye('b4', 'D', 's2', 'player2'),
            m({ _id: 's1', roundNumber: 2, bracketRound: 'R2' }),
            m({ _id: 's2', roundNumber: 2, bracketRound: 'R2' }),
        ];
        const pos = computeCardPositions(roundsOf(all));
        expect(pos.get('s2')! - pos.get('s1')!).toBeGreaterThanOrEqual(CARD_H + CARD_GAP);
    });

    it('returns nothing for an empty bracket', () => {
        expect(computeCardPositions([]).size).toBe(0);
    });
});

describe('resolveSwapSlot', () => {
    it('resolves a slot fed by a bye back to the bye match', () => {
        const all = draw();
        const semi1 = all.find(x => x._id === 'semi1')!;
        expect(resolveSwapSlot(semi1, 'player1', all, 'player')).toEqual({ matchId: 'byeA', slot: 'player1' });
        expect(resolveSwapSlot(semi1, 'player2', all, 'player')).toEqual({ matchId: 'byeB', slot: 'player2' });
    });

    it('resolves a first-round slot to itself', () => {
        const all = draw();
        const r1c = all.find(x => x._id === 'r1c')!;
        expect(resolveSwapSlot(r1c, 'player1', all, 'player')).toEqual({ matchId: 'r1c', slot: 'player1' });
    });

    it('refuses a slot that a playable match will fill', () => {
        const all = draw();
        const semi2 = all.find(x => x._id === 'semi2')!;
        expect(resolveSwapSlot(semi2, 'player1', all, 'player')).toBeNull();
    });

    it('refuses a slot whose feeding bye already has a result', () => {
        const all = draw().map(x => (x._id === 'byeA' ? { ...x, status: 'completed', winReason: undefined } : x));
        const semi1 = all.find(x => x._id === 'semi1')!;
        expect(resolveSwapSlot(semi1, 'player1', all, 'player')).toBeNull();
    });

    it('refuses an empty slot', () => {
        const all = draw();
        const byeA = all.find(x => x._id === 'byeA')!;
        // byeA's player2 is the absent opponent, not a competitor to move.
        expect(resolveSwapSlot(byeA, 'player2', all, 'player')).toBeNull();
    });

    it('refuses a slot on a match that already has a result', () => {
        const all = draw().map(x => (x._id === 'r1c' ? { ...x, status: 'completed' } : x));
        const r1c = all.find(x => x._id === 'r1c')!;
        expect(resolveSwapSlot(r1c, 'player1', all, 'player')).toBeNull();
    });
});
