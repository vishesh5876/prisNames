import type { Metadata } from 'next';
import { EmptyState } from '@prisnames/ui';
import { Settings } from 'lucide-react';

export const metadata: Metadata = { title: 'Settings — Admin' };

export default function AdminSettingsPage() {
  return (
    <>
      <h1 className="text-xl font-medium text-[var(--color-ink)] mb-6">Settings</h1>
      <EmptyState
        icon={<Settings className="size-5" />}
        title="No data yet"
        description="This admin section will be available in a future phase."
      />
    </>
  );
}
