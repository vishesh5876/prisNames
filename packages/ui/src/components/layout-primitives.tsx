import * as React from 'react';
import { cn } from '../lib/utils';
import { PackageOpen, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── EmptyState ─────────────────────────────────────────

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)} {...props}>
      <div className="flex items-center justify-center size-12 rounded-full bg-[var(--color-surface)] text-[var(--color-steel)] mb-4">
        {icon || <PackageOpen className="size-5" />}
      </div>
      <h3 className="text-base font-medium text-[var(--color-ink)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--color-steel)] max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─── ErrorState ─────────────────────────────────────────

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)} {...props}>
      <div className="flex items-center justify-center size-12 rounded-full bg-[var(--color-error-bg)] text-[var(--color-error-text)] mb-4">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="text-base font-medium text-[var(--color-ink)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-steel)] max-w-sm mb-4">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-[var(--color-brand-green)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-deep)] transition-colors"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

// ─── Breadcrumb ─────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className} {...props}>
      <ol className="flex items-center gap-1.5 text-sm text-[var(--color-steel)]">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[var(--color-muted)]" aria-hidden="true">/</span>}
            {item.href && i < items.length - 1 ? (
              <a href={item.href} className="hover:text-[var(--color-ink)] transition-colors">
                {item.label}
              </a>
            ) : (
              <span className={i === items.length - 1 ? 'text-[var(--color-ink)] font-medium' : ''}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ─── Pagination ─────────────────────────────────────────

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <nav aria-label="Pagination" className={cn('flex items-center gap-1', className)}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] text-[var(--color-steel)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-[var(--color-muted)]">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] text-sm font-medium transition-colors',
              p === page
                ? 'bg-[var(--color-ink)] text-[var(--color-on-dark)]'
                : 'text-[var(--color-steel)] hover:bg-[var(--color-surface)]',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] text-[var(--color-steel)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

// ─── SearchInput ────────────────────────────────────────

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onSearch?: (value: string) => void;
  debounceMs?: number;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onSearch, debounceMs = 300, onChange, ...props }, ref) => {
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      if (onSearch) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => onSearch(e.target.value), debounceMs);
      }
    };

    React.useEffect(() => () => clearTimeout(timerRef.current), []);

    return (
      <input
        ref={ref}
        type="search"
        className={cn(
          'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline-strong)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-ink)]',
          'placeholder:text-[var(--color-steel)]',
          'focus-visible:outline-none focus-visible:border-[var(--color-brand-green-dark)] focus-visible:border-2 focus-visible:bg-[var(--color-canvas)]',
          className,
        )}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
SearchInput.displayName = 'SearchInput';

// ─── KeyValue ───────────────────────────────────────────

export interface KeyValueProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

function KeyValue({ label, value, className }: KeyValueProps) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <dt className="text-xs font-medium text-[var(--color-steel)] uppercase tracking-wider">{label}</dt>
      <dd className="text-sm text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

export { EmptyState, ErrorState, Breadcrumb, Pagination, SearchInput, KeyValue };
