import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { CreditCard } from 'lucide-react';

export const metadata: Metadata = { title: 'Payments — Admin' };

export default function AdminPaymentsPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Payments</h1>
      <EmptyState
        icon={<CreditCard className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
