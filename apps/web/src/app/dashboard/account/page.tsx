import type { Metadata } from 'next';
import { AccountDetails } from './account-details';

export const metadata: Metadata = { title: 'Account' };

export default function AccountPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Account</h1>
      <AccountDetails />
    </>
  );
}
