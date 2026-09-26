import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'WHOIS',
  robots: { index: false, follow: false },
};

export default function WhoisPage() {
  return (
    <div className="mx-auto max-w-[var(--container-max)] px-4 lg:px-8 py-16">
      <EmptyState
        icon={<Search className="size-5" />}
        title="WHOIS Lookup"
        description="Look up domain registration information. Coming soon."
      />
    </div>
  );
}
