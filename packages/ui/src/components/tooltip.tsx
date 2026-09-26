'use client';

import * as React from 'react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { cn } from '../lib/utils';

const TooltipProvider = RadixTooltip.Provider;
const Tooltip = RadixTooltip.Root;
const TooltipTrigger = RadixTooltip.Trigger;

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof RadixTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <RadixTooltip.Portal>
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-teal-deep)] px-3 py-1.5 text-xs text-[var(--color-on-dark)]',
        'shadow-[var(--shadow-card)]',
        'animate-in fade-in-0 zoom-in-95',
        className,
      )}
      {...props}
    />
  </RadixTooltip.Portal>
));
TooltipContent.displayName = 'TooltipContent';

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
