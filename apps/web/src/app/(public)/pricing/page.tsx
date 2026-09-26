import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { CreditCard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing',
  robots: { index: false, follow: false },
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[var(--container-max)] px-4 lg:px-8 py-16">
      <EmptyState
        icon={<CreditCard className="size-5" />}
        title="Pricing"
        description="Transparent pricing for all TLDs. Coming soon."
      />
    </div>
  );
}
