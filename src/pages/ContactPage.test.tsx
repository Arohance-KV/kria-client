import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/server';
import ContactPage from './ContactPage';

// LAUNCH-AUDIT H24: the form faked a send with setTimeout; nothing reached Kria.

vi.mock('@/components/Navbar', () => ({ default: () => null }));
vi.mock('@/components/HoverFooter', () => ({ default: () => null }));
vi.mock('@/components/SmoothScroll', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

const API = 'https://api.kria.club';

async function fillAndSend(user: ReturnType<typeof userEvent.setup>) {
    // By label: every field is tied to its visible label.
    await user.type(screen.getByLabelText(/Full Name/), 'Ria Sen');
    await user.type(screen.getByLabelText(/Email Address/), 'ria@kria.test');
    await user.type(screen.getByLabelText(/Phone Number/), '98765 43210');
    await user.selectOptions(screen.getByLabelText(/Subject/), 'Tournament Setup');
    await user.type(screen.getByLabelText(/Message/), 'We run a district open.');
    await user.click(screen.getByRole('button', { name: /Send Message/i }));
}

describe('ContactPage', () => {
    it('sends the message to Kria and says so', async () => {
        let body: unknown;
        server.use(http.post(`${API}/contact`, async ({ request }) => { body = await request.json(); return HttpResponse.json({ data: { data: true } }); }));
        render(<MemoryRouter><ContactPage /></MemoryRouter>);

        await fillAndSend(userEvent.setup());

        expect(await screen.findByText('Message Sent!')).toBeInTheDocument();
        expect(body).toEqual({
            fullName: 'Ria Sen', email: 'ria@kria.test', isdCode: '+91', phoneNumber: '98765 43210',
            subject: 'Tournament Setup', message: 'We run a district open.', iss: 'kria.club/contact',
        });
    });

    it('says the send failed and keeps what was typed', async () => {
        server.use(http.post(`${API}/contact`, () => HttpResponse.json({ message: 'Too many requests.' }, { status: 429 })));
        render(<MemoryRouter><ContactPage /></MemoryRouter>);

        await fillAndSend(userEvent.setup());

        expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests.');
        expect(screen.queryByText('Message Sent!')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('John Doe')).toHaveValue('Ria Sen');
    });
});
