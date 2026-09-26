import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { ScrollText } from 'lucide-react';

export const metadata: Metadata = { title: 'Audit Logs — Admin' };

export default function AdminAuditLogsPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Audit Logs</h1>
      <EmptyState
        icon={<ScrollText className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
