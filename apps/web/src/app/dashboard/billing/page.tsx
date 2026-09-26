import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { CreditCard } from 'lucide-react';

export const metadata: Metadata = { title: 'Billing' };

export default function BillingPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Billing</h1>
      <EmptyState icon={<CreditCard className="size-5" />} title="No billing information" description="Your payment methods and billing details will appear here." />
    </>
  );
}
