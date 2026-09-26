import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Users } from 'lucide-react';

export const metadata: Metadata = { title: 'Users — Admin' };

export default function AdminUsersPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Users</h1>
      <EmptyState
        icon={<Users className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
