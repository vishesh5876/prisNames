'use client';

import { useAuth } from '@/lib/auth-provider';
import { KeyValue, StatusBadge, Skeleton } from '@prisnames/ui';

export function AccountDetails() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-5 w-40" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h2 className="text-base font-medium text-[var(--color-ink)] mb-4">Profile</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <KeyValue label="Email" value={user.email} />
        <KeyValue label="Display Name" value={user.displayName || '—'} />
        <KeyValue
          label="Email Verified"
          value={
            <StatusBadge status={user.emailVerified ? 'active' : 'pending'}>
              {user.emailVerified ? 'Verified' : 'Pending'}
            </StatusBadge>
          }
        />
        <KeyValue
          label="Account Status"
          value={
            <StatusBadge status={user.accountStatus === 'active' ? 'active' : 'suspended'}>
              {user.accountStatus}
            </StatusBadge>
          }
        />
        <KeyValue label="Member Since" value={new Date(user.createdAt).toLocaleDateString()} />
        <KeyValue
          label="Roles"
          value={user.roles.join(', ')}
        />
      </dl>
    </div>
  );
}
