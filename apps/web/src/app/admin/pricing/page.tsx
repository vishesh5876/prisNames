import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { DollarSign } from 'lucide-react';

export const metadata: Metadata = { title: 'Pricing — Admin' };

export default function AdminPricingPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Pricing</h1>
      <EmptyState
        icon={<DollarSign className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
