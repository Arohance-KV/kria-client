import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { addDays, format } from 'date-fns';
import authReducer from '@/store/slices/authSlice';
import tournamentReducer from '@/store/slices/tournamentSlice';
import { sportRegistry } from '@/sports/registry';
import { server } from '@/test/server';
import CreateTournamentPage from './CreateTournamentPage';

const API = 'https://api.kria.club';
const CREATE = `${API}/tournament`;
const REVERSE = 'https://nominatim.openstreetmap.org/reverse';

// Leaflet can't lay out in happy-dom; the test drives the map's click handler directly.
const map = vi.hoisted(() => ({ click: (_e: { latlng: { lat: number; lng: number } }) => {} }));
vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TileLayer: () => null,
    Marker: () => null,
    useMapEvents: (h: typeof map) => { map.click = h.click; return { invalidateSize() {}, flyTo() {}, getZoom: () => 4 }; },
}));

sportRegistry.register({ sportKey: 'badminton', displayName: 'Badminton' });
sportRegistry.register({ sportKey: 'cricket', displayName: 'Cricket' });

const day = (n: number) => format(addDays(new Date(), n), 'yyyy-MM-dd');

const Opened = () => <p>Opened {useParams().id}</p>;

const renderPage = () => {
    const store = configureStore({
        reducer: { auth: authReducer, tournament: tournamentReducer },
        preloadedState: { auth: { ...authReducer(undefined, { type: 'init' }), user: { firstName: 'Rohan' } as never } },
    });
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={['/organizer/tournament/create']}>
                <Routes>
                    <Route path="/organizer/tournament/create" element={<CreateTournamentPage />} />
                    <Route path="/organizer/tournament/:id" element={<Opened />} />
                    <Route path="/organizer/home" element={<p>Dashboard</p>} />
                </Routes>
            </MemoryRouter>
        </Provider>,
    );
    return userEvent.setup();
};

const field = (label: string) => screen.getByLabelText(label);
const setDate = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const create = () => screen.getByRole('button', { name: 'Create tournament' });

/** Fills every required field; pass city '' to leave it for the map. */
const fillRequired = async (user: ReturnType<typeof userEvent.setup>, city = 'Bengaluru') => {
    await user.type(field('Tournament name'), 'Monsoon Smash');
    setDate('Start date', day(10));
    setDate('End date', day(11));
    setDate('Registration deadline', day(5));
    await user.type(field('Venue name'), 'Koramangala Indoor Stadium');
    if (city) await user.type(field('City'), city);
};

/** Captures the create request body and answers with the new tournament. */
const captureCreate = () => {
    const sent: Record<string, any>[] = [];
    server.use(http.post(CREATE, async ({ request }) => {
        sent.push(await request.json() as Record<string, any>);
        return HttpResponse.json({ data: { _id: 'new1', name: 'Monsoon Smash', status: 'draft' } }, { status: 201 });
    }));
    return sent;
};

