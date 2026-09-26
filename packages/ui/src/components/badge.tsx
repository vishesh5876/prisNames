'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

// ─── Badge ──────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center font-semibold text-[13px] leading-[1.4]',
  {
    variants: {
      variant: {
        green: 'bg-[var(--color-brand-green)] text-[var(--color-on-primary)] rounded-[var(--radius-sm)] px-2 py-0.5',
        'green-soft': 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green-dark)] rounded-full px-2.5 py-1',
        purple: 'bg-[var(--color-accent-purple)] text-white rounded-[var(--radius-sm)] px-2 py-0.5',
        orange: 'bg-[var(--color-accent-orange)] text-white rounded-[var(--radius-sm)] px-2 py-0.5',
        popular: 'bg-[var(--color-teal-deep)] text-[var(--color-brand-green)] rounded-full px-2.5 py-1',
        default: 'bg-[var(--color-surface)] text-[var(--color-slate)] rounded-[var(--radius-sm)] px-2 py-0.5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// ─── StatusBadge ────────────────────────────────────────

const statusVariants = cva(
  'inline-flex items-center gap-1.5 font-semibold text-[13px] leading-[1.4] rounded-full px-2.5 py-1',
  {
    variants: {
      status: {
        active: 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green-dark)]',
        pending: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
        failed: 'bg-[var(--color-error-bg)] text-[var(--color-error-text)]',
        expired: 'bg-[var(--color-surface)] text-[var(--color-steel)]',
        suspended: 'bg-[var(--color-error-bg)] text-[var(--color-error-text)]',
        disabled: 'bg-[var(--color-surface)] text-[var(--color-muted)]',
      },
    },
    defaultVariants: {
      status: 'active',
    },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusVariants> {}

function StatusBadge({ className, status, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusVariants({ status }), className)} {...props}>
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'active' && 'bg-[var(--color-brand-green-dark)]',
          status === 'pending' && 'bg-[var(--color-warning-text)]',
          status === 'failed' && 'bg-[var(--color-error-text)]',
          status === 'expired' && 'bg-[var(--color-steel)]',
          status === 'suspended' && 'bg-[var(--color-error-text)]',
          status === 'disabled' && 'bg-[var(--color-muted)]',
        )}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

export { Badge, badgeVariants, StatusBadge, statusVariants };
