import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { ReadOnlyContext } from '@/pages/organizer/ui';
import GroupConfigPanel from './GroupConfigPanel';
import GroupStandingsTable from './GroupStandingsTable';
import LineupAssignmentModal from './LineupAssignmentModal';
import SubMatchResultModal from './SubMatchResultModal';
import TieManagementPanel from './TieManagementPanel';

const TL = 'https://api.kria.club/sports/badminton/team-league';
const envelope = (data: unknown) => HttpResponse.json({ data: { data } });

const TEAMS = [
    { _id: 't1', name: 'Rally Rangers', primaryColor: '#f97316' },
    { _id: 't2', name: 'Drop Shot Dragons' },
    { _id: 't3', name: 'Baseline Blazers' },
    { _id: 't4', name: 'Net Ninjas' },
];
const GROUPS = [
    { _id: 'g1', groupName: 'Group A', groupNumber: 1, teamIds: ['t1', 't2'] },
    { _id: 'g2', groupName: 'Group B', groupNumber: 2, teamIds: ['t3', 't4'] },
];

const row = (teamId: string, teamName: string, rank: number, points: number) => ({
    teamId, teamName, rank, points, played: 1, won: points ? 1 : 0, lost: points ? 0 : 1, drawn: 0, subMatchesWon: 3, subMatchesLost: 2,
});

describe('GroupConfigPanel', () => {
    it('randomizes into the confirmed number of groups, still editable once groups exist', async () => {
        let body: any = null;
        server.use(http.post(`${TL}/cat1/groups/randomize`, async ({ request }) => {
            body = await request.json();
            return envelope([]);
        }));
        const onRefresh = vi.fn();
        render(<GroupConfigPanel categoryId="cat1" categoryStatus="groups_configured" stageNumber={1}
            groups={GROUPS} teams={TEAMS} onRefresh={onRefresh} setError={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'Randomize groups' }));
        expect(screen.getByText(/This replaces the current groups/)).toBeInTheDocument();
        const count = screen.getByRole('spinbutton', { name: 'Number of groups' });
        await userEvent.clear(count);
        await userEvent.type(count, '3');
        await userEvent.click(screen.getByRole('button', { name: 'Randomize' }));

        await waitFor(() => expect(onRefresh).toHaveBeenCalled());
        expect(body).toEqual({ numberOfGroups: 3 });
    });

    it('keeps an empty group from being saved', async () => {
        render(<GroupConfigPanel categoryId="cat1" categoryStatus="auction" stageNumber={1}
            groups={GROUPS} teams={TEAMS} onRefresh={vi.fn()} setError={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'Edit groups' }));
        const drawer = screen.getByRole('dialog', { name: 'Edit groups' });
        await userEvent.click(within(drawer).getByRole('button', { name: 'Add group' }));
        await userEvent.click(within(drawer).getByRole('button', { name: 'Save groups' }));

        expect(within(drawer).getByRole('alert')).toHaveTextContent('Every group needs at least one team.');
    });

    it('hides the group controls once play has started', () => {
        render(<GroupConfigPanel categoryId="cat1" categoryStatus="ongoing" stageNumber={1}
            groups={GROUPS} teams={TEAMS} onRefresh={vi.fn()} setError={vi.fn()} />);
        expect(screen.queryByRole('button', { name: 'Randomize groups' })).not.toBeInTheDocument();
    });

    it('hides the group controls when the tournament is locked', () => {
        render(<ReadOnlyContext.Provider value><GroupConfigPanel categoryId="cat1" categoryStatus="groups_configured" stageNumber={1}
            groups={GROUPS} teams={TEAMS} onRefresh={vi.fn()} setError={vi.fn()} /></ReadOnlyContext.Provider>);
        expect(screen.getByRole('region', { name: 'Group A' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Randomize groups' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit groups' })).not.toBeInTheDocument();
    });
});

