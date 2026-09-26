'use client';

import * as React from 'react';
import { Checkbox as RadixCheckbox } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof RadixCheckbox.Root> {
  label?: string;
}

const Checkbox = React.forwardRef<React.ComponentRef<typeof RadixCheckbox.Root>, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const checkboxId = id || React.useId();
    return (
      <div className="flex items-center gap-2">
        <RadixCheckbox.Root
          ref={ref}
          id={checkboxId}
          className={cn(
            'size-4 shrink-0 rounded-[var(--radius-xs)] border border-[var(--color-hairline-strong)] bg-[var(--color-canvas)]',
            'transition-colors',
            'data-[state=checked]:bg-[var(--color-brand-green)] data-[state=checked]:border-[var(--color-brand-green)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-green-dark)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        >
          <RadixCheckbox.Indicator className="flex items-center justify-center">
            <Check className="size-3 text-[var(--color-on-primary)]" />
          </RadixCheckbox.Indicator>
        </RadixCheckbox.Root>
        {label && (
          <label htmlFor={checkboxId} className="text-sm text-[var(--color-ink)] select-none cursor-pointer">
            {label}
          </label>
        )}
      </div>
    );
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
