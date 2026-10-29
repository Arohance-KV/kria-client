import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import type { PairingState } from '@/lib/pairs';
import PairingPanel from './PairingPanel';

const API = 'https://api.kria.club';

const p = (registrationId: string, name: string, teamId: string, partnerRegistrationId: string | null = null) =>
    ({ registrationId, name, teamId, partnerRegistrationId });

const state = (over: Partial<PairingState> = {}): PairingState => ({
    players: [
        p('a', 'Asha Rao', 't1', 'b'), p('b', 'Priya Nair', 't1', 'a'),
        p('c', 'Kiran Shetty', 't1'), p('f', 'Meera Iyer', 't1'),
        p('d', 'Rohan Desai', 't2'),
    ],
    teams: [{ _id: 't1', name: 'Smashers' }, { _id: 't2', name: 'Hawks' }],
    drawn: false, locked: false, sideIds: [],
    ...over,
});

const ok = (data: unknown) => HttpResponse.json({ data: { data } });

/** Serves `initial`, and records every write. */
function mockPairs(initial: PairingState) {
    const writes: { method: string; url: string; body?: unknown }[] = [];
    const record = async ({ request }: { request: Request }) => {
        const body = request.method === 'DELETE' ? undefined : await request.json();
        writes.push({ method: request.method, url: new URL(request.url).pathname, body });
        return ok(initial);
    };
    server.use(
        http.get(`${API}/registrations/categories/c1/pairs`, () => ok(initial)),
        http.post(`${API}/registrations/categories/c1/pairs`, record),
        http.put(`${API}/registrations/:id/partner`, record),
        http.delete(`${API}/registrations/:id/partner`, record),
    );
    return writes;
}

const renderPanel = (readOnly = false) => {
    const onChange = vi.fn();
    render(<PairingPanel categoryId="c1" readOnly={readOnly} onChange={onChange} />);
    return onChange;
};

describe('PairingPanel', () => {
    it('shows one card per team with its pairs and unpaired players, and reports the state', async () => {
        mockPairs(state());
        const onChange = renderPanel();
        const smashers = await screen.findByRole('region', { name: 'Smashers' });
        expect(within(smashers).getByText('Asha Rao')).toBeInTheDocument();
        expect(within(smashers).getByRole('button', { name: 'Kiran Shetty' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Hawks' })).toBeInTheDocument();
        expect(screen.getByText('Odd one out: sits out the draw unless the team bought another player.')).toBeInTheDocument();
        await waitFor(() => expect(onChange).toHaveBeenCalledWith(state()));
    });

    it('pairs two unpaired teammates', async () => {
        const writes = mockPairs(state());
        renderPanel();
        await userEvent.click(await screen.findByRole('button', { name: 'Kiran Shetty' }));
        expect(screen.getByText("Now pick Kiran Shetty's partner on the same team")).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Meera Iyer' }));
        await waitFor(() => expect(writes).toEqual([{ method: 'POST', url: '/registrations/categories/c1/pairs', body: { registrationIds: ['c', 'f'] } }]));
    });

    it('a paired player, then a teammate, changes that player\'s partner', async () => {
        const writes = mockPairs(state());
        renderPanel();
        await userEvent.click(await screen.findByRole('button', { name: 'Asha Rao' }));
        await userEvent.click(screen.getByRole('button', { name: 'Kiran Shetty' }));
        await waitFor(() => expect(writes).toEqual([{ method: 'PUT', url: '/registrations/a/partner', body: { partnerRegistrationId: 'c' } }]));
    });

    it('an unpaired player, then a paired teammate, becomes that teammate\'s partner', async () => {
        const writes = mockPairs(state());
        renderPanel();
        await userEvent.click(await screen.findByRole('button', { name: 'Kiran Shetty' }));
        await userEvent.click(screen.getByRole('button', { name: 'Asha Rao' }));
        await waitFor(() => expect(writes).toEqual([{ method: 'PUT', url: '/registrations/a/partner', body: { partnerRegistrationId: 'c' } }]));
    });

    it('picking someone on another team moves the pick instead of pairing', async () => {
        const writes = mockPairs(state());
        renderPanel();
        await userEvent.click(await screen.findByRole('button', { name: 'Kiran Shetty' }));
        await userEvent.click(screen.getByRole('button', { name: 'Rohan Desai' }));
        expect(screen.getByText("Now pick Rohan Desai's partner on the same team")).toBeInTheDocument();
        expect(writes).toEqual([]);
    });

    it('unpairs a pair', async () => {
        const writes = mockPairs(state());
        renderPanel();
        await userEvent.click(await screen.findByRole('button', { name: 'Unpair Asha Rao and Priya Nair' }));
        await waitFor(() => expect(writes).toEqual([{ method: 'DELETE', url: '/registrations/a/partner', body: undefined }]));
    });

    it('has no controls when locked or read-only', async () => {
        mockPairs(state({ locked: true }));
        renderPanel();
        await screen.findByRole('region', { name: 'Smashers' });
        expect(screen.queryAllByRole('button')).toEqual([]);
    });

    it('shows the server\'s message when a write is refused', async () => {
        mockPairs(state());
        server.use(http.post(`${API}/registrations/categories/c1/pairs`, () =>
            HttpResponse.json({ message: 'Partners must be on the same team.' }, { status: 400 })));
        renderPanel();
        await userEvent.click(await screen.findByRole('button', { name: 'Kiran Shetty' }));
        await userEvent.click(screen.getByRole('button', { name: 'Meera Iyer' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Partners must be on the same team.');
    });
});
