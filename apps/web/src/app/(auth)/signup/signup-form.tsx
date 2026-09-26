'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterDto } from '@prisnames/contracts';
import { Button, Input, PasswordInput, Alert } from '@prisnames/ui';
import { apiFetch, ApiError } from '@/lib/api-client';

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterDto>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterDto) => {
    setServerError(null);
    try {
      await apiFetch('/auth/register', { method: 'POST', json: data });
      router.push('/verify-email');
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(
          err.code === 'AUTH_EMAIL_ALREADY_REGISTERED'
            ? 'An account with this email already exists.'
            : err.code === 'AUTH_RATE_LIMITED'
              ? 'Too many attempts. Please wait and try again.'
              : 'Something went wrong. Please try again.',
        );
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />

      <PasswordInput
        label="Password"
        autoComplete="new-password"
        required
        description="Must be at least 8 characters"
        error={errors.password?.message}
        {...register('password')}
      />

      <Input
        label="Display Name"
        autoComplete="name"
        error={errors.displayName?.message}
        {...register('displayName')}
      />

      <Button type="submit" loading={isSubmitting} className="w-full mt-2">
        Create Account
      </Button>

      <p className="text-center text-sm text-[var(--color-steel)] mt-4">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--color-brand-green-dark)] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
