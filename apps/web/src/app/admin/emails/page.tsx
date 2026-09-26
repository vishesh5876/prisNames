import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Mail } from 'lucide-react';

export const metadata: Metadata = { title: 'Emails — Admin' };

export default function AdminEmailsPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Emails</h1>
      <EmptyState
        icon={<Mail className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
