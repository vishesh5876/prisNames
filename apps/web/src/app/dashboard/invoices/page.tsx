import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { FileText } from 'lucide-react';

export const metadata: Metadata = { title: 'Invoices' };

export default function InvoicesPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Invoices</h1>
      <EmptyState icon={<FileText className="size-5" />} title="No invoices" description="Your invoices will appear here." />
    </>
  );
}
