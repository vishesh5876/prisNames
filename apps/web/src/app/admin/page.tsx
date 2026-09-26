import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Shield } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin' };

export default function AdminPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Admin Dashboard</h1>
      <EmptyState
        icon={<Shield className="size-5" />}
        title="Admin Overview"
        description="Admin dashboard metrics and tools will appear here in a future phase."
      />
    </>
  );
}
