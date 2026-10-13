import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/slices/authSlice';
import tournamentReducer from '@/store/slices/tournamentSlice';
import { server } from '@/test/server';
import OrganizerHomePage from './OrganizerHomePage';

const URL = 'https://api.kria.club/tournament/organizer/my-tournaments';

const t = (_id: string, name: string, status: string) => ({
    _id, name, status, sport: 'badminton', startDate: '2026-09-22', endDate: '2026-09-23',
    registrationDeadline: '2026-09-20', venue: { name: 'Arena', city: 'Bangalore' },
});

const renderPage = () => {
    const store = configureStore({
        reducer: { auth: authReducer, tournament: tournamentReducer },
        preloadedState: { auth: { ...authReducer(undefined, { type: 'init' }), user: { firstName: 'Rohan' } as never } },
    });
    return render(
        <Provider store={store}>
            <MemoryRouter><OrganizerHomePage /></MemoryRouter>
        </Provider>,
    );
};

describe('OrganizerHomePage', () => {
    it('counts, filters and links tournaments', async () => {
        server.use(http.get(URL, () => HttpResponse.json({ data: [
            t('a1', 'Monsoon Smash', 'registration_closed'),
            t('d1', 'Junior Series', 'draft'),
            t('c1', 'JBN Cup', 'completed'),
        ] })));
        renderPage();

        const row = await screen.findByRole('link', { name: /Monsoon Smash/ });
        expect(row).toHaveAttribute('href', '/organizer/tournament/a1');
        // registration_closed counts as active, matching the server's stat.
        expect(screen.getByRole('button', { name: /Active events/ })).toHaveTextContent('1');
        expect(screen.getByRole('button', { name: /Total tournaments/ })).toHaveTextContent('3');

        await userEvent.click(screen.getByRole('button', { name: 'Drafts' }));
        expect(screen.getByRole('button', { name: 'Drafts' })).toHaveAttribute('aria-pressed', 'true');
        const list = screen.getByRole('list');
        expect(within(list).getAllByRole('link')).toHaveLength(1);
        expect(within(list).getByText('Junior Series')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Completed' }));
        await userEvent.type(screen.getByRole('searchbox'), 'nothing-matches');
        await userEvent.click(screen.getByRole('button', { name: 'Show all tournaments' }));
        expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(3);
    });

    it('offers to create the first tournament when there are none', async () => {
        server.use(http.get(URL, () => HttpResponse.json({ data: [] })));
        renderPage();
        expect(await screen.findByRole('link', { name: 'Create your first tournament' }))
            .toHaveAttribute('href', '/organizer/tournament/create');
    });

    it('shows the error and retries', async () => {
        let calls = 0;
        server.use(http.get(URL, () => (++calls === 1
            ? HttpResponse.json({ message: 'Server unavailable' }, { status: 500 })
            : HttpResponse.json({ data: [t('a1', 'Monsoon Smash', 'ongoing')] }))));
        renderPage();

        expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByRole('link', { name: /Monsoon Smash/ })).toBeInTheDocument();
    });
});
