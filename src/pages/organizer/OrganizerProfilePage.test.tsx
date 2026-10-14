import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/slices/authSlice';
import { server } from '@/test/server';
import OrganizerProfilePage from './OrganizerProfilePage';

const API = 'https://api.kria.club/organizer/auth';

const organizer = {
    _id: 'o1', firstName: 'Arjun', lastName: 'Sharma', email: 'arjun@smashpoint.in', phone: '98450 12873',
    createdAt: '2025-03-14T10:00:00.000Z',
    organization: { name: 'SmashPoint', description: 'Weekend leagues.', logo: 'https://cdn/logo.png' },
};

/** Mocks the stats call made on mount and counts every write, so tests can assert which requests went out. */
const mockApi = () => {
    const calls = { profile: [] as unknown[], organization: [] as unknown[], password: 0, photo: 0 };
    server.use(
        http.get(`${API}/stats`, () => HttpResponse.json({ data: { totalTournaments: 12, completedTournaments: 9, totalPlayersHosted: 486 } })),
        http.patch(`${API}/profile`, async ({ request }) => {
            const body = await request.json() as object;
            calls.profile.push(body);
            return HttpResponse.json({ data: { ...organizer, ...body } });
        }),
        http.patch(`${API}/organization`, async ({ request }) => {
            const body = await request.json() as object;
            calls.organization.push(body);
            return HttpResponse.json({ data: { ...organizer, organization: body } });
        }),
        http.put(`${API}/profile-image`, () => { calls.photo++; return HttpResponse.json({ data: organizer }); }),
    );
    return calls;
};

const renderPage = () => {
    const store = configureStore({
        reducer: { auth: authReducer },
        preloadedState: { auth: { ...authReducer(undefined, { type: 'init' }), role: 'organizer' as const, user: organizer as never } },
    });
    render(
        <Provider store={store}>
            <MemoryRouter><OrganizerProfilePage /></MemoryRouter>
        </Provider>,
    );
};

describe('OrganizerProfilePage', () => {
    it('shows the account and saves only the personal details', async () => {
        const calls = mockApi();
        renderPage();

        const account = screen.getByRole('region', { name: 'Account' });
        expect(within(account).getByText('arjun@smashpoint.in · SmashPoint')).toBeInTheDocument();
        expect(within(account).getByText('Organizer since March 2025')).toBeInTheDocument();
        expect(await within(account).findByText('486')).toBeInTheDocument();
        expect(within(account).getByRole('link', { name: /All tournaments/ })).toHaveAttribute('href', '/organizer/home');
        expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();

        const first = screen.getByLabelText('First name');
        await userEvent.clear(first);
        await userEvent.type(first, 'Arjun K ');
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByText('Saved your details.')).toBeInTheDocument();
        expect(calls.profile).toEqual([{ firstName: 'Arjun K', lastName: 'Sharma', phone: '98450 12873' }]);
        expect(calls.organization).toHaveLength(0);
        expect(within(account).getByText('Arjun K Sharma')).toBeInTheDocument();
    });

    it('blocks saving an invalid form and focuses the first bad field', async () => {
        const calls = mockApi();
        renderPage();

        await userEvent.clear(screen.getByLabelText('Last name'));
        await userEvent.clear(screen.getByLabelText('Mobile'));
        await userEvent.type(screen.getByLabelText('Mobile'), '12ab');
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(screen.getByLabelText('Last name')).toHaveFocus();
        expect(screen.getByText('Enter your last name.')).toBeInTheDocument();
        expect(screen.getByText('Enter a 10-digit mobile number.')).toBeInTheDocument();
        expect(calls.profile).toHaveLength(0);

        await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
        expect(screen.getByLabelText('Last name')).toHaveValue('Sharma');
        expect(screen.queryByText('Enter your last name.')).not.toBeInTheDocument();
    });

    it('saves the organization to its own endpoint and keeps the logo', async () => {
        const calls = mockApi();
        renderPage();

        const about = screen.getByLabelText('About');
        await userEvent.type(about, ' Six courts.');
        expect(screen.getByText(`${'Weekend leagues. Six courts.'.length} characters`)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByText('Saved your organization.')).toBeInTheDocument();
        expect(calls.organization).toEqual([{ name: 'SmashPoint', description: 'Weekend leagues. Six courts.', logo: 'https://cdn/logo.png' }]);
        expect(calls.profile).toHaveLength(0);
    });

    it('catches a password mismatch locally and shows the server error under the current password', async () => {
        mockApi();
        let sent: unknown = null;
        server.use(http.post(`${API}/change-password`, async ({ request }) => {
            sent = await request.json();
            return HttpResponse.json({ message: 'Current password is incorrect.' }, { status: 401 });
        }));
        renderPage();

        const current = screen.getByLabelText('Current password');
        await userEvent.type(current, 'old-pass');
        await userEvent.type(screen.getByLabelText('New password'), 'new-pass');
        await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-pazz');
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        expect(screen.getByText('The passwords don’t match.')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm new password')).toHaveFocus();
        expect(sent).toBeNull();

        await userEvent.clear(screen.getByLabelText('Confirm new password'));
        await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-pass');
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

        expect(await within(current.parentElement!).findByText('Current password is incorrect.')).toBeInTheDocument();
        expect(sent).toEqual({ currentPassword: 'old-pass', newPassword: 'new-pass' });
        expect(current).toHaveFocus();
    });

    it('refuses a photo over the server limit before uploading', async () => {
        const calls = mockApi();
        renderPage();

        const big = new File(['x'], 'court.png', { type: 'image/png' });
        Object.defineProperty(big, 'size', { value: 6_000_000 });
        await userEvent.upload(document.getElementById('pf-photo') as HTMLInputElement, big);

        expect(screen.getByText('That image is 6.0 MB. Use one under 5 MB.')).toBeInTheDocument();
        expect(calls.photo).toBe(0);
    });
});
