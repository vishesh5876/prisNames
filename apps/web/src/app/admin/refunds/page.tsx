import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { ReceiptText } from 'lucide-react';

export const metadata: Metadata = { title: 'Refunds — Admin' };

export default function AdminRefundsPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Refunds</h1>
      <EmptyState
        icon={<ReceiptText className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
