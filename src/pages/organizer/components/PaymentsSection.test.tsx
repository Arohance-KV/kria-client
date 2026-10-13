import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import registrationReducer from '@/store/slices/registrationSlice';
import { server } from '@/test/server';
import PaymentsSection from './PaymentsSection';

const API = 'https://api.kria.club';

const pay = (id: string, status: string, base: number, patch = {}) => ({
    _id: id, playerId: 'p1', tournamentId: 't1', categoryId: 'c1', razorpayOrderId: `order_${id}`, status,
    baseAmount: base, amount: base * 1.0472, feeBreakdown: { razorpayFee: base * 0.02, platformFee: base * 0.02, gst: base * 0.0072 },
    createdAt: '2026-10-03T10:00:00Z', ...patch,
});
const profile = (firstName: string, lastName: string) => ({ firstName, lastName, age: 25, gender: 'male', phone: '1' });

const renderSection = () => {
    const store = configureStore({
        reducer: { registration: registrationReducer },
        preloadedState: { registration: { ...registrationReducer(undefined, { type: 'init' }), categories: [{ _id: 'c1', name: "Men's Singles" }] as never } },
    });
    server.use(http.get(`${API}/registrations/tournaments/t1`, () => HttpResponse.json({
        data: [
            { _id: 'r1', playerId: 'p1', categoryId: 'c1', status: 'approved', profile: profile('Aditya', 'Rao') },
            { _id: 'r2', playerId: 'p2', categoryId: 'c1', status: 'approved', profile: profile('Sanya', 'Gupta') },
        ],
    })));
    return render(<Provider store={store}><PaymentsSection tournamentId="t1" /></Provider>);
};

describe('PaymentsSection', () => {
    it('joins player names and sums what the organizer receives', async () => {
        server.use(http.get(`${API}/payments/tournaments/t1`, () => HttpResponse.json({
            data: [
                pay('a', 'paid', 500, { registrationId: 'r1', razorpayPaymentId: 'pay_a' }),
                pay('b', 'paid', 800, { registrationId: 'r2', playerId: 'p2' }),
                pay('c', 'created', 500), // no registration yet: name comes from the player's other entry
                pay('d', 'failed', 500, { playerId: 'p404' }), // unknown player: falls back to the ID
            ],
        })));
        renderSection();

        const summary = await screen.findByRole('region', { name: 'Payment summary' });
        expect(within(summary).getByText('₹1,300')).toBeInTheDocument(); // you receive
        expect(within(summary).getByText('₹1,361.36')).toBeInTheDocument(); // players paid
        expect(within(summary).getByText('₹61.36')).toBeInTheDocument(); // fees and GST
        expect(within(summary).getByText('2')).toBeInTheDocument(); // not completed
        expect(within(summary).getByText('1 checkout started · 1 failed')).toBeInTheDocument();

        expect(await screen.findByRole('button', { name: /Sanya Gupta/ })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /Aditya Rao/ })).toHaveLength(2);
        expect(screen.getByRole('button', { name: /p404/ })).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /Sanya Gupta/ }));
        expect(screen.getByText('Gateway fee (2%)').nextSibling).toHaveTextContent('₹16');
        expect(screen.getByRole('button', { name: 'Copy order ID' })).toBeInTheDocument();
    });

    it('says the load failed instead of showing an empty list', async () => {
        server.use(http.get(`${API}/payments/tournaments/t1`, () =>
            HttpResponse.json({ message: 'Payments service is down.' }, { status: 500 })));
        renderSection();

        expect(await screen.findByText("Payments didn't load")).toBeInTheDocument();
        expect(screen.getByText('Payments service is down.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
        expect(screen.queryByText('No payments yet')).not.toBeInTheDocument();
    });
});
