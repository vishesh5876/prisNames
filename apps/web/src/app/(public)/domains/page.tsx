import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Globe } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Domains',
  robots: { index: false, follow: false },
};

export default function DomainsPage() {
  return (
    <div className="mx-auto max-w-[var(--container-max)] px-4 lg:px-8 py-16">
      <EmptyState
        icon={<Globe className="size-5" />}
        title="Domain Search"
        description="Search for your perfect domain name. Coming soon."
      />
    </div>
  );
}
