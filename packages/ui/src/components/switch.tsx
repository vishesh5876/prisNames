'use client';

import * as React from 'react';
import { Switch as RadixSwitch } from 'radix-ui';
import { cn } from '../lib/utils';

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof RadixSwitch.Root> {
  label?: string;
}

const Switch = React.forwardRef<React.ComponentRef<typeof RadixSwitch.Root>, SwitchProps>(
  ({ className, label, id, ...props }, ref) => {
    const switchId = id || React.useId();
    return (
      <div className="flex items-center gap-2">
        <RadixSwitch.Root
          ref={ref}
          id={switchId}
          className={cn(
            'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
            'data-[state=unchecked]:bg-[var(--color-hairline-strong)]',
            'data-[state=checked]:bg-[var(--color-brand-green)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-green-dark)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        >
          <RadixSwitch.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4" />
        </RadixSwitch.Root>
        {label && (
          <label htmlFor={switchId} className="text-sm text-[var(--color-ink)] select-none cursor-pointer">
            {label}
          </label>
        )}
      </div>
    );
  },
);
Switch.displayName = 'Switch';

export { Switch };
