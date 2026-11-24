import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { MotionGlobalConfig } from 'framer-motion';
import authReducer, { setPassword, verifyOtp } from '@/store/slices/authSlice';
import { server } from '@/test/server';
import SignUpPage from './SignUpPage';

const API = 'https://api.kria.club';

// The step transition's cancelled animation rejects under happy-dom.
MotionGlobalConfig.skipAnimations = true;

// LAUNCH-AUDIT H24: "Resend Code" had no handler.
describe('SignUpPage', () => {
    it('resends the verification code to the email being registered', async () => {
        const resent: unknown[] = [];
        server.use(
            http.post(`${API}/organizer/auth/register`, () => HttpResponse.json({ data: { message: 'OTP sent.' } })),
            http.post(`${API}/organizer/auth/resend-otp`, async ({ request }) => { resent.push(await request.json()); return HttpResponse.json({ data: { message: 'OTP sent to email.' } }); }),
        );
        render(<Provider store={configureStore({ reducer: { auth: authReducer } })}><MemoryRouter><SignUpPage /></MemoryRouter></Provider>);
        const user = userEvent.setup();

        await user.click(screen.getByText('I am an Organizer'));
        await user.type(screen.getByLabelText('First Name'), 'Ria');
        await user.type(screen.getByLabelText('Last Name'), 'Sen');
        await user.type(screen.getByLabelText('Email'), 'ria@kria.test');
        await user.type(screen.getByLabelText('Phone Number'), '9876543210');
        await user.click(screen.getByRole('button', { name: 'Next Step' }));

        await user.click(await screen.findByRole('button', { name: 'Resend Code' }));
        expect(await screen.findByText('A new code is on its way.')).toBeInTheDocument();
        expect(resent).toEqual([{ email: 'ria@kria.test' }]);
    });

    // LAUNCH-AUDIT M1: set-password must carry the token the code step returned.
    it('finishes sign-up with the token from the code step', async () => {
        let body: unknown;
        server.use(
            http.post(`${API}/organizer/auth/verify-otp`, () => HttpResponse.json({ data: { status: 'otp_verified', setupToken: 'setup-1' } })),
            http.post(`${API}/organizer/auth/set-password`, async ({ request }) => { body = await request.json(); return HttpResponse.json({ data: { accessToken: 'a', organizer: { _id: 'o1' } } }); }),
        );
        const store = configureStore({ reducer: { auth: authReducer } });
        await store.dispatch(verifyOtp({ role: 'organizer', data: { email: 'ria@kria.test', otp: '123456' } }));
        await store.dispatch(setPassword({ role: 'organizer', data: { email: 'ria@kria.test', password: 'Passw0rd1' } }));
        expect(body).toEqual({ email: 'ria@kria.test', password: 'Passw0rd1', setupToken: 'setup-1' });
    });

    // LAUNCH-AUDIT H26 (your call, 23 Nov): a player gives a date of birth to sign up;
    // 13 and over, and 13–17 with a parent or guardian's agreement.
    describe('player sign-up asks for a date of birth', () => {
        const year = new Date().getFullYear();
        async function playerStepOne(dob: string) {
            const bodies: Record<string, unknown>[] = [];
            server.use(http.post(`${API}/player/auth/register`, async ({ request }) => { bodies.push(await request.json() as Record<string, unknown>); return HttpResponse.json({ data: { message: 'OTP sent.' } }); }));
            render(<Provider store={configureStore({ reducer: { auth: authReducer } })}><MemoryRouter><SignUpPage /></MemoryRouter></Provider>);
            const user = userEvent.setup();
            await user.click(screen.getByText('I am a Player'));
            await user.type(screen.getByLabelText('First Name'), 'Asha');
            await user.type(screen.getByLabelText('Last Name'), 'Rao');
            await user.type(screen.getByLabelText('Email'), 'asha@kria.test');
            await user.type(screen.getByLabelText('Phone Number'), '9876543210');
            fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: dob } });
            return { user, bodies };
        }

        it('stops an under-13 before anything is sent', async () => {
            const { user, bodies } = await playerStepOne(`${year - 11}-01-01`);
            await user.click(screen.getByRole('button', { name: 'Next Step' }));
            expect(await screen.findByText('Kria is for players 13 and over.')).toBeInTheDocument();
            expect(bodies).toHaveLength(0);
        });

        it("sends a 13 to 17 year old's date with their guardian's agreement", async () => {
            const { user, bodies } = await playerStepOne(`${year - 16}-01-01`);
            await user.click(screen.getByRole('button', { name: 'Next Step' }));
            expect(await screen.findByText(/need a parent or guardian to agree/)).toBeInTheDocument();
            expect(bodies).toHaveLength(0);

            await user.click(screen.getByRole('checkbox', { name: /^My parent or guardian agrees/ }));
            await user.click(screen.getByRole('button', { name: 'Next Step' }));
            await waitFor(() => expect(bodies[0]).toMatchObject({ email: 'asha@kria.test', dateOfBirth: `${year - 16}-01-01`, guardianConsent: true }));
        });
    });
});
