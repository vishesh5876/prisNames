/**
 * Input component tests.
 *
 * Covers: labels, errors, description, aria attributes,
 * required indicator, disabled state.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../components/input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders with text type by default', () => {
    render(<Input label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('type', 'text');
  });

  it('renders with custom type', () => {
    render(<Input label="Email" type="email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  });

  it('shows required asterisk', () => {
    render(<Input label="Name" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows description text', () => {
    render(<Input label="Username" description="Choose wisely" />);
    expect(screen.getByText('Choose wisely')).toBeInTheDocument();
  });

  it('hides description when error is present', () => {
    render(<Input label="Username" description="Choose wisely" error="Already taken" />);
    expect(screen.queryByText('Choose wisely')).not.toBeInTheDocument();
    expect(screen.getByText('Already taken')).toBeInTheDocument();
  });

  it('shows error with role="alert"', () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
  });

  it('sets aria-invalid on error', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid without error', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('associates error with aria-describedby', () => {
    render(<Input label="Name" error="Required field" />);
    const input = screen.getByLabelText('Name');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = screen.getByRole('alert');
    expect(describedBy).toContain(errorEl.id);
  });

  it('renders disabled state', () => {
    render(<Input label="Name" disabled />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });
});
