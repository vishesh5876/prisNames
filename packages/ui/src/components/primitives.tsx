'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

// ─── Textarea ──────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, description, error, required, id, ...props }, ref) => {
    const textareaId = id || React.useId();
    const errorId = error ? `${textareaId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-[var(--color-ink)] leading-[1.4]">
            {label}
            {required && <span className="text-[var(--color-error-text)] ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'min-h-[88px] w-full rounded-[var(--radius-md)] border bg-[var(--color-canvas)] px-4 py-3 text-base text-[var(--color-ink)] resize-y',
            'placeholder:text-[var(--color-muted)]',
            'focus-visible:outline-none focus-visible:border-[var(--color-brand-green-dark)] focus-visible:border-2',
            'disabled:cursor-not-allowed disabled:bg-[var(--color-surface-soft)]',
            error ? 'border-[var(--color-error-text)] border-2' : 'border-[var(--color-hairline-strong)]',
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          {...props}
        />
        {description && !error && <p className="text-xs text-[var(--color-steel)]">{description}</p>}
        {error && <p id={errorId} className="text-xs text-[var(--color-error-text)]" role="alert">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

// ─── Separator ─────────────────────────────────────────

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

function Separator({ orientation = 'horizontal', className, ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-[var(--color-hairline)]',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}

// ─── Skeleton ──────────────────────────────────────────

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  circle?: boolean;
}

function Skeleton({ className, circle, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-[var(--color-hairline-soft)]',
        circle ? 'rounded-full' : 'rounded-[var(--radius-md)]',
        className,
      )}
      {...props}
    />
  );
}

// ─── Spinner ───────────────────────────────────────────

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <div role="status" className={cn('flex items-center justify-center', className)} {...props}>
      <Loader2
        className={cn(
          'animate-spin text-[var(--color-brand-green)]',
          size === 'sm' && 'size-4',
          size === 'md' && 'size-6',
          size === 'lg' && 'size-8',
        )}
        aria-hidden="true"
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────────

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
}

function Avatar({ src, alt, fallback, size = 'md', className, ...props }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);
  const sizeClass = size === 'sm' ? 'size-8 text-xs' : size === 'md' ? 'size-10 text-sm' : 'size-12 text-base';
  const initials = fallback?.slice(0, 2).toUpperCase() || '?';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-steel)] font-medium overflow-hidden shrink-0',
        sizeClass,
        className,
      )}
      {...props}
    >
      {src && !imgError ? (
        <img src={src} alt={alt || ''} className="size-full object-cover" onError={() => setImgError(true)} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}

export { Textarea, Separator, Skeleton, Spinner, Avatar };
