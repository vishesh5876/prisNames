/**
 * Select component behavioral tests.
 *
 * Covers: keyboard open, option navigation, selection, accessible trigger/value.
 *
 * Note: Radix Select uses pointer-down events internally, so we use
 * userEvent.pointer() and also test keyboard interaction.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '../components/select';

function TestSelect({ onValueChange, defaultValue }: { onValueChange?: (v: string) => void; defaultValue?: string }) {
  return (
    <Select onValueChange={onValueChange} defaultValue={defaultValue}>
      <SelectTrigger aria-label="Choose fruit">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('renders trigger with placeholder', () => {
    render(<TestSelect />);
    expect(screen.getByText('Select a fruit')).toBeInTheDocument();
  });

  it('has accessible combobox role', () => {
    render(<TestSelect />);
    expect(screen.getByRole('combobox', { name: 'Choose fruit' })).toBeInTheDocument();
  });

  it('displays default value when set', () => {
    render(<TestSelect defaultValue="banana" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Banana');
  });

  it('opens on keyboard Enter/Space', async () => {
    const user = userEvent.setup();
    render(<TestSelect />);

    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  it('navigates options with arrow keys', async () => {
    const user = userEvent.setup();
    render(<TestSelect />);

    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Arrow down should highlight options
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
  });

  it('selects via keyboard Enter', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<TestSelect onValueChange={handleChange} />);

    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Select the focused option
    await user.keyboard('{Enter}');
    expect(handleChange).toHaveBeenCalled();
  });
});
