import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/server';
import DeleteAccountPage from './DeleteAccountPage';

// LAUNCH-AUDIT B7: Play needs a web page where a player can delete their
// account without the app. The page signs in by emailed code and deletes.

// Site chrome only; the flow under test doesn't touch it.
vi.mock('@/components/Navbar', () => ({ default: () => null }));
vi.mock('@/components/HoverFooter', () => ({ default: () => null }));
vi.mock('@/components/SmoothScroll', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

const API = 'https://api.kria.club';
const calls: { path: string; body?: unknown; auth?: string | null }[] = [];

function handlers(verify: () => Response = () => HttpResponse.json({ data: { data: { accessToken: 'player-token' } } })) {
    server.use(
        http.post(`${API}/player/auth/login/otp`, async ({ request }) => {
            calls.push({ path: 'send', body: await request.json() });
            return HttpResponse.json({ data: { message: 'OTP sent to email.' } });
        }),
        http.post(`${API}/player/auth/login/otp/verify`, async ({ request }) => {
            calls.push({ path: 'verify', body: await request.json() });
            return verify();
        }),
        http.delete(`${API}/player/auth/account`, ({ request }) => {
            calls.push({ path: 'delete', auth: request.headers.get('Authorization') });
            return HttpResponse.json({ data: { message: 'Account deleted.' } });
        }),
    );
}

const renderIt = () => render(<MemoryRouter><DeleteAccountPage /></MemoryRouter>);

async function throughCode(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Email'), '  Asha@Example.com ');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('Code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
}

afterEach(() => { calls.length = 0; localStorage.clear(); });

describe('Delete account page', () => {
    it('sends a code, then deletes with it', async () => {
        handlers();
        const user = userEvent.setup();
        renderIt();
        await throughCode(user);

        expect(await screen.findByText('Your account has been deleted.')).toBeTruthy();
        expect(calls).toEqual([
            { path: 'send', body: { email: 'asha@example.com' } },
            { path: 'verify', body: { email: 'asha@example.com', otp: '123456' } },
            { path: 'delete', auth: 'Bearer player-token' },
        ]);
    });

    it('uses the code\'s token even when an organiser is signed in', async () => {
        localStorage.setItem('accessToken', 'org-token');
        handlers();
        const user = userEvent.setup();
        renderIt();
        await throughCode(user);

        await screen.findByText('Your account has been deleted.');
        expect(calls.find((c) => c.path === 'delete')?.auth).toBe('Bearer player-token');
    });

    it('shows the server message for a wrong code and deletes nothing', async () => {
        handlers(() => HttpResponse.json({ message: 'Invalid OTP.' }, { status: 400 }));
        const user = userEvent.setup();
        renderIt();
        await throughCode(user);

        expect(await screen.findByText('Invalid OTP.')).toBeTruthy();
        await waitFor(() => expect(calls.map((c) => c.path)).toEqual(['send', 'verify']));
        expect(screen.queryByText('Your account has been deleted.')).toBeNull();
    });
});
