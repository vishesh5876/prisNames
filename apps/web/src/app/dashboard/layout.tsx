import { redirect } from 'next/navigation';
import { getSiteConfig } from '@prisnames/config';
import { getCurrentUserServer } from '@/lib/auth-dal';
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar';

/**
 * Dashboard layout.
 *
 * Authoritative server-side auth check:
 * - no valid session → redirect /login
 * - unverified session → redirect /verify-email
 * - valid verified → render dashboard
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserServer();

  if (!user) {
    redirect('/login');
  }
  if (!user.emailVerified) {
    redirect('/verify-email');
  }

  const site = getSiteConfig();

  return (
    <div className="flex min-h-dvh">
      <DashboardSidebar siteName={site.name} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
