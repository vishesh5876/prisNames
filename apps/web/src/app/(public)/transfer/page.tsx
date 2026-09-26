import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { ArrowRightLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Transfer',
  robots: { index: false, follow: false },
};

export default function TransferPage() {
  return (
    <div className="mx-auto max-w-[var(--container-max)] px-4 lg:px-8 py-16">
      <EmptyState
        icon={<ArrowRightLeft className="size-5" />}
        title="Domain Transfer"
        description="Transfer your domains easily. Coming soon."
      />
    </div>
  );
}
