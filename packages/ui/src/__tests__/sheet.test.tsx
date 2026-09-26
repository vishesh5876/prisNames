/**
 * Sheet component behavioral tests.
 *
 * Covers: open/close, Escape key, focus management.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
} from '../components/sheet';
import { Button } from '../components/button';

function TestSheet({ side = 'right' }: { side?: 'left' | 'right' }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Sheet</Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <h2>Sheet Title</h2>
        </SheetHeader>
        <p>Sheet body content</p>
        <input data-testid="sheet-input" />
      </SheetContent>
    </Sheet>
  );
}

describe('Sheet', () => {
  it('is closed by default', () => {
    render(<TestSheet />);
    expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument();
  });

  it('opens when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    await user.click(screen.getByRole('button', { name: 'Open Sheet' }));
    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument();
    });
    expect(screen.getByText('Sheet body content')).toBeInTheDocument();
  });

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    await user.click(screen.getByRole('button', { name: 'Open Sheet' }));
    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument();
    });
  });

  it('closes when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    await user.click(screen.getByRole('button', { name: 'Open Sheet' }));
    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument();
    });
  });

  it('moves focus inside sheet on open', async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    await user.click(screen.getByRole('button', { name: 'Open Sheet' }));
    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('returns focus to trigger on close', async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    const trigger = screen.getByRole('button', { name: 'Open Sheet' });
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Sheet Title')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument();
    });

    expect(trigger).toHaveFocus();
  });

  it('has role="dialog"', async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    await user.click(screen.getByRole('button', { name: 'Open Sheet' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
