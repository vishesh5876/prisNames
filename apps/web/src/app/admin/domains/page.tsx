import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Globe } from 'lucide-react';

export const metadata: Metadata = { title: 'Domains — Admin' };

export default function AdminDomainsPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Domains</h1>
      <EmptyState
        icon={<Globe className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
