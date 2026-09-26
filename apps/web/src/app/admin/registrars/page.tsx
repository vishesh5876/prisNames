import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Radio } from 'lucide-react';

export const metadata: Metadata = { title: 'Registrars — Admin' };

export default function AdminRegistrarsPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Registrars</h1>
      <EmptyState
        icon={<Radio className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
