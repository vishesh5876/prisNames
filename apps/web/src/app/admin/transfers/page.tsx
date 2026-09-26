import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { ArrowRightLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'Transfers — Admin' };

export default function AdminTransfersPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Transfers</h1>
      <EmptyState
        icon={<ArrowRightLeft className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
