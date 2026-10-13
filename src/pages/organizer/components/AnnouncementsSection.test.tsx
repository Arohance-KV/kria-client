import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import AnnouncementsSection from './AnnouncementsSection';

const API = 'https://api.kria.club';
const envelope = (data: unknown) => HttpResponse.json({ data: { data } });

const post = (patch = {}) => ({
    _id: 'a1', tournamentId: 't1', title: 'Bring a photo ID', message: 'Show it at check-in.', severity: 'important',
    pinned: false, authorName: 'Rohan Kumar', authorRole: 'organizer', createdAt: '2026-10-11T12:35:00Z', updatedAt: '2026-10-11T12:35:00Z',
    ...patch,
});

describe('AnnouncementsSection', () => {
    it('posts a new announcement from the drawer', async () => {
        let list: unknown[] = [];
        let sent: Record<string, unknown> | null = null;
        server.use(
            http.get(`${API}/tournaments/t1/announcements`, () => envelope(list)),
            http.post(`${API}/tournaments/t1/announcements`, async ({ request }) => {
                sent = await request.json() as Record<string, unknown>;
                list = [post({ ...sent, _id: 'a2' })];
                return envelope(list[0]);
            }),
        );
        const user = userEvent.setup();
        render(<AnnouncementsSection tournamentId="t1" />);

        expect(await screen.findByText('No announcements yet')).toBeInTheDocument();
        await user.click(screen.getAllByRole('button', { name: /new announcement/i })[0]);

        const drawer = screen.getByRole('dialog', { name: 'New announcement' });
        await user.click(within(drawer).getByRole('button', { name: 'Post announcement' }));
        expect(within(drawer).getByText('Write a message for players.')).toBeInTheDocument(); // message is required
        expect(sent).toBeNull();

        await user.type(within(drawer).getByLabelText('Title'), 'Day 2 starts at 8');
        await user.type(within(drawer).getByLabelText('Message'), 'Report by 7:30 AM.');
        expect(within(drawer).getByText('18/4000')).toBeInTheDocument();
        await user.click(within(drawer).getByRole('radio', { name: 'Schedule change' }));
        await user.click(within(drawer).getByRole('switch', { name: /pin to top/i }));
        await user.click(within(drawer).getByRole('button', { name: 'Post announcement' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(sent).toEqual({ title: 'Day 2 starts at 8', message: 'Report by 7:30 AM.', severity: 'schedule_change', pinned: true });
        expect(await screen.findByText('Report by 7:30 AM.')).toBeInTheDocument();
        expect(screen.getByText('Schedule change')).toBeInTheDocument();
        expect(screen.getByText('Pinned')).toBeInTheDocument();
    });

    it('shows a failed post inside the drawer and keeps the draft', async () => {
        server.use(
            http.get(`${API}/tournaments/t1/announcements`, () => envelope([])),
            http.post(`${API}/tournaments/t1/announcements`, () => HttpResponse.json({ message: 'Only organizers and staff can post.' }, { status: 403 })),
        );
        const user = userEvent.setup();
        render(<AnnouncementsSection tournamentId="t1" />);

        await user.click((await screen.findAllByRole('button', { name: /new announcement/i }))[0]);
        const drawer = screen.getByRole('dialog', { name: 'New announcement' });
        await user.type(within(drawer).getByLabelText('Message'), 'Courts change on Sunday.');
        await user.click(within(drawer).getByRole('button', { name: 'Post announcement' }));

        expect(await within(drawer).findByRole('alert')).toHaveTextContent('Only organizers and staff can post.');
        expect(within(drawer).getByLabelText('Message')).toHaveValue('Courts change on Sunday.');
    });

    it('says when announcements fail to load instead of showing the empty state', async () => {
        server.use(http.get(`${API}/tournaments/t1/announcements`, () => HttpResponse.json({ message: 'Tournament not found.' }, { status: 404 })));
        render(<AnnouncementsSection tournamentId="t1" />);

        expect(await screen.findByText('Couldn’t load announcements')).toBeInTheDocument();
        expect(screen.getByText('Tournament not found.')).toBeInTheDocument();
        expect(screen.queryByText('No announcements yet')).not.toBeInTheDocument();
    });

    it('pins with the existing payload and deletes after confirming', async () => {
        let list = [post({ _id: 'a1', title: 'Older', pinned: false }), post({ _id: 'a2', title: 'Newer', severity: 'info', pinned: true })];
        let updated: unknown = null;
        let deleted = false;
        server.use(
            http.get(`${API}/tournaments/t1/announcements`, () => envelope(list)),
            http.put(`${API}/announcements/a1`, async ({ request }) => {
                updated = await request.json();
                list = list.map(a => (a._id === 'a1' ? { ...a, pinned: true } : a));
                return envelope(list[0]);
            }),
            http.delete(`${API}/announcements/a1`, () => {
                deleted = true;
                list = list.filter(a => a._id !== 'a1');
                return envelope(null);
            }),
        );
        const user = userEvent.setup();
        render(<AnnouncementsSection tournamentId="t1" />);

        // Pinned posts come first.
        const titles = (await screen.findAllByRole('heading', { level: 3 })).map(h => h.textContent);
        expect(titles).toEqual(['Newer', 'Older']);

        await user.click(screen.getByRole('button', { name: 'Actions for Older' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Pin to top' }));
        await waitFor(() => expect(updated).toEqual({ title: 'Older', message: 'Show it at check-in.', severity: 'important', pinned: true }));

        await user.click(screen.getByRole('button', { name: 'Actions for Older' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
        expect(deleted).toBe(false); // the menu only asks
        expect(screen.getByText('Delete this announcement? Players will no longer see it.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(screen.queryByText('Older')).not.toBeInTheDocument());
        expect(deleted).toBe(true);
    });
});
