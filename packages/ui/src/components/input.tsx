'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text */
  label?: string;
  /** Helper/description text below the input */
  description?: string;
  /** Error message (also sets aria-invalid) */
  error?: string;
  /** Whether the field is required (shows indicator) */
  required?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, description, error, required, id, type = 'text', ...props }, ref) => {
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
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            'h-11 w-full rounded-[var(--radius-md)] border bg-[var(--color-canvas)] px-4 text-base text-[var(--color-ink)]',
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
Input.displayName = 'Input';

export { Input };
