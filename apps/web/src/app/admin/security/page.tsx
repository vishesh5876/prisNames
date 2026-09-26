import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Lock } from 'lucide-react';

export const metadata: Metadata = { title: 'Security — Admin' };

export default function AdminSecurityPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Security</h1>
      <EmptyState
        icon={<Lock className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
