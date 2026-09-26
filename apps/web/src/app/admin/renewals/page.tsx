import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { RotateCw } from 'lucide-react';

export const metadata: Metadata = { title: 'Renewals — Admin' };

export default function AdminRenewalsPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Renewals</h1>
      <EmptyState
        icon={<RotateCw className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
