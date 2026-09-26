'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, PasswordInput, Alert } from '@prisnames/ui';
import { apiFetch, ApiError } from '@/lib/api-client';

const resetFormSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
});
type ResetFormData = z.infer<typeof resetFormSchema>;

/**
 * Reset password form.
 *
 * Token handling:
 * - Token is read from URL fragment (#token=...) or query param (?token=...)
 * - Read ONCE on mount via lazy useState initializer
 * - Stored in component-local state only
 * - Immediately cleared from browser URL via replaceState
 * - Submitted only to the reset API
 * - Cleared from component state after success/failure
 * - Cleared naturally when the component unmounts
 *
 * NEVER stored in: module globals, localStorage, sessionStorage,
 *   TanStack Query, Context, cookies, Map, or any persistent store.
 */
export function ResetPasswordForm() {
  // Component-local state: token captured once on mount, cleared after use.
  // Lazy initializer runs once — reads URL and cleans it immediately.
  const [token, setToken] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;

    let extracted: string | null = null;

    // Try fragment first (#token=...)
    const hash = window.location.hash;
    if (hash) {
      const fragParams = new URLSearchParams(hash.slice(1));
      extracted = fragParams.get('token');
    }

    // Fallback to query parameter (?token=...)
    if (!extracted) {
      const searchParams = new URLSearchParams(window.location.search);
      extracted = searchParams.get('token');
    }

    if (extracted) {
      // Immediately clear from visible URL/history
      window.history.replaceState(null, '', window.location.pathname);
    }

    return extracted;
  });

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetFormSchema),
  });

  const onSubmit = async (data: ResetFormData) => {
    if (!token) return;

    setServerError(null);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        json: { token, newPassword: data.newPassword },
      });
      // Clear token from component state after successful submission
      setToken(null);
      setSuccess(true);
    } catch (err) {
      // Clear token on error too (it may be consumed server-side)
      setToken(null);
      if (err instanceof ApiError) {
        setServerError(
          err.code === 'AUTH_TOKEN_EXPIRED' || err.code === 'AUTH_TOKEN_USED'
            ? 'This reset link has expired. Please request a new one.'
            : err.code === 'AUTH_TOKEN_INVALID'
              ? 'Invalid reset link. Please request a new one.'
              : 'Something went wrong. Please try again.',
        );
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <Alert variant="success">Your password has been reset successfully.</Alert>
        <Link href="/login" className="inline-block mt-6 text-sm text-[var(--color-brand-green-dark)] font-medium hover:underline">
          Sign in with your new password
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center">
        <Alert variant="error">No reset token found. Please request a new password reset.</Alert>
        <Link href="/forgot-password" className="inline-block mt-6 text-sm text-[var(--color-brand-green-dark)] font-medium hover:underline">
          Request new reset link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <PasswordInput
        label="New Password"
        autoComplete="new-password"
        required
        description="Must be at least 8 characters"
        error={errors.newPassword?.message}
        {...registerField('newPassword')}
      />

      <Button type="submit" loading={isSubmitting} className="w-full mt-2">
        Reset Password
      </Button>

      <p className="text-center text-sm text-[var(--color-steel)] mt-4">
        <Link href="/login" className="text-[var(--color-brand-green-dark)] font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}
