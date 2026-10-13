import { describe, expect, it } from 'vitest';
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

const AISHA = {
    _id: 'r1',
    playerId: 'p1',
    profile: { firstName: 'Aisha', lastName: 'Rao' },
    team: { name: 'Smash Kings' },
    stats: { matchesPlayed: 3, matchesWon: 3, pointsContributed: 60 },
};
const BEN = { _id: 'r2', playerId: 'p2', profile: { firstName: 'Ben', lastName: 'Joseph' }, stats: { matchesPlayed: 3, matchesWon: 1, pointsContributed: 41 } };

function renderModal({ status = 'ongoing', award = () => envelope({ _id: 'a1' }) as Response } = {}) {
    const posted: unknown[] = [];
    server.use(
        http.get(`${BASE}/categories/cat1/analytics`, () => envelope({ analytics: [AISHA, BEN] })),
        http.post(`${BASE}/tournament/t1/awards`, async ({ request }) => {
            posted.push(await request.json());
            return award();
        }),
        // The modal refreshes the tournament after a grant.
        http.get(`${BASE}/tournament/t1`, () => envelope({ _id: 't1' })),
    );
    const store = configureStore({ reducer: { tournament: tournamentReducer } });
    render(
        <Provider store={store}>
            <CategoryAnalyticsModal
                isOpen
                onClose={() => {}}
                category={{ _id: 'cat1', name: 'Mens Singles', status }}
                tournamentId="t1"
            />
        </Provider>,
    );
    return { posted };
}

describe('CategoryAnalyticsModal — grant with a badge', () => {
    it('prefills the title from the picked badge, sends the badge key and confirms inline', async () => {
        const user = userEvent.setup();
        const { posted } = renderModal();

        await user.click(await screen.findByRole('button', { name: 'Give award to Aisha Rao' }));
        const give = screen.getByRole('button', { name: 'Give award' });
        expect(give).toBeDisabled(); // no badge yet

        await user.click(screen.getByRole('button', { name: 'Season MVP' }));
        const title = screen.getByLabelText('Award title');
        expect(title).toHaveValue('Season MVP');
        expect(give).toBeEnabled();

        await user.clear(title);
        expect(give).toBeDisabled(); // badge alone is not enough
        await user.type(title, '  MVP of the Cup ');
        await user.click(give);

        await waitFor(() => expect(posted).toHaveLength(1));
        expect(posted[0]).toMatchObject({
            title: 'MVP of the Cup',
            badge: 'season-mvp',
            playerId: 'p1',
            categoryId: 'cat1',
        });
        expect(await screen.findByRole('status')).toHaveTextContent('“MVP of the Cup” given to Aisha Rao.');
    });

    it('starts the form empty again for the next player', async () => {
        const user = userEvent.setup();
        renderModal();

        await user.click(await screen.findByRole('button', { name: 'Give award to Aisha Rao' }));
        await user.click(screen.getByRole('button', { name: 'Centurion' }));
        await user.click(screen.getByRole('button', { name: 'Give award to Ben Joseph' }));

        expect(screen.getByText('Ben Joseph', { selector: 'section p' })).toBeInTheDocument();
        expect(screen.getByLabelText('Award title')).toHaveValue('');
        expect(screen.getByRole('button', { name: 'Centurion' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'Give award' })).toBeDisabled();
    });

    it('shows a failed grant inside the dialog', async () => {
        const user = userEvent.setup();
        renderModal({ award: () => HttpResponse.json({ message: 'This player already has that award.' }, { status: 400 }) as Response });

        await user.click(await screen.findByRole('button', { name: 'Give award to Aisha Rao' }));
        await user.click(screen.getByRole('button', { name: 'Fair Play' }));
        await user.click(screen.getByRole('button', { name: 'Give award' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('This player already has that award.');
    });

    it('keeps the champion banner for completed categories', async () => {
        renderModal({ status: 'completed' });
        expect(await screen.findByText('Category champion')).toBeInTheDocument();
        expect(screen.getByText('3 wins · 60 points')).toBeInTheDocument();
    });
});
