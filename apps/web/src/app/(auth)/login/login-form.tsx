'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@prisnames/contracts';
import { Button, Input, PasswordInput, Alert } from '@prisnames/ui';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-provider';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginDto) => {
    setServerError(null);
    try {
      await apiFetch('/auth/login', { method: 'POST', json: data });
      refresh();
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      router.push(redirectTo);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'AUTH_EMAIL_NOT_VERIFIED') {
          router.push('/verify-email');
          return;
        }
        setServerError(
          err.code === 'AUTH_INVALID_CREDENTIALS'
            ? 'Invalid email or password.'
            : err.code === 'AUTH_RATE_LIMITED'
              ? 'Too many attempts. Please wait and try again.'
              : err.code === 'AUTH_ACCOUNT_SUSPENDED'
                ? 'This account has been suspended.'
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
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs text-[var(--color-brand-green-dark)] hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" loading={isSubmitting} className="w-full mt-2">
        Sign In
      </Button>

      <p className="text-center text-sm text-[var(--color-steel)] mt-4">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[var(--color-brand-green-dark)] font-medium hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
