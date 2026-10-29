/**
 * Doubles pairing state, as GET /registrations/categories/:id/pairs returns it.
 * A pair plays as one side of the draw, carried by one of its two registration
 * ids; `sideIds` are the ids the draw's sides carry.
 */
export interface PairingPlayer { registrationId: string; name: string; teamId: string; partnerRegistrationId: string | null }

export interface PairingState {
    players: PairingPlayer[];
    teams: { _id: string; name: string; logo?: string; primaryColor?: string }[];
    drawn: boolean;
    locked: boolean;
    sideIds: string[];
}

export interface TeamCard {
    team: PairingState['teams'][number];
    pairs: [PairingPlayer, PairingPlayer][];
    unpaired: PairingPlayer[];
}

/** One card per team: its pairs (each listed once) and its unpaired players. */
export function teamCards(s: PairingState): TeamCard[] {
    const byId = new Map(s.players.map(p => [p.registrationId, p]));
    return s.teams.map(team => {
        const mine = s.players.filter(p => p.teamId === team._id);
        const partnerOf = (p: PairingPlayer) => (p.partnerRegistrationId ? byId.get(p.partnerRegistrationId) : undefined);
        return {
            team,
            pairs: mine
                .filter(p => { const q = partnerOf(p); return !!q && p.registrationId < q.registrationId; })
                .map(p => [p, partnerOf(p)!] as [PairingPlayer, PairingPlayer]),
            unpaired: mine.filter(p => !partnerOf(p)),
        };
    });
}

/** How many pairs go into a draw, and who sits out, as "Name (Team)". */
export function pairSummary(s: PairingState): { pairs: number; unpaired: string[] } {
    const cards = teamCards(s);
    return {
        pairs: cards.reduce((n, c) => n + c.pairs.length, 0),
        unpaired: cards.flatMap(c => c.unpaired.map(p => `${p.name} (${c.team.name})`)),
    };
}

/** True unless a draw exists that no longer matches the pairs (Redo draw would change it). */
export function drawMatchesPairs(s: PairingState): boolean {
    if (!s.drawn) return true;
    const sides = new Set(s.sideIds);
    const byId = new Map(s.players.map(p => [p.registrationId, p]));
    if (s.sideIds.some(id => !byId.get(id)?.partnerRegistrationId)) return false;
    return s.players.every(p => !p.partnerRegistrationId
        || [p.registrationId, p.partnerRegistrationId].filter(id => sides.has(id)).length === 1);
}
