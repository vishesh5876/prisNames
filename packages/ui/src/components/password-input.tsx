'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, description, error, required, id, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const inputId = id || React.useId();
    const descriptionId = description ? `${inputId}-desc` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--color-ink)] leading-[1.4]"
          >
            {label}
            {required && <span className="text-[var(--color-error-text)] ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={cn(
              'h-11 w-full rounded-[var(--radius-md)] border bg-[var(--color-canvas)] px-4 pr-11 text-base text-[var(--color-ink)]',
              'placeholder:text-[var(--color-muted)]',
              'transition-colors',
              'focus-visible:outline-none focus-visible:border-[var(--color-brand-green-dark)] focus-visible:border-2',
              'disabled:cursor-not-allowed disabled:bg-[var(--color-surface-soft)] disabled:text-[var(--color-muted)]',
              error
                ? 'border-[var(--color-error-text)] border-2'
                : 'border-[var(--color-hairline-strong)]',
              className,
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={
              [descriptionId, errorId].filter(Boolean).join(' ') || undefined
            }
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-steel)] hover:text-[var(--color-ink)] transition-colors"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {description && !error && (
          <p id={descriptionId} className="text-xs text-[var(--color-steel)]">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-[var(--color-error-text)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
