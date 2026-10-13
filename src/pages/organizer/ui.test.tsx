import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, Drawer } from './ui';

describe('overlays', () => {
    it('Escape closes only the topmost overlay and page scroll resumes after the last one', async () => {
        const closeDrawer = vi.fn();
        const closeDialog = vi.fn();
        // As in the app: the drawer is open, then something inside it opens a dialog.
        const { rerender } = render(<Drawer title="Team" onClose={closeDrawer}><p>Body</p></Drawer>);
        rerender(
            <Drawer title="Team" onClose={closeDrawer}>
                <p>Body</p>
                <Dialog title="Confirm" onClose={closeDialog}><button>Inner</button></Dialog>
            </Drawer>,
        );
        expect(document.body.style.overflow).toBe('hidden');

        await userEvent.keyboard('{Escape}');
        expect(closeDialog).toHaveBeenCalledTimes(1);
        expect(closeDrawer).not.toHaveBeenCalled();

        rerender(<Drawer title="Team" onClose={closeDrawer}><p>Body</p></Drawer>);
        expect(document.body.style.overflow).toBe('hidden'); // drawer still open
        await userEvent.keyboard('{Escape}');
        expect(closeDrawer).toHaveBeenCalledTimes(1);

        rerender(<></>);
        expect(document.body.style.overflow).toBe('');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
