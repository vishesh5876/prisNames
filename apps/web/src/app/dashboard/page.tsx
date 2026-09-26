import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { LayoutDashboard } from 'lucide-react';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Dashboard</h1>
      <EmptyState
        icon={<LayoutDashboard className="size-5" />}
        title="Welcome to your dashboard"
        description="Your domains, orders, and account details will appear here."
      />
    </>
  );
}
