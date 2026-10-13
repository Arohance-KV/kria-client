import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import categoryReducer from '@/store/slices/categorySlice';
import registrationReducer from '@/store/slices/registrationSlice';
import { server } from '@/test/server';
import { SectionNavContext } from '../ui';
import CategoriesSection from './CategoriesSection';

const API = 'https://api.kria.club';
const envelope = (data: unknown) => HttpResponse.json({ data: { data } });

const cat = (patch = {}) => ({
    _id: 'c1', tournamentId: 't1', name: "Men's Singles Open", sport: 'badminton', gender: 'male',
    ageGroup: { label: 'Open' }, matchType: 'singles', matchFormat: { bestOf: 3, pointsPerGame: 21 },
    bracketType: 'knockout', isPaidRegistration: true, registrationFee: 500, maxRegistrations: 32, status: 'setup', isActive: true,
    ...patch,
});

function setup(categories: unknown[]) {
    let list = categories;
    const calls: string[] = [];
    server.use(
        http.get(`${API}/tournaments/t1/categories`, () => { calls.push('GET categories'); return envelope(list); }),
    );
    const goTo = vi.fn();
    const store = configureStore({ reducer: { category: categoryReducer, registration: registrationReducer } });
    render(
        <Provider store={store}>
            <SectionNavContext.Provider value={goTo}>
                <CategoriesSection tournamentId="t1" sports={['badminton']} />
            </SectionNavContext.Provider>
        </Provider>,
    );
    return { calls, goTo, store, setList: (l: unknown[]) => { list = l; } };
}

describe('CategoriesSection', () => {
    it('asks before the next step, then calls that step’s endpoint and refreshes the page counts', async () => {
        const { calls, store, setList } = setup([cat()]);
        let opened = false;
        server.use(http.post(`${API}/categories/c1/open-registration`, () => {
            opened = true;
            setList([cat({ status: 'registration' })]);
            return envelope(cat({ status: 'registration' }));
        }));
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Open registration' }));
        expect(opened).toBe(false); // first click only asks
        expect(screen.getByText(/Players can register for this category\./)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Yes, open registration' }));

        expect(await screen.findByRole('button', { name: 'Start auction' })).toBeInTheDocument();
        expect(opened).toBe(true);
        // The registration store (Overview counts, sidebar) is refetched too.
        await waitFor(() => expect(store.getState().registration.categories[0]?.status).toBe('registration'));
        expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    it('starts the auction with both calls', async () => {
        setup([cat({ status: 'registration' })]);
        const hits: string[] = [];
        server.use(
            http.post(`${API}/categories/c1/start-auction`, () => { hits.push('start-auction'); return envelope(cat({ status: 'auction' })); }),
            http.post(`${API}/auction/start`, async ({ request }) => { hits.push(`auction/start ${JSON.stringify(await request.json())}`); return envelope({}); }),
        );
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Start auction' }));
        await user.click(screen.getByRole('button', { name: 'Yes, start auction' }));

        await waitFor(() => expect(hits).toEqual(['start-auction', 'auction/start {"tournamentId":"t1","categoryId":"c1"}']));
    });

    it('sends auction categories to Brackets and team leagues to Team league instead of acting here', async () => {
        const { goTo } = setup([
            cat({ status: 'auction' }),
            cat({ _id: 'c2', name: 'Open Team League', bracketType: 'team_league', status: 'groups_configured', teamLeagueConfig: { subTeamSlots: [{}, {}, {}] } }),
        ]);
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Set up bracket' }));
        expect(goTo).toHaveBeenLastCalledWith('brackets');
        await user.click(screen.getByRole('button', { name: 'Manage in Team league' }));
        expect(goTo).toHaveBeenLastCalledWith('team_league');
        expect(screen.getByText(/3 sub-matches per tie/)).toBeInTheDocument();
    });

    it('shows a failed step on its row', async () => {
        setup([cat({ status: 'bracket_configured' })]);
        server.use(http.post(`${API}/categories/c1/start`, () => HttpResponse.json({ message: 'Generate the bracket first.' }, { status: 400 })));
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Start category' }));
        await user.click(screen.getByRole('button', { name: 'Yes, start category' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Generate the bracket first.');
    });

    it('deletes only after the confirm and warns when the category has results', async () => {
        const { store } = setup([cat({ status: 'ongoing' })]);
        let deleted = false;
        server.use(http.delete(`${API}/categories/c1`, () => { deleted = true; return envelope(null); }));
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: "More actions for Men's Singles Open" }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete category' }));
        expect(deleted).toBe(false);
        const bar = screen.getByRole('alertdialog', { name: 'Delete category' });
        expect(bar).toHaveTextContent("Delete Men's Singles Open? It already has matches and results. This can’t be undone.");
        await user.click(within(bar).getByRole('button', { name: 'Delete category' }));

        await waitFor(() => expect(screen.queryByText("Men's Singles Open")).not.toBeInTheDocument());
        expect(deleted).toBe(true);
        expect(store.getState().category.categories).toHaveLength(0);
    });

    it('moves a category back a stage from the dialog', async () => {
        setup([cat({ status: 'ongoing' })]);
        let body: unknown = null;
        server.use(http.post(`${API}/categories/c1/status`, async ({ request }) => {
            body = await request.json();
            return envelope(cat({ status: 'bracket_configured' }));
        }));
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: "More actions for Men's Singles Open" }));
        await user.click(await screen.findByRole('menuitem', { name: 'Move to an earlier stage…' }));
        const dialog = screen.getByRole('dialog', { name: 'Move to an earlier stage' });
        expect(within(dialog).getByRole('button', { name: 'Move' })).toBeDisabled();
        await user.click(within(dialog).getByRole('radio', { name: /Bracket ready/ }));
        await user.click(within(dialog).getByRole('button', { name: 'Move to Bracket ready' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(body).toEqual({ status: 'bracket_configured' });
        expect(await screen.findByRole('button', { name: 'Start category' })).toBeInTheDocument();
    });

    it('shows a load failure instead of the empty state', async () => {
        server.use(http.get(`${API}/tournaments/t1/categories`, () => HttpResponse.json({ message: 'Server unavailable.' }, { status: 503 })));
        const store = configureStore({ reducer: { category: categoryReducer, registration: registrationReducer } });
        render(<Provider store={store}><CategoriesSection tournamentId="t1" sports={['badminton']} /></Provider>);

        expect(await screen.findByText('Couldn’t load categories')).toBeInTheDocument();
        expect(screen.getByText('Server unavailable.')).toBeInTheDocument();
        expect(screen.queryByText('No categories yet')).not.toBeInTheDocument();
    });
});
