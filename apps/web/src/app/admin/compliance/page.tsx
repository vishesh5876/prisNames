import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Scale } from 'lucide-react';

export const metadata: Metadata = { title: 'Compliance — Admin' };

export default function AdminCompliancePage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Compliance</h1>
      <EmptyState
        icon={<Scale className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
