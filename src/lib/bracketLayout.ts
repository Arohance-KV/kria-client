// ═══════════════════════════════════════════════════════════════════════════════
// BRACKET LAYOUT — card geometry and swap-target resolution
// ═══════════════════════════════════════════════════════════════════════════════

export interface LayoutCompetitor { registrationId: string; name: string; teamId?: string; teamName?: string }

export interface LayoutMatch {
    _id: string;
    bracketRound: string;
    matchNumber: number;
    roundNumber?: number;
    status: string;
    winReason?: string;
    nextMatchId?: string;
    nextMatchSlot?: string;
    player1?: LayoutCompetitor;
    player2?: LayoutCompetitor;
    teams?: { team1Id: string; team2Id: string; team1Name: string; team2Name: string };
}

export interface LayoutRound { name: string; matches: LayoutMatch[] }

export type CompetitorType = 'player' | 'team';
export type Slot = 'player1' | 'player2';

export const CARD_H = 215;  // header + 2 slots + Record Result button; score entry opens as a modal so the height never changes
export const CARD_W = 340;
export const CARD_GAP = 20;
export const CONN_W = 72;
/**
 * A bye is not rendered, but its position still anchors the card it feeds, so
 * the space is reserved rather than removed. Two stacked bye slots must be at
 * least as tall as one card, or the two cards they feed overlap.
 */
export const BYE_SLOT_H = Math.ceil((CARD_H - CARD_GAP) / 2);

export function getC1(m: LayoutMatch, ct: CompetitorType) {
    if (ct === 'player' && m.player1) return { id: m.player1.registrationId, name: m.player1.name, teamName: m.player1.teamName || '', isTBD: m.player1.registrationId === 'TBD' };
    return { id: m.teams?.team1Id || '', name: m.teams?.team1Name || 'TBD', teamName: '', isTBD: m.teams?.team1Name === 'TBD' };
}

export function getC2(m: LayoutMatch, ct: CompetitorType) {
    if (ct === 'player' && m.player2) return { id: m.player2.registrationId, name: m.player2.name, teamName: m.player2.teamName || '', isTBD: m.player2.registrationId === 'TBD' };
    return { id: m.teams?.team2Id || '', name: m.teams?.team2Name || 'TBD', teamName: '', isTBD: m.teams?.team2Name === 'TBD' };
}

export function getSlot(m: LayoutMatch, slot: Slot, ct: CompetitorType) {
    return slot === 'player1' ? getC1(m, ct) : getC2(m, ct);
}

/**
 * A slot holds no real competitor. 'TBD' is an unfilled slot; 'BYE' is the
 * absence of an opponent. Neither can take part in a swap.
 */
export function isPlaceholderSlot(c: { name: string; isTBD: boolean }) {
    return c.isTBD || c.name === 'BYE';
}

/** A bye card is never rendered — it duplicates the name on the card it feeds. */
export function isHiddenBye(m: LayoutMatch) {
    return m.status === 'walkover' && m.winReason === 'bye';
}

/**
 * Vertical position of every card, keyed by match id.
 *
 * The first round is laid out sequentially, a hidden bye taking a slim reserved
 * slot; every later card sits on the mean centre of the cards feeding it. That
 * makes each connector elbow land exactly on its card, which a layout that
 * compacted away the byes and then clamped overlaps apart could not do.
 *
 * `rounds` must include the byes — they are the geometry the rest hangs off.
 */
export function computeCardPositions(rounds: LayoutRound[]): Map<string, number> {
    const centre = new Map<string, number>();
    if (rounds.length === 0) return centre;

    let y = 0;
    for (const match of rounds[0].matches) {
        const h = isHiddenBye(match) ? BYE_SLOT_H : CARD_H;
        centre.set(match._id, y + h / 2);
        y += h + CARD_GAP;
    }

    for (let ri = 1; ri < rounds.length; ri++) {
        const feeders = rounds[ri - 1].matches;
        let last = -Infinity;
        for (const match of rounds[ri].matches) {
            const kids = feeders.filter(f => f.nextMatchId === match._id);
            // A round with no recorded feeders is malformed data, not a shape to
            // lay out cleverly — stack it below the previous card and move on.
            const c = kids.length
                ? kids.reduce((sum, k) => sum + centre.get(k._id)!, 0) / kids.length
                : last + CARD_H + CARD_GAP;
            centre.set(match._id, c);
            last = c;
        }
    }

    const tops = new Map<string, number>();
    centre.forEach((c, id) => tops.set(id, c - CARD_H / 2));
    // A card fed only by byes centres on their slim slots, which can sit above
    // the top of the viewport. Shift the whole tree down rather than nudge it.
    const min = Math.min(...tops.values());
    if (min < 0) tops.forEach((t, id) => tops.set(id, t - min));
    return tops;
}

export function bracketHeight(positions: Map<string, number>) {
    if (positions.size === 0) return 0;
    return Math.max(...positions.values()) + CARD_H;
}

/**
 * Where a click on a rendered slot should actually be applied.
 *
 * Only round one can be rearranged: a later round's names come from
 * auto-advance, so writing to them contradicts the round that feeds them and
 * gets overwritten the next time a result is recorded. But a competitor who
 * had a bye is only ever *shown* in a later round, because the bye card itself
 * is hidden — so a click there is resolved back through the bye to the
 * first-round slot that really holds them. Returns null when the slot is not
 * the organizer's to move.
 */
export function resolveSwapSlot(
    match: LayoutMatch,
    slot: Slot,
    all: LayoutMatch[],
    ct: CompetitorType,
): { matchId: string; slot: Slot } | null {
    if (isPlaceholderSlot(getSlot(match, slot, ct))) return null;
    if (match.status === 'completed' || match.status === 'in_progress') return null;

    if ((match.roundNumber ?? 1) === 1) return { matchId: match._id, slot };

    const feeder = all.find(f => f.nextMatchId === match._id && f.nextMatchSlot === slot);
    if (!feeder || !isHiddenBye(feeder)) return null;

    const feederSlot: Slot = isPlaceholderSlot(getC1(feeder, ct)) ? 'player2' : 'player1';
    return resolveSwapSlot(feeder, feederSlot, all, ct);
}
