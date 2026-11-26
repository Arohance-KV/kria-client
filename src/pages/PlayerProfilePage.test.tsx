import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import authReducer from '@/store/slices/authSlice';
import registrationReducer from '@/store/slices/registrationSlice';
import { server } from '@/test/server';
import PlayerProfilePage from './PlayerProfilePage';

vi.mock('@/components/HoverFooter', () => ({ default: () => null }));

const API = 'https://api.kria.club';

// LAUNCH-AUDIT H26: a player 13–17 saving a date of birth on the web needs a
// parent or guardian to agree, as in the app; the server refuses it otherwise.
describe('PlayerProfilePage', () => {
    it('asks a 13 to 17 year old to tick that a parent or guardian agrees, and sends it', async () => {
        const teen = { _id: 'p1', firstName: 'Asha', lastName: 'Rao', email: 'a@kria.test', phone: '9876543210', status: 'active', dateOfBirth: `${new Date().getFullYear() - 16}-01-01` };
        let body: Record<string, unknown> | undefined;
        server.use(
            http.get(`${API}/registrations/my-registrations`, () => HttpResponse.json({ data: { data: [] } })),
            http.get(`${API}/player/auth/stats`, () => HttpResponse.json({ data: { data: {} } })),
            http.patch(`${API}/player/auth/profile`, async ({ request }) => { body = await request.json() as Record<string, unknown>; return HttpResponse.json({ data: { data: teen } }); }),
        );
        const initial = authReducer(undefined, { type: '@@INIT' });
        const store = configureStore({
            reducer: { auth: authReducer, registration: registrationReducer },
            preloadedState: { auth: { ...initial, user: teen, role: 'player' as const, accessToken: 't' } },
        });
        render(<Provider store={store}><MemoryRouter><PlayerProfilePage /></MemoryRouter></Provider>);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: /Edit Profile/ }));
        // Every field in the edit form has a name for screen readers.
        expect(screen.getByLabelText('First Name')).toHaveValue('Asha');
        for (const name of ['Last Name', 'Phone', 'Gender', 'Birth day', 'Birth month', 'Birth year', 'Sport', 'Location']) {
            expect(screen.getByLabelText(name)).toBeInTheDocument();
        }
        const consent = screen.getByRole('checkbox', { name: /^My parent or guardian agrees/ });
        await user.click(consent);
        await user.click(screen.getByRole('button', { name: /Save/ }));

        await vi.waitFor(() => expect(body).toMatchObject({ dateOfBirth: teen.dateOfBirth, guardianConsent: true }));
    });
});
