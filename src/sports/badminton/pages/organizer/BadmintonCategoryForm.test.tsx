import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import categoryReducer from '@/store/slices/categorySlice';
import { server } from '@/test/server';
import BadmintonCategoryForm from './BadmintonCategoryForm';

const API = 'https://api.kria.club';

function renderForm() {
    const onSuccess = vi.fn();
    const store = configureStore({ reducer: { category: categoryReducer } });
    render(<Provider store={store}><BadmintonCategoryForm tournamentId="t1" sport="badminton" onSuccess={onSuccess} onCancel={() => {}} /></Provider>);
    return { onSuccess };
}

describe('BadmintonCategoryForm', () => {
    it('keeps a typed slot label when the slot type changes', async () => {
        renderForm();
        const user = userEvent.setup();

        await user.click(screen.getByRole('radio', { name: /Team league/ }));
        const label1 = screen.getByLabelText('Slot 1 label');
        await user.clear(label1);
        await user.type(label1, 'Captains');
        await user.selectOptions(screen.getByLabelText('Slot 1 type'), 'doubles');
        expect(label1).toHaveValue('Captains');

        await user.click(screen.getByRole('button', { name: 'Add slot' }));
        expect(screen.getByLabelText('Slot 2 label')).toHaveValue('Singles 2');
        await user.selectOptions(screen.getByLabelText('Slot 2 type'), 'mixed_doubles');
        expect(screen.getByLabelText('Slot 2 label')).toHaveValue('Mixed doubles 2');

        await user.click(screen.getByRole('button', { name: 'Remove slot 1' }));
        expect(screen.queryByLabelText('Slot 2 label')).not.toBeInTheDocument();
    });

    it('validates ages and paid fees inline before saving', async () => {
        let posted = false;
        server.use(http.post(`${API}/tournaments/t1/categories`, () => { posted = true; return HttpResponse.json({ data: { data: {} } }); }));
        renderForm();
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Category name'), 'U-19 Singles');
        await user.type(screen.getByLabelText('Age group label'), 'Under 19');
        await user.type(screen.getByLabelText('Minimum age'), '19');
        await user.type(screen.getByLabelText('Maximum age'), '15');
        await user.click(screen.getByRole('switch', { name: /Paid registration/ }));
        await user.click(screen.getByRole('button', { name: 'Create category' }));

        expect(screen.getByText('The minimum age can’t be higher than the maximum age.')).toBeInTheDocument();
        expect(screen.getByText('Paid categories need a fee of at least ₹1.')).toBeInTheDocument();
        expect(posted).toBe(false);
    });

    it('submits on Enter and shows a save error in the form', async () => {
        let body: Record<string, unknown> = {};
        server.use(http.post(`${API}/tournaments/t1/categories`, async ({ request }) => {
            body = await request.json() as Record<string, unknown>;
            return HttpResponse.json({ message: 'A category with this name already exists.' }, { status: 409 });
        }));
        const { onSuccess } = renderForm();
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Age group label'), 'Open');
        await user.type(screen.getByLabelText('Category name'), "Men's Singles{Enter}");

        expect(await screen.findByRole('alert')).toHaveTextContent('A category with this name already exists.');
        await waitFor(() => expect(body).toMatchObject({ name: "Men's Singles", sport: 'badminton', bracketType: 'knockout', registrationFee: 0 }));
        expect(onSuccess).not.toHaveBeenCalled();
    });
});
