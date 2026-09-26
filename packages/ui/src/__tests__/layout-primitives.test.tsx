/**
 * Layout primitives and Alert component tests.
 *
 * Covers: EmptyState, ErrorState, Alert rendering and accessibility.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState, ErrorState } from '../components/layout-primitives';
import { Alert } from '../components/alert';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No domains yet" />);
    expect(screen.getByText('No domains yet')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Add your first domain" />);
    expect(screen.getByText('Add your first domain')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<EmptyState title="Empty" action={<button>Add Domain</button>} />);
    expect(screen.getByRole('button', { name: 'Add Domain' })).toBeInTheDocument();
  });

  it('renders default icon when none provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders custom icon', () => {
    render(<EmptyState title="Custom" icon={<span data-testid="custom-icon">★</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders default title', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders default description', () => {
    render(<ErrorState />);
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(<ErrorState title="Connection failed" description="Check your network" />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('Check your network')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', async () => {
    const handleRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState onRetry={handleRetry} />);

    const retryBtn = screen.getByRole('button', { name: 'Try again' });
    await user.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledOnce();
  });

  it('renders custom retry label', () => {
    render(<ErrorState onRetry={() => {}} retryLabel="Reload" />);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Alert', () => {
  it('renders with role="alert"', () => {
    render(<Alert>Test alert</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(<Alert>Something happened</Alert>);
    expect(screen.getByText('Something happened')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Alert title="Warning">Details here</Alert>);
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Details here')).toBeInTheDocument();
  });

  it('applies error variant classes', () => {
    const { container } = render(<Alert variant="error">Error</Alert>);
    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl?.className).toContain('error');
  });

  it('applies success variant classes', () => {
    const { container } = render(<Alert variant="success">Success</Alert>);
    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl?.className).toContain('success');
  });

  it('defaults to info variant', () => {
    const { container } = render(<Alert>Info</Alert>);
    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl?.className).toContain('info');
  });
});