describe('GroupStandingsTable', () => {
    const COMPLETE = [
        { group: { _id: 'g1', groupName: 'Group A', groupNumber: 1 }, totalTies: 1, completedTies: 1, standings: [row('t1', 'Rally Rangers', 1, 2), row('t2', 'Drop Shot Dragons', 2, 0)] },
        { group: { _id: 'g2', groupName: 'Group B', groupNumber: 2 }, totalTies: 1, completedTies: 1, standings: [row('t3', 'Baseline Blazers', 1, 2), row('t4', 'Net Ninjas', 2, 0)] },
    ];

    it('asks before advancing, then sends the chosen format', async () => {
        let body: any = null;
        server.use(http.post(`${TL}/cat1/advance`, async ({ request }) => {
            body = await request.json();
            return envelope({ stage: 2 });
        }));
        const onAdvanced = vi.fn();
        render(<GroupStandingsTable categoryId="cat1" stageNumber={1} standings={COMPLETE} teams={TEAMS} topNPerGroup={1} onAdvanced={onAdvanced} />);

        await userEvent.click(screen.getByRole('radio', { name: /New groups/ }));
        const groups = screen.getByLabelText('Number of groups');
        await userEvent.clear(groups);
        await userEvent.type(groups, '2');

        await userEvent.click(screen.getByRole('button', { name: 'Advance teams' }));
        expect(screen.getByText(/This can't be undone/)).toBeInTheDocument();
        expect(body).toBeNull(); // the first click only asks

        await userEvent.click(screen.getByRole('button', { name: 'Advance teams' }));
        await waitFor(() => expect(onAdvanced).toHaveBeenCalled());
        expect(body).toEqual({
            stageNumber: 1, format: 'groups', numberOfGroups: 2,
            teamAdvancement: [{ teamId: 't1', groupNumber: 1 }, { teamId: 't3', groupNumber: 2 }],
        });
    });

    it('explains why advancing is not available yet', () => {
        const partial = COMPLETE.map((g, i) => ({ ...g, totalTies: 3, completedTies: i }));
        render(<GroupStandingsTable categoryId="cat1" stageNumber={1} standings={partial} teams={TEAMS} topNPerGroup={1} onAdvanced={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Advance teams' })).toBeDisabled();
        expect(screen.getByText(/5 ties left/)).toBeInTheDocument();
    });

    it('shows standings without advancing when the tournament is locked', () => {
        render(<ReadOnlyContext.Provider value><GroupStandingsTable categoryId="cat1" stageNumber={1} standings={COMPLETE} teams={TEAMS} topNPerGroup={1} onAdvanced={vi.fn()} /></ReadOnlyContext.Provider>);
        expect(screen.getByText('Baseline Blazers')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Advance teams' })).not.toBeInTheDocument();
    });
});

describe('SubMatchResultModal', () => {
    const MATCH = {
        _id: 'm1', slotLabel: 'Singles 1', matchConfig: { bestOf: 3 },
        player1: { teamId: 't1', teamName: 'Rally Rangers', name: 'Asha K' },
        player2: { teamId: 't2', teamName: 'Drop Shot Dragons', name: 'Ravi P' },
    };

    it('works out the winner from the games and warns when a pick contradicts them', async () => {
        let body: any = null;
        server.use(http.post(`${TL}/sub-matches/m1/result`, async ({ request }) => {
            body = await request.json();
            return envelope({});
        }));
        const onSaved = vi.fn();
        render(<SubMatchResultModal match={MATCH} onClose={vi.fn()} onSaved={onSaved} />);

        const save = screen.getByRole('button', { name: 'Save result' });
        expect(save).toBeDisabled();

        const score = async (label: string, v: string) => userEvent.type(screen.getByRole('spinbutton', { name: label }), v);
        await score('Game 1, Rally Rangers', '21');
        await score('Game 1, Drop Shot Dragons', '15');
        await score('Game 2, Rally Rangers', '18');
        await score('Game 2, Drop Shot Dragons', '21');
        await score('Game 3, Rally Rangers', '21');
        await score('Game 3, Drop Shot Dragons', '10');

        expect(screen.getByRole('radio', { name: /Rally Rangers/ })).toBeChecked();
        expect(screen.getByText(/wins 2–1/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('radio', { name: /Drop Shot Dragons/ }));
        expect(screen.getByText(/The scores say Rally Rangers won 2–1/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Use the scores' }));
        expect(screen.getByRole('radio', { name: /Rally Rangers/ })).toBeChecked();

        await userEvent.click(save);
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(body.winnerId).toBe('t1');
        expect(body.gameScores.map((g: any) => [g.team1Score, g.team2Score])).toEqual([[21, 15], [18, 21], [21, 10]]);
    });

    it('blocks saving a level game', async () => {
        render(<SubMatchResultModal match={MATCH} onClose={vi.fn()} onSaved={vi.fn()} />);
        await userEvent.type(screen.getByRole('spinbutton', { name: 'Game 1, Rally Rangers' }), '20');
        await userEvent.type(screen.getByRole('spinbutton', { name: 'Game 1, Drop Shot Dragons' }), '20');
        expect(screen.getByText("Game 1 can't end level.")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save result' })).toBeDisabled();
    });
});

describe('TieManagementPanel', () => {
    const TIE = {
        _id: 'tie1', status: 'scheduled', teams: { team1Id: 't3', team2Id: 't4', team1Name: 'Baseline Blazers', team2Name: 'Net Ninjas' },
        subMatches: [{ _id: 'm1', status: 'scheduled', subMatchSlotNumber: 1 }],
    };
    const CONFIG = { subTeamSlots: [{ slotNumber: 1, label: 'Singles 1', matchType: 'singles' }] };
    const READY = { ...TIE.subMatches[0], player1: { teamId: 't3', teamName: 'Baseline Blazers', name: 'Asha K' }, player2: { teamId: 't4', teamName: 'Net Ninjas', name: 'Ravi P' } };

    const renderPanel = (onRefresh = vi.fn(), readOnly = false) => render(
        <ReadOnlyContext.Provider value={readOnly}>
            <TieManagementPanel categoryId="cat1" groups={GROUPS} teams={TEAMS} tieCounts={{ g1: 0, g2: 0 }}
                categoryConfig={CONFIG} onRefresh={onRefresh} setError={vi.fn()} />
        </ReadOnlyContext.Provider>,
    );

    it('keeps the selected group after creating a tie', async () => {
        let created: any = null;
        server.use(
            http.get(`${TL}/groups/g1/ties`, () => envelope([])),
            http.get(`${TL}/groups/g2/ties`, () => envelope(created ? [TIE] : [])),
            http.post(`${TL}/groups/g2/ties`, async ({ request }) => {
                created = await request.json();
                return envelope(TIE);
            }),
        );
        const onRefresh = vi.fn();
        renderPanel(onRefresh);

        await userEvent.click(await screen.findByRole('button', { name: /^Group B/ }));
        expect(await screen.findByText('No ties in this group yet')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Add tie' }));
        const dialog = screen.getByRole('dialog', { name: 'Add tie' });
        await userEvent.click(within(dialog).getByRole('button', { name: 'Add tie' }));
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose a home team and an away team.');

        await userEvent.selectOptions(within(dialog).getByLabelText('Home team'), 't3');
        await userEvent.selectOptions(within(dialog).getByLabelText('Away team'), 't4');
        await userEvent.click(within(dialog).getByRole('button', { name: 'Add tie' }));

        expect(await screen.findByRole('button', { name: /Baseline Blazers vs Net Ninjas/ })).toBeInTheDocument();
        expect(created).toEqual({ categoryId: 'cat1', team1Id: 't3', team2Id: 't4' });
        expect(screen.getByRole('button', { name: /^Group B/ })).toHaveAttribute('aria-pressed', 'true');
        expect(onRefresh).toHaveBeenCalled();
    });

    it('opens a tie in a drawer and asks before deleting it', async () => {
        let deleted = false;
        server.use(
            http.get(`${TL}/groups/g1/ties`, () => envelope(deleted ? [] : [TIE])),
            http.get(`${TL}/ties/tie1`, () => envelope({ tie: TIE, subMatches: TIE.subMatches, lineups: [], subTeamSlots: CONFIG.subTeamSlots })),
            http.delete(`${TL}/ties/tie1`, () => { deleted = true; return envelope(null); }),
        );
        renderPanel();

        await userEvent.click(await screen.findByRole('button', { name: /Baseline Blazers vs Net Ninjas/ }));
        const drawer = screen.getByRole('dialog', { name: 'Baseline Blazers vs Net Ninjas' });
        expect(await within(drawer).findByText('Waiting for lineups')).toBeInTheDocument();
        expect(within(drawer).getAllByText('Not set')).toHaveLength(2);
        expect(within(drawer).getByRole('button', { name: 'Edit lineup for Net Ninjas' })).toBeInTheDocument();

        await userEvent.click(within(drawer).getByRole('button', { name: 'Delete tie' }));
        expect(deleted).toBe(false);
        await userEvent.click(within(drawer).getByRole('button', { name: 'Delete tie' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(deleted).toBe(true);
        expect(await screen.findByText('No ties in this group yet')).toBeInTheDocument();
    });

    it('closes only the result dialog on Escape, leaving the tie open', async () => {
        server.use(
            http.get(`${TL}/groups/g1/ties`, () => envelope([TIE])),
            http.get(`${TL}/ties/tie1`, () => envelope({ tie: TIE, subMatches: [READY], lineups: [], subTeamSlots: CONFIG.subTeamSlots })),
        );
        renderPanel();

        await userEvent.click(await screen.findByRole('button', { name: /Baseline Blazers vs Net Ninjas/ }));
        await userEvent.click(await screen.findByRole('button', { name: 'Enter result for Singles 1' }));
        expect(screen.getByRole('dialog', { name: 'Enter result' })).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Enter result' })).not.toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Baseline Blazers vs Net Ninjas' })).toBeInTheDocument();
    });

    it('opens ties read-only when the tournament is locked', async () => {
        server.use(
            http.get(`${TL}/groups/g1/ties`, () => envelope([TIE])),
            http.get(`${TL}/ties/tie1`, () => envelope({ tie: TIE, subMatches: [READY], lineups: [], subTeamSlots: CONFIG.subTeamSlots })),
        );
        renderPanel(vi.fn(), true);

        await userEvent.click(await screen.findByRole('button', { name: /Baseline Blazers vs Net Ninjas/ }));
        const drawer = screen.getByRole('dialog', { name: 'Baseline Blazers vs Net Ninjas' });
        expect(await within(drawer).findByText('Asha K vs Ravi P')).toBeInTheDocument();
        expect(within(drawer).queryByRole('button', { name: /Edit lineup|Score live|Enter result|Delete tie/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add tie|Generate round robin/ })).not.toBeInTheDocument();
    });
});

describe('LineupAssignmentModal', () => {
    it('clears a picked player with its own labelled button', async () => {
        server.use(
            http.get('https://api.kria.club/registrations/teams/t1/roster', () => envelope({
                players: [{ _id: 'r1', playerId: 'p1', profile: { firstName: 'Asha', lastName: 'K' } }],
            })),
            http.get(`${TL}/ties/tie1/lineup`, () => envelope({ teamId: 't1', assignments: [{ slotNumber: 1, playerIds: ['p1'], playerNames: ['Asha K'] }] })),
        );
        render(<LineupAssignmentModal tieId="tie1" teamId="t1" teamName="Rally Rangers"
            categoryConfig={{ subTeamSlots: [{ slotNumber: 1, label: 'Singles 1', matchType: 'singles' }] }} onClose={vi.fn()} onSaved={vi.fn()} />);

        const picker = await screen.findByRole('combobox', { name: 'Singles 1' });
        expect(picker).toHaveTextContent('Asha K');
        const clear = screen.getByRole('button', { name: 'Clear Singles 1' });
        expect(picker).not.toContainElement(clear);
        await userEvent.click(clear);
        expect(picker).toHaveTextContent('Choose a player');
    });
});
