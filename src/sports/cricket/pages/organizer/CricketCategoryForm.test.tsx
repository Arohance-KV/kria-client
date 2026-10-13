import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import CricketCategoryForm from './CricketCategoryForm';

const API = 'https://api.kria.club';

describe('CricketCategoryForm', () => {
    it('lets number fields be cleared while typing and validates them on save', async () => {
        let body: Record<string, any> | null = null;
        server.use(http.post(`${API}/sports/cricket/category/`, async ({ request }) => {
            body = await request.json() as Record<string, any>;
            return HttpResponse.json({ data: { data: { _id: 'c1' } } });
        }));
        const onSuccess = vi.fn();
        render(<CricketCategoryForm tournamentId="t1" onSuccess={onSuccess} onCancel={() => {}} />);
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Category name'), 'T20 Open');
        await user.type(screen.getByLabelText('Age group label'), 'Open');
        const overs = screen.getByLabelText('Overs');
        await user.clear(overs);
        expect(overs).toHaveValue(null); // stays empty instead of snapping back to 20
        await user.click(screen.getByRole('button', { name: 'Create category' }));
        expect(screen.getByText('Enter 1 to 50 overs.')).toBeInTheDocument();
        expect(body).toBeNull();

        await user.type(overs, '10');
        await user.click(screen.getByRole('button', { name: 'Create category' }));
        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
        expect(body!.cricketConfig).toMatchObject({ overs: 10, playersPerTeam: 11 });
        expect(body!.tournamentId).toBe('t1');
    });
});
