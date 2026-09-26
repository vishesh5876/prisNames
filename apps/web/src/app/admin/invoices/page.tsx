import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { FileText } from 'lucide-react';

export const metadata: Metadata = { title: 'Invoices — Admin' };

export default function AdminInvoicesPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Invoices</h1>
      <EmptyState
        icon={<FileText className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
