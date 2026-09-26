import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUserServer } from '@/lib/auth-dal';
import { VerifyEmailForm } from './verify-email-form';

export const metadata: Metadata = { title: 'Verify Email' };

/**
 * Verify-email page.
 *
 * Requires an authenticated session:
 * - no session → redirect /login
 * - valid unverified → render OTP flow
 * - already verified → redirect /dashboard
 */
export default async function VerifyEmailPage() {
  const user = await getCurrentUserServer();

  if (!user) {
    redirect('/login');
  }
  if (user.emailVerified) {
    redirect('/dashboard');
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-medium text-[var(--color-ink)] mb-1">Verify your email</h1>
        <p className="text-sm text-[var(--color-steel)]">
          We sent a 6-digit code to <span className="font-medium text-[var(--color-ink)]">{user.email}</span>
        </p>
      </div>
      <VerifyEmailForm />
    </>
  );
}
