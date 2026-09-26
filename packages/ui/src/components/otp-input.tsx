'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

export interface OtpInputProps {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  autoFocus?: boolean;
}

function OtpInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  disabled,
  error,
  className,
  autoFocus,
}: OtpInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, '').slice(0, length).split('');

  const focusInput = (index: number) => {
    const el = inputRefs.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const updateValue = (newDigits: string[]) => {
    const newValue = newDigits.join('').slice(0, length);
    onChange?.(newValue);
    if (newValue.length === length) {
      onComplete?.(newValue);
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    if (!char) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    updateValue(newDigits);

    if (index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      if (digits[index]) {
        newDigits[index] = '';
        updateValue(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = '';
        updateValue(newDigits);
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    const newDigits = pasted.padEnd(length, '').split('').slice(0, length);
    // Only fill up to pasted length, leave rest empty
    for (let i = pasted.length; i < length; i++) {
      newDigits[i] = '';
    }
    updateValue(newDigits);

    const focusIndex = Math.min(pasted.length, length - 1);
    focusInput(focusIndex);
  };

  return (
    <div className={cn('flex items-center gap-2', className)} role="group" aria-label="Verification code">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          autoComplete="one-time-code"
          className={cn(
            'size-12 text-center text-lg font-medium rounded-[var(--radius-md)] border bg-[var(--color-canvas)] text-[var(--color-ink)]',
            'transition-colors',
            'focus-visible:outline-none focus-visible:border-[var(--color-brand-green-dark)] focus-visible:border-2',
            'disabled:cursor-not-allowed disabled:bg-[var(--color-surface-soft)] disabled:text-[var(--color-muted)]',
            error
              ? 'border-[var(--color-error-text)] border-2'
              : 'border-[var(--color-hairline-strong)]',
          )}
        />
      ))}
    </div>
  );
}

export { OtpInput };
