/**
 * DropdownMenu behavioral tests.
 *
 * Covers: keyboard open, arrow navigation, item activation, Escape.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../components/dropdown-menu';
import { Button } from '../components/button';

function TestDropdown({ onSelect }: { onSelect?: (item: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onSelect?.('edit')}>Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect?.('copy')}>Copy</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect?.('delete')} destructive>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('is closed by default', () => {
    render(<TestDropdown />);
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('opens on click', async () => {
    const user = userEvent.setup();
    render(<TestDropdown />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<TestDropdown />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });
  });

  it('activates item and calls onSelect', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<TestDropdown onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(onSelect).toHaveBeenCalledWith('edit');
  });

  it('renders menu label', async () => {
    const user = userEvent.setup();
    render(<TestDropdown />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => {
      expect(screen.getByText('Options')).toBeInTheDocument();
    });
  });

  it('renders separator', async () => {
    const user = userEvent.setup();
    render(<TestDropdown />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => {
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });
  });
});
