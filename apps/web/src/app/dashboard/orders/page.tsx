import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { ShoppingBag } from 'lucide-react';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Orders</h1>
      <EmptyState icon={<ShoppingBag className="size-5" />} title="No orders" description="Your orders will appear here." />
    </>
  );
}
