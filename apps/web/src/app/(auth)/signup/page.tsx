import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUserServer } from '@/lib/auth-dal';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Create Account' };

export default async function SignupPage() {
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
        <h1 className="text-2xl font-medium text-[var(--color-ink)] mb-1">Create your account</h1>
        <p className="text-sm text-[var(--color-steel)]">Start managing your domains today</p>
      </div>
      <SignupForm />
    </>
  );
}
