/**
 * PasswordInput component tests.
 *
 * Covers: visibility toggle, masked/visible, labels, errors,
 * description, aria attributes, accessible toggle.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '../components/password-input';

describe('PasswordInput', () => {
  it('renders with password type by default', () => {
    render(<PasswordInput label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('toggles visibility when eye button is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" />);
    const input = screen.getByLabelText('Password');

    // Initially masked
    expect(input).toHaveAttribute('type', 'password');

    // Click "Show password" button
    const toggleBtn = screen.getByRole('button', { name: 'Show password' });
    await user.click(toggleBtn);

    // Now visible
    expect(input).toHaveAttribute('type', 'text');

    // Toggle label changes
    const hideBtn = screen.getByRole('button', { name: 'Hide password' });
    await user.click(hideBtn);

    // Back to masked
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders label text', () => {
    render(<PasswordInput label="New Password" />);
    expect(screen.getByText('New Password')).toBeInTheDocument();
  });

  it('shows required asterisk when required', () => {
    render(<PasswordInput label="Password" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows description when provided and no error', () => {
    render(<PasswordInput label="Password" description="Must be 8+ chars" />);
    expect(screen.getByText('Must be 8+ chars')).toBeInTheDocument();
  });

  it('hides description when error is shown', () => {
    render(<PasswordInput label="Password" description="Must be 8+ chars" error="Too short" />);
    expect(screen.queryByText('Must be 8+ chars')).not.toBeInTheDocument();
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });

  it('shows error with role="alert"', () => {
    render(<PasswordInput label="Password" error="Invalid password" />);
    const errorEl = screen.getByRole('alert');
    expect(errorEl).toHaveTextContent('Invalid password');
  });

  it('sets aria-invalid when error is present', () => {
    render(<PasswordInput label="Password" error="Required" />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when no error', () => {
    render(<PasswordInput label="Password" />);
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid');
  });

  it('associates input with error via aria-describedby', () => {
    render(<PasswordInput label="Password" error="Too weak" />);
    const input = screen.getByLabelText('Password');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    // The error element should have the referenced ID
    const errorEl = screen.getByRole('alert');
    expect(describedBy).toContain(errorEl.id);
  });
});
