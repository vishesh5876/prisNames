'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordDto } from '@prisnames/contracts';
import { Button, Input, Alert } from '@prisnames/ui';
import { apiFetch } from '@/lib/api-client';

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordDto>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordDto) => {
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', json: data });
    } catch {
      // Intentionally swallow — timing-safe response regardless of account existence
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center">
        <Alert variant="success">
          If an account exists with that email, you will receive a password reset link shortly.
        </Alert>
        <Link href="/login" className="inline-block mt-6 text-sm text-[var(--color-brand-green-dark)] font-medium hover:underline">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />

      <Button type="submit" loading={isSubmitting} className="w-full mt-2">
        Send Reset Link
      </Button>

      <p className="text-center text-sm text-[var(--color-steel)] mt-4">
        <Link href="/login" className="text-[var(--color-brand-green-dark)] font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}
