import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Reset Password' };

export default function ResetPasswordPage() {
  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-medium text-[var(--color-ink)] mb-1">Set new password</h1>
        <p className="text-sm text-[var(--color-steel)]">Enter your new password below.</p>
      </div>
      <ResetPasswordForm />
    </>
  );
}
