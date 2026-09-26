import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Layers } from 'lucide-react';

export const metadata: Metadata = { title: 'TLDs — Admin' };

export default function AdminTldsPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">TLDs</h1>
      <EmptyState
        icon={<Layers className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
