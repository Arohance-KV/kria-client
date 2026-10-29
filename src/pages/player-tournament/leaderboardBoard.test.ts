import { describe, expect, it } from 'vitest';
import { boardFrom } from './LeaderboardTab';

// A team-mode category's board now arrives as team rows, ranked by the server.
// The player table's columns (Player, MP, MW, Pts For…) have nothing to show for
// them, so the tab must recognise a team board and render it as one.
describe('boardFrom', () => {
    it('recognises team rows and keeps the order the server ranked them in', () => {
        const b = boardFrom([
            { teamId: 't2', name: 'Bravo', played: 3, won: 1, lost: 0, drawn: 2, points: 4 },
            { teamId: 't1', name: 'Alpha', played: 3, won: 1, lost: 2, drawn: 0, points: 2 },
        ]);
        expect(b.team).toBe(true);
        expect(b.entries.map((e) => [e.rank, e._id, e.playerName, e.points])).toEqual([[1, 't2', 'Bravo', 4], [2, 't1', 'Alpha', 2]]);
    });

    it('leaves a player board exactly as it came', () => {
        const rows = [{ _id: 'r1', rank: 1, playerName: 'Asha', teamName: '', teamId: '', matchesPlayed: 3, matchesWon: 2, winPercentage: 67 }];
        const b = boardFrom(rows);
        expect(b.team).toBe(false);
        expect(b.entries).toBe(rows);
    });

    it('treats an empty board as a player board', () => {
        expect(boardFrom([]).team).toBe(false);
    });
});
