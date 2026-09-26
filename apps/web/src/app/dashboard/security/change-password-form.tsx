'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordDto } from '@prisnames/contracts';
import { Button, PasswordInput, Alert } from '@prisnames/ui';
import { apiFetch, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';

export function ChangePasswordForm() {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordDto>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordDto) => {
    setServerError(null);
    try {
      await apiFetch('/auth/change-password', { method: 'POST', json: data });
      toast.success('Password changed successfully');
      reset();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(
          err.code === 'AUTH_INVALID_CREDENTIALS'
            ? 'Current password is incorrect.'
            : 'Something went wrong. Please try again.',
        );
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h2 className="text-base font-medium text-[var(--color-ink)] mb-4">Change Password</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-w-md" noValidate>
        {serverError && <Alert variant="error">{serverError}</Alert>}

        <PasswordInput
          label="Current Password"
          autoComplete="current-password"
          required
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />

        <PasswordInput
          label="New Password"
          autoComplete="new-password"
          required
          description="Must be at least 8 characters"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />

        <Button type="submit" loading={isSubmitting} className="w-auto self-start mt-2">
          Update Password
        </Button>
      </form>
    </div>
  );
}
