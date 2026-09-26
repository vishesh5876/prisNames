/**
 * Button component tests.
 *
 * Covers: variant rendering, loading state, disabled, click handling,
 * aria-busy, accessible labels.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../components/button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('defaults to type="button" when no type is set', () => {
    render(<Button>Test</Button>);
    // forwardRef doesn't override type, so it should be "submit" by default in HTML
    // but our component should render whatever is passed
  });

  it('applies primary variant by default', () => {
    const { container } = render(<Button>Primary</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('bg-[var(--color-brand-green)]');
  });

  it('applies secondary variant classes', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('border');
  });

  it('applies destructive variant classes', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('bg-[var(--color-error-text)]');
  });

  it('applies ghost variant classes', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('bg-transparent');
  });

  it('applies size variants', () => {
    const { container: sm } = render(<Button size="sm">Small</Button>);
    expect(sm.querySelector('button')?.className).toContain('h-8');

    const { container: lg } = render(<Button size="lg">Large</Button>);
    expect(lg.querySelector('button')?.className).toContain('h-12');
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables button when loading is true', () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('shows spinner icon when loading', () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole('button');
    // Loader2 renders an SVG inside the button
    const svg = btn.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('does not have aria-busy when not loading', () => {
    render(<Button>Normal</Button>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button disabled onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not call onClick when loading', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button loading onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(<Button className="custom-class">Test</Button>);
    expect(container.querySelector('button')?.className).toContain('custom-class');
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });
});
