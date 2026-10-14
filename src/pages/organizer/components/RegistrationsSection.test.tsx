import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import registrationReducer from '@/store/slices/registrationSlice';
import teamReducer from '@/store/slices/teamSlice';
import { server } from '@/test/server';
import { ReadOnlyContext } from '../ui';
import RegistrationsSection from './RegistrationsSection';

const API = 'https://api.kria.club';

const reg = (id: string, firstName: string, status: string, patch = {}) => ({
    _id: id, tournamentId: 't1', categoryId: 'c1', playerId: `p-${id}`, status, paymentStatus: 'completed',
    profile: { firstName, lastName: 'Rao', age: 24, gender: 'male', phone: '98450 11111', skillLevel: 'intermediate' },
    createdAt: '2026-10-11T10:00:00Z', ...patch,
});
const team = { _id: 'tm1', name: 'Smash Kings', owner: { name: 'Arjun Mehta', phone: '98450 12345' }, budget: 100000, initialBudget: 100000, tournamentId: 't1' };

const mockApi = (regs: object[]) => server.use(
    http.get(`${API}/registrations/tournaments/t1`, () => HttpResponse.json({ data: regs })),
    http.get(`${API}/tournaments/t1/categories`, () => HttpResponse.json({ data: [{ _id: 'c1', name: "Men's Singles" }] })),
    http.get(`${API}/tournaments/t1/teams`, () => HttpResponse.json({ data: [team] })),
);

const renderSection = (readOnly = false) => {
    const store = configureStore({ reducer: { registration: registrationReducer, team: teamReducer } });
    return render(<Provider store={store}><ReadOnlyContext.Provider value={readOnly}><RegistrationsSection tournamentId="t1" /></ReadOnlyContext.Provider></Provider>);
};

describe('RegistrationsSection', () => {
    it('approves once, with the row busy while the request runs', async () => {
        const pending = reg('r1', 'Aditya', 'pending');
        mockApi([pending]);
        let calls = 0;
        let release = () => {};
        server.use(http.post(`${API}/registrations/r1/approve`, async () => {
            calls++;
            await new Promise<void>(r => { release = r; });
            return HttpResponse.json({ data: { ...pending, status: 'approved' } });
        }));
        renderSection();

        const row = await screen.findByRole('listitem', { name: 'Aditya Rao' });
        expect(within(row).getAllByText('Pending review').length).toBeGreaterThan(0);
        const approve = within(row).getByRole('button', { name: 'Approve Aditya Rao' });
        await userEvent.click(approve);
        expect(approve).toBeDisabled();
        await userEvent.click(approve);
        await waitFor(() => expect(calls).toBe(1));

        release();
        await waitFor(() => expect(within(row).getAllByText('Approved').length).toBeGreaterThan(0));
        expect(calls).toBe(1);
    });

    it('asks before rejecting', async () => {
        mockApi([reg('r1', 'Aditya', 'pending')]);
        let rejected = false;
        server.use(http.post(`${API}/registrations/r1/reject`, () => {
            rejected = true;
            return HttpResponse.json({ data: reg('r1', 'Aditya', 'rejected') });
        }));
        renderSection();

        await userEvent.click(await screen.findByRole('button', { name: 'Reject Aditya Rao' }));
        const bar = screen.getByRole('alertdialog');
        expect(bar).toHaveTextContent("Reject Aditya Rao? Their entry will show as rejected, and this can't be undone.");
        expect(rejected).toBe(false);

        await userEvent.click(within(bar).getByRole('button', { name: 'Reject' }));
        const row = screen.getByRole('listitem', { name: 'Aditya Rao' });
        await waitFor(() => expect(within(row).getAllByText('Rejected').length).toBeGreaterThan(0));
        expect(rejected).toBe(true);
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('shows an assignment error inside the dialog and keeps it open', async () => {
        mockApi([reg('r2', 'Sanya', 'approved')]);
        server.use(http.post(`${API}/registrations/r2/manual-assign`, () =>
            HttpResponse.json({ message: 'Team does not have sufficient budget.' }, { status: 400 })));
        renderSection();

        await userEvent.click(await screen.findByRole('button', { name: 'Assign to team' }));
        const dialog = screen.getByRole('dialog', { name: 'Assign Sanya Rao' });
        await userEvent.click(within(dialog).getByRole('radio', { name: /Smash Kings/ }));
        await userEvent.type(within(dialog).getByLabelText('Price'), '5000');
        await userEvent.click(within(dialog).getByRole('button', { name: 'Assign player' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't assign Sanya Rao. Team does not have sufficient budget.");
        expect(screen.getByRole('dialog', { name: 'Assign Sanya Rao' })).toBeInTheDocument();
    });

    it('bulk-approves the selected pending players', async () => {
        mockApi([reg('r1', 'Aditya', 'pending'), reg('r3', 'Divya', 'pending')]);
        let body: { registrationIds?: string[] } = {};
        server.use(http.post(`${API}/registrations/bulk-approve`, async ({ request }) => {
            body = await request.json() as typeof body;
            return HttpResponse.json({ data: { data: [{ success: true, data: { _id: 'r1' } }, { error: 'Only pending registrations can be approved.', id: 'r3' }] } });
        }));
        renderSection();

        await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Aditya Rao' }));
        await userEvent.click(screen.getByRole('checkbox', { name: 'Select Divya Rao' }));
        expect(screen.getByText('2 selected')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Approve selected' }));

        expect(await screen.findByRole('alert')).toHaveTextContent("1 of 2 players couldn't be approved. Only pending registrations can be approved.");
        expect(body.registrationIds).toEqual(['r1', 'r3']);
        expect(within(screen.getByRole('listitem', { name: 'Aditya Rao' })).getAllByText('Approved').length).toBeGreaterThan(0);
        expect(screen.getByText('1 selected')).toBeInTheDocument(); // the failed one stays selected to retry
    });

    it('offers no review or team actions when the tournament is locked', async () => {
        mockApi([reg('r1', 'Aditya', 'pending'), reg('r2', 'Kiran', 'approved')]);
        renderSection(true);

        await screen.findByRole('listitem', { name: 'Kiran Rao' });
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        for (const name of ['Approve Aditya Rao', 'Reject Aditya Rao', 'Assign to team', 'More actions for Kiran Rao']) {
            expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
        }
    });
});
