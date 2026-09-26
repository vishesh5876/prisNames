'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-semibold text-sm leading-[1.3]',
    'transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-green-dark)]',
    'disabled:pointer-events-none',
    'whitespace-nowrap',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--color-brand-green)] text-[var(--color-on-primary)]',
          'hover:bg-[var(--color-primary-deep)]',
          'active:bg-[var(--color-primary-pressed)]',
          'disabled:bg-[var(--color-hairline)] disabled:text-[var(--color-muted)]',
          'rounded-full',
        ].join(' '),
        secondary: [
          'bg-transparent text-[var(--color-ink)]',
          'border border-[var(--color-hairline-strong)]',
          'hover:bg-[var(--color-surface)]',
          'active:bg-[var(--color-surface-soft)]',
          'disabled:text-[var(--color-muted)] disabled:border-[var(--color-hairline)]',
          'rounded-full',
        ].join(' '),
        ghost: [
          'bg-transparent text-[var(--color-ink)]',
          'hover:bg-[var(--color-surface)]',
          'active:bg-[var(--color-surface-soft)]',
          'disabled:text-[var(--color-muted)]',
          'rounded-[var(--radius-md)]',
        ].join(' '),
        link: [
          'bg-transparent text-[var(--color-brand-green-dark)]',
          'hover:underline',
          'disabled:text-[var(--color-muted)]',
          'p-0 h-auto',
        ].join(' '),
        destructive: [
          'bg-[var(--color-error-text)] text-white',
          'hover:bg-[#a8293e]',
          'active:bg-[#8c2234]',
          'disabled:bg-[var(--color-hairline)] disabled:text-[var(--color-muted)]',
          'rounded-full',
        ].join(' '),
        'on-dark': [
          'bg-[var(--color-brand-green)] text-[var(--color-on-primary)]',
          'hover:bg-[var(--color-primary-deep)]',
          'active:bg-[var(--color-primary-pressed)]',
          'rounded-full',
        ].join(' '),
        'secondary-on-dark': [
          'bg-transparent text-[var(--color-on-dark)]',
          'border border-[var(--color-hairline-dark)]',
          'hover:bg-white/10',
          'rounded-full',
        ].join(' '),
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        md: 'h-10 px-[22px] [&_svg]:size-4',
        lg: 'h-12 px-7 text-base [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Show a loading spinner and disable the button */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
