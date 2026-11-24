import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { server } from '@/test/server';
import ForgotPasswordPage from './ForgotPasswordPage';

// LAUNCH-AUDIT H24: the page faked both steps with setTimeout; no code was sent
// and no password changed.

const API = 'https://api.kria.club';

function renderAt(url: string) {
    const calls: { path: string; body: unknown }[] = [];
    for (const who of ['player', 'organizer']) {
        server.use(
            http.post(`${API}/${who}/auth/forgot-password`, async ({ request }) => {
                calls.push({ path: `${who}/forgot`, body: await request.json() });
                return HttpResponse.json({ data: { message: 'OTP sent to email.' } });
            }),
            http.post(`${API}/${who}/auth/reset-password`, async ({ request }) => {
                calls.push({ path: `${who}/reset`, body: await request.json() });
                return HttpResponse.json({ data: { message: 'Password reset successfully.' } });
            }),
        );
    }
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/login" element={<p>Sign in page</p>} />
            </Routes>
        </MemoryRouter>,
    );
    return calls;
}

async function throughBothSteps(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Email'), 'ria@kria.test');
    await user.click(screen.getByRole('button', { name: 'Send Reset Code' }));
    await user.type(await screen.findByLabelText('Enter OTP'), '123456');
    await user.type(screen.getByLabelText('New Password'), 'new-Password-1');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));
}

describe('ForgotPasswordPage', () => {
    it("sends the code and resets an organiser's password, then goes to sign in", async () => {
        const calls = renderAt('/forgot-password?role=organizer');
        await throughBothSteps(userEvent.setup());

        expect(await screen.findByText('Sign in page')).toBeInTheDocument();
        expect(calls).toEqual([
            { path: 'organizer/forgot', body: { email: 'ria@kria.test' } },
            { path: 'organizer/reset', body: { email: 'ria@kria.test', otp: '123456', newPassword: 'new-Password-1' } },
        ]);
    });

    it('resets a player account when sign-in was on the player tab', async () => {
        const calls = renderAt('/forgot-password?role=player');
        await throughBothSteps(userEvent.setup());
        expect(calls.map(c => c.path)).toEqual(['player/forgot', 'player/reset']);
    });

    it("shows the server's refusal and stays on the form", async () => {
        renderAt('/forgot-password?role=organizer');
        server.use(http.post(`${API}/organizer/auth/reset-password`, () => HttpResponse.json({ message: 'Invalid OTP.' }, { status: 400 })));
        await throughBothSteps(userEvent.setup());

        expect(await screen.findByText('Invalid OTP.')).toBeInTheDocument();
        expect(screen.queryByText('Sign in page')).not.toBeInTheDocument();
    });
});
