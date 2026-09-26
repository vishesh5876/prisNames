'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

const alertStyles = {
  info: {
    container: 'bg-[var(--color-info-bg)] border-[var(--color-accent-blue)]/20 text-[var(--color-info-text)]',
    icon: Info,
  },
  success: {
    container: 'bg-[var(--color-success-bg)] border-[var(--color-brand-green-dark)]/20 text-[var(--color-success-text)]',
    icon: CheckCircle,
  },
  warning: {
    container: 'bg-[var(--color-warning-bg)] border-[var(--color-warning-text)]/20 text-[var(--color-warning-text)]',
    icon: AlertTriangle,
  },
  error: {
    container: 'bg-[var(--color-error-bg)] border-[var(--color-error-text)]/20 text-[var(--color-error-text)]',
    icon: AlertCircle,
  },
} as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof alertStyles;
  title?: string;
}

function Alert({ variant = 'info', title, children, className, ...props }: AlertProps) {
  const style = alertStyles[variant];
  const Icon = style.icon;

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-[var(--radius-md)] border p-3',
        style.container,
        className,
      )}
      {...props}
    >
      <Icon className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 text-sm">
        {title && <p className="font-medium mb-0.5">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export { Alert };
