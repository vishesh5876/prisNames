import type { Metadata } from 'next';
import { ChangePasswordForm } from './change-password-form';
import { SessionList } from './session-list';

export const metadata: Metadata = { title: 'Security' };

export default function SecurityPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Security</h1>
      <div className="space-y-8">
        <ChangePasswordForm />
        <SessionList />
      </div>
    </>
  );
}
