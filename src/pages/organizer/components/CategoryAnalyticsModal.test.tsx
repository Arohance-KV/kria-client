import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import tournamentReducer from '@/store/slices/tournamentSlice';
import CategoryAnalyticsModal from './CategoryAnalyticsModal';

const BASE = 'https://api.kria.club';
const envelope = (data: unknown) => HttpResponse.json({ data: { data } });

const ENTRY = {
    _id: 'r1',
    playerId: 'p1',
    profile: { firstName: 'Aisha', lastName: 'Rao' },
    stats: { matchesPlayed: 3, matchesWon: 3, pointsContributed: 60 },
};

function renderModal() {
    const posted: unknown[] = [];
    server.use(
        http.get(`${BASE}/categories/cat1/analytics`, () => envelope({ analytics: [ENTRY] })),
        http.post(`${BASE}/tournament/t1/awards`, async ({ request }) => {
            posted.push(await request.json());
            return envelope({ _id: 't1' });
        }),
        // The modal refreshes the tournament after a grant.
        http.get(`${BASE}/tournament/t1`, () => envelope({ _id: 't1' })),
    );
    // The test DOM has no alert(); the modal reports success through one.
    vi.stubGlobal('alert', vi.fn());
    const store = configureStore({ reducer: { tournament: tournamentReducer } });
    render(
        <Provider store={store}>
            <CategoryAnalyticsModal
                isOpen
                onClose={() => {}}
                category={{ _id: 'cat1', name: 'Mens Singles', status: 'ongoing' }}
                tournamentId="t1"
            />
        </Provider>,
    );
    return { posted };
}

describe('CategoryAnalyticsModal — grant with a badge', () => {
    it('prefills the title from the picked badge and sends the badge key', async () => {
        const user = userEvent.setup();
        const { posted } = renderModal();

        await user.click(await screen.findByRole('button', { name: /grant award/i }));
        const confirm = screen.getByRole('button', { name: 'Confirm' });
        expect(confirm).toBeDisabled(); // no badge yet

        await user.click(screen.getByRole('button', { name: 'Season MVP' }));
        const title = screen.getByLabelText('Award title');
        expect(title).toHaveValue('Season MVP');
        expect(confirm).toBeEnabled();

        await user.clear(title);
        expect(confirm).toBeDisabled(); // badge alone is not enough
        await user.type(title, '  MVP of the Cup ');
        await user.click(confirm);

        await waitFor(() => expect(posted).toHaveLength(1));
        expect(posted[0]).toMatchObject({
            title: 'MVP of the Cup',
            badge: 'season-mvp',
            playerId: 'p1',
            categoryId: 'cat1',
        });
    });

    it('starts the form empty again for the next grant', async () => {
        const user = userEvent.setup();
        renderModal();

        await user.click(await screen.findByRole('button', { name: /grant award/i }));
        await user.click(screen.getByRole('button', { name: 'Centurion' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        await user.click(screen.getByRole('button', { name: /grant award/i }));

        expect(screen.getByLabelText('Award title')).toHaveValue('');
        expect(screen.getByRole('button', { name: 'Centurion' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });
});
