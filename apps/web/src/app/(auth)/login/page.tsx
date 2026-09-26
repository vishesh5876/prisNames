import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserServer } from '@/lib/auth-dal';
import { LoginForm } from './login-form';
import { Spinner } from '@prisnames/ui';

export const metadata: Metadata = { title: 'Sign In' };

/**
 * Login page.
 *
 * Authoritative server-side redirect:
 * - valid verified session → /dashboard
 * - valid unverified session → /verify-email
 * - no/invalid session → render login form
 */
export default async function LoginPage() {
  const user = await getCurrentUserServer();

  if (user) {
    if (!user.emailVerified) {
      redirect('/verify-email');
    }
    redirect('/dashboard');
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-medium text-[var(--color-ink)] mb-1">Welcome back</h1>
        <p className="text-sm text-[var(--color-steel)]">Sign in to your account</p>
      </div>
      <Suspense fallback={<div className="flex justify-center py-8"><Spinner /></div>}>
        <LoginForm />
      </Suspense>
    </>
  );
}
