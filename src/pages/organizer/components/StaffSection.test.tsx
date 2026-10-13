import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import tournamentReducer from '@/store/slices/tournamentSlice';
import { useAppSelector } from '@/store/hooks';
import { server } from '@/test/server';
import StaffSection from './StaffSection';

const API = 'https://api.kria.club';
const envelope = (data: unknown) => HttpResponse.json({ data: { data } });

const member = (patch = {}) => ({
    _id: 's1', firstName: 'Ananya', lastName: 'Rao', email: 'ananya@example.com', phone: '9880122334', isActive: true, role: 'staff', ...patch,
});

// The page passes staffIds from the tournament; read them from the store the same way.
const Section = () => {
    const ids = useAppSelector(s => s.tournament.currentTournament?.staffIds ?? []);
    return <StaffSection tournamentId="t1" staffIds={ids} />;
};

function setup(staff: unknown[], staffIds: string[] = []) {
    let list = staff;
    server.use(http.get(`${API}/organizer/auth/staff`, () => envelope(list)));
    const store = configureStore({
        reducer: { tournament: tournamentReducer },
        preloadedState: { tournament: { ...tournamentReducer(undefined, { type: 'init' }), currentTournament: { _id: 't1', staffIds } as never } },
    });
    render(<Provider store={store}><Section /></Provider>);
    return { store, setList: (l: unknown[]) => { list = l; } };
}

describe('StaffSection', () => {
    it('creates an account and adds it to the tournament in one step', async () => {
        const { store, setList } = setup([]);
        let created: unknown = null;
        let assigned: unknown = null;
        server.use(
            http.post(`${API}/organizer/auth/staff`, async ({ request }) => {
                created = await request.json();
                const s = member({ _id: 's9', firstName: 'Meera', lastName: 'Iyer', email: 'meera@example.com' });
                setList([s]);
                return envelope(s);
            }),
            http.post(`${API}/tournament/t1/staff`, async ({ request }) => {
                assigned = await request.json();
                return envelope({ _id: 't1', staffIds: ['s9'] });
            }),
        );
        const user = userEvent.setup();

        await user.click((await screen.findAllByRole('button', { name: 'Add staff' }))[0]);
        const drawer = screen.getByRole('dialog', { name: 'Add staff' });
        // The tab, not the empty state's shortcut to it.
        await user.click(within(within(drawer).getByRole('group', { name: 'Add staff' })).getByRole('button', { name: 'New account' }));

        await user.click(within(drawer).getByRole('button', { name: 'Create and send invite' }));
        expect(within(drawer).getByText('Enter a valid email address.')).toBeInTheDocument();
        expect(created).toBeNull();

        await user.type(within(drawer).getByLabelText('First name'), 'Meera');
        await user.type(within(drawer).getByLabelText('Last name'), 'Iyer');
        await user.type(within(drawer).getByLabelText('Email'), 'meera@example.com');
        await user.type(within(drawer).getByLabelText('Phone'), '97311 88776');
        expect(within(drawer).getByRole('switch', { name: /add to this tournament/i })).toBeChecked();
        await user.click(within(drawer).getByRole('button', { name: 'Create and send invite' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(created).toEqual({ firstName: 'Meera', lastName: 'Iyer', email: 'meera@example.com', phone: '97311 88776' });
        expect(assigned).toEqual({ staffId: 's9' });
        expect(store.getState().tournament.currentTournament?.staffIds).toEqual(['s9']);
        expect(await screen.findByRole('button', { name: 'Remove Meera Iyer' })).toBeInTheDocument();
    });

    it('shows an assign failure inside the drawer, not the page banner', async () => {
        const { store } = setup([member(), member({ _id: 's4', firstName: 'Karthik', lastName: 'N', email: 'karthik@example.com', isActive: false })]);
        server.use(http.post(`${API}/tournament/t1/staff`, () => HttpResponse.json({ message: 'User is already staff for this tournament.' }, { status: 400 })));
        const user = userEvent.setup();

        await user.click((await screen.findAllByRole('button', { name: 'Add staff' }))[0]);
        const drawer = screen.getByRole('dialog', { name: 'Add staff' });
        expect(within(drawer).queryByRole('button', { name: 'Add Karthik N' })).not.toBeInTheDocument(); // inactive
        expect(within(drawer).getByText('Inactive')).toBeInTheDocument();
        await user.click(await within(drawer).findByRole('button', { name: 'Add Ananya Rao' }));

        expect(await within(drawer).findByRole('alert')).toHaveTextContent('Couldn’t add Ananya Rao. User is already staff for this tournament.');
        expect(store.getState().tournament.error).toBeNull();
    });

    it('removes a staff member after confirming', async () => {
        setup([member()], ['s1']);
        let removed = false;
        server.use(http.delete(`${API}/tournament/t1/staff/s1`, () => { removed = true; return envelope({ _id: 't1', staffIds: [] }); }));
        const user = userEvent.setup();

        expect(screen.getByRole('status')).toHaveTextContent('Loading staff'); // not raw IDs
        await user.click(await screen.findByRole('button', { name: 'Remove Ananya Rao' }));
        expect(removed).toBe(false);
        const bar = screen.getByRole('alertdialog', { name: 'Remove' });
        expect(bar).toHaveTextContent('Remove Ananya Rao from this tournament? Their account stays');
        await user.click(within(bar).getByRole('button', { name: 'Remove' }));

        expect(await screen.findByText('No staff on this tournament yet')).toBeInTheDocument();
        expect(removed).toBe(true);
    });
});
