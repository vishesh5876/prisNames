import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = { title: 'Abuse Reports — Admin' };

export default function AdminAbusePage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Abuse Reports</h1>
      <EmptyState
        icon={<ShieldAlert className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