describe('CreateTournamentPage', () => {
    it('shows an error under each empty required field, sends nothing and focuses the first one', async () => {
        const sent = captureCreate();
        const user = renderPage();

        expect(screen.queryByText('Give the tournament a name.')).not.toBeInTheDocument();
        await user.click(screen.getByRole('checkbox', { name: 'Badminton' }));
        await user.clear(field('Maximum teams'));
        await user.clear(field('Auction budget per team'));
        await user.click(create());

        for (const msg of ['Give the tournament a name.', 'Choose at least one sport.', 'Choose a start date.', 'Choose an end date.',
            'Choose a deadline.', 'Enter the venue name.', 'Enter the city.', 'At least 2 teams.', 'Use a whole number of rupees.']) {
            expect(screen.getByText(msg)).toBeInTheDocument();
        }
        expect(screen.getByText('Fix 9 fields to create the tournament.')).toBeInTheDocument();
        expect(field('Tournament name')).toHaveFocus();
        expect(sent).toHaveLength(0);

        // Errors clear as the fields are fixed.
        await user.type(field('Tournament name'), 'Monsoon Smash');
        expect(screen.queryByText('Give the tournament a name.')).not.toBeInTheDocument();
        expect(screen.getByText('Fix 8 fields to create the tournament.')).toBeInTheDocument();
    });

    it('applies the date rules', async () => {
        const user = renderPage();
        await user.click(create());

        setDate('Start date', day(0));
        expect(screen.getByText('The start date must be after today.')).toBeInTheDocument();

        setDate('Start date', day(10));
        setDate('End date', day(9));
        setDate('Registration deadline', day(11));
        expect(screen.getByText("The end date can't be before the start.")).toBeInTheDocument();
        expect(screen.getByText('Registration must close on or before the start date.')).toBeInTheDocument();

        // Same-day end and a deadline on the start day are both allowed.
        setDate('End date', day(10));
        setDate('Registration deadline', day(10));
        expect(screen.queryByText("The end date can't be before the start.")).not.toBeInTheDocument();
        expect(screen.queryByText('Registration must close on or before the start date.')).not.toBeInTheDocument();
        expect(screen.getByText(/play runs .* \(1 day\)/)).toBeInTheDocument();
    });

    it('sends no coordinates without a pin, numbers for the settings, and opens the new tournament', async () => {
        const sent = captureCreate();
        const user = renderPage();
        await fillRequired(user);
        await user.click(create());

        expect(await screen.findByText('Opened new1')).toBeInTheDocument();
        expect(sent).toHaveLength(1);
        expect(sent[0].venue).toEqual({ name: 'Koramangala Indoor Stadium', city: 'Bengaluru', address: '' });
        expect(sent[0]).toMatchObject({
            name: 'Monsoon Smash', sports: ['badminton'], startDate: day(10), endDate: day(11), registrationDeadline: day(5),
            settings: { maxTeams: 8, defaultBudget: 100000, auctionType: 'manual', allowLateRegistration: false, allowMultiCategoryRegistration: true },
        });
    });

    it('sends the pin as numbers and keeps map-filled city in step when the pin moves', async () => {
        const sent = captureCreate();
        server.use(http.get(REVERSE, ({ request }) => HttpResponse.json(new URL(request.url).searchParams.get('lat') === '12.9'
            ? { display_name: 'Koramangala, Bengaluru', address: { city: 'Bengaluru' } }
            : { display_name: 'Yelahanka, Bengaluru North', address: { town: 'Yelahanka' } })));
        const user = renderPage();
        await user.type(field('Full address'), 'Gate 2, Arena Road');

        act(() => map.click({ latlng: { lat: 12.9, lng: 77.6 } }));
        await waitFor(() => expect(field('City')).toHaveValue('Bengaluru'));
        act(() => map.click({ latlng: { lat: 13.1, lng: 77.5 } }));
        await waitFor(() => expect(field('City')).toHaveValue('Yelahanka'));
        // Typed by the organizer, so the map leaves it alone.
        expect(field('Full address')).toHaveValue('Gate 2, Arena Road');
        expect(screen.getByText('13.100000, 77.500000')).toBeInTheDocument();

        await fillRequired(user, '');
        await user.click(create());
        await screen.findByText('Opened new1');
        expect(sent[0].venue).toMatchObject({ city: 'Yelahanka', address: 'Gate 2, Arena Road', coordinates: { lat: 13.1, lng: 77.5 } });
    });

    it("shows the server's message when the create fails", async () => {
        server.use(http.post(CREATE, () => HttpResponse.json({ message: 'Insufficient permissions.' }, { status: 403 })));
        const user = renderPage();
        await fillRequired(user);
        await user.click(create());

        expect(await screen.findByText("Couldn't create the tournament: Insufficient permissions.")).toBeInTheDocument();
        expect(create()).toBeEnabled();
    });

    it('disables the button while creating so it can only be sent once', async () => {
        let release!: () => void;
        let calls = 0;
        server.use(http.post(CREATE, async () => {
            calls++;
            await new Promise<void>(r => { release = r; });
            return HttpResponse.json({ data: { _id: 'new1' } }, { status: 201 });
        }));
        const user = renderPage();
        await fillRequired(user);
        await user.click(create());

        const busy = await screen.findByRole('button', { name: 'Creating…' });
        expect(busy).toBeDisabled();
        fireEvent.submit(busy.closest('form')!);
        await waitFor(() => expect(calls).toBe(1));
        release();
        expect(await screen.findByText('Opened new1')).toBeInTheDocument();
        expect(calls).toBe(1);
    });

    it('asks before discarding a filled-in form', async () => {
        const user = renderPage();
        await user.type(field('Tournament name'), 'Monsoon Smash');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.getByText(/Discard this tournament\?/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Keep editing' }));
        expect(field('Tournament name')).toHaveValue('Monsoon Smash');

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        await user.click(screen.getByRole('button', { name: 'Discard' }));
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('leaves straight away when nothing was filled in', async () => {
        const user = renderPage();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('checks the banner type and size before uploading', async () => {
        let uploads = 0;
        server.use(http.post(`${API}/upload/image`, () => {
            uploads++;
            return HttpResponse.json({ data: { url: 'data:image/png;base64,iVBORw0KGgo=' } });
        }));
        renderPage();
        const user = userEvent.setup({ applyAccept: false });
        const input = field('Banner image');

        await user.upload(input, new File(['x'], 'notes.txt', { type: 'text/plain' }));
        expect(screen.getByText('Use a PNG, JPG or GIF image.')).toBeInTheDocument();

        const big = new File(['x'], 'huge.png', { type: 'image/png' });
        Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
        await user.upload(input, big);
        expect(screen.getByText('That image is over 5 MB. Choose a smaller one.')).toBeInTheDocument();
        expect(uploads).toBe(0);

        await user.upload(input, new File(['x'], 'banner.png', { type: 'image/png' }));
        expect(await screen.findByRole('img', { name: 'Banner preview' })).toBeInTheDocument();
        expect(uploads).toBe(1);
        expect(screen.queryByText('That image is over 5 MB. Choose a smaller one.')).not.toBeInTheDocument();
    });
});
