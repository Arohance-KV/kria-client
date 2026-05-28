export interface PlayerSlot { registrationId: string; name: string }

/** Map registrationId → display name across both teams' XI + reserves. */
export function buildPlayerNameMap(match: any): Record<string, string> {
    const map: Record<string, string> = {};
    const add = (slots?: any[]) => (slots || []).forEach(s => { if (s?.registrationId) map[s.registrationId] = s.name || 'Unknown'; });
    const setup = match?.cricketSetup || {};
    add(setup.team1Lineup?.startingXI); add(setup.team1Lineup?.reserves);
    add(setup.team2Lineup?.startingXI); add(setup.team2Lineup?.reserves);
    return map;
}

/** Returns the lineup ({teamId, startingXI, reserves}) for a given teamId, or null. */
export function lineupForTeam(match: any, teamId?: string): any | null {
    if (!teamId) return null;
    const setup = match?.cricketSetup || {};
    if (setup.team1Lineup?.teamId === teamId || String(setup.team1Lineup?.teamId) === String(teamId)) return setup.team1Lineup;
    if (setup.team2Lineup?.teamId === teamId || String(setup.team2Lineup?.teamId) === String(teamId)) return setup.team2Lineup;
    return null;
}

/** Players (XI) for a team as {registrationId, name}[]. */
export function xiSlots(match: any, teamId?: string): PlayerSlot[] {
    const l = lineupForTeam(match, teamId);
    return (l?.startingXI || []).map((s: any) => ({ registrationId: s.registrationId, name: s.name || 'Unknown' }));
}

export const nameOf = (map: Record<string, string>, id?: string): string => (id ? (map[id] || '—') : '—');

/** "12.4" overs display from completed overs + balls-in-over. */
export const oversDisplay = (live: any): string =>
    `${live?.completedOvers ?? 0}.${live?.ballsInCurrentOver ?? 0}`;
