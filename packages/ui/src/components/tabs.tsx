'use client';

import * as React from 'react';
import { Tabs as RadixTabs } from 'radix-ui';
import { cn } from '../lib/utils';

const Tabs = RadixTabs.Root;

// ─── Pill Tab List ──────────────────────────────────────

const TabsList = React.forwardRef<
  React.ComponentRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List> & { variant?: 'pill' | 'underline' }
>(({ className, variant = 'pill', ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1',
      variant === 'underline' && 'gap-0 border-b border-[var(--color-hairline)]',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger> & { variant?: 'pill' | 'underline' }
>(({ className, variant = 'pill', ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center text-sm font-medium transition-colors',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-green-dark)]',
      'disabled:pointer-events-none disabled:opacity-50',
      variant === 'pill' && [
        'rounded-full px-4 py-1.5 border border-[var(--color-hairline)] text-[var(--color-steel)]',
        'data-[state=active]:bg-[var(--color-ink)] data-[state=active]:text-[var(--color-on-dark)] data-[state=active]:border-[var(--color-ink)]',
      ].join(' '),
      variant === 'underline' && [
        'px-4 py-2.5 text-[var(--color-steel)] border-b-2 border-transparent -mb-px',
        'data-[state=active]:text-[var(--color-brand-green-dark)] data-[state=active]:border-[var(--color-brand-green-dark)]',
      ].join(' '),
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
