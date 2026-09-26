import { redirect } from 'next/navigation';
import { getSiteConfig } from '@prisnames/config';
import { ROLES } from '@prisnames/contracts';
import { getCurrentUserServer } from '@/lib/auth-dal';
import { AdminSidebar } from '@/components/layout/admin-sidebar';

const STAFF_ROLES = [ROLES.SUPPORT, ROLES.FINANCE, ROLES.ABUSE, ROLES.ADMIN, ROLES.SUPER_ADMIN] as const;

/**
 * Admin layout.
 *
 * Authoritative server-side checks:
 * - no valid session → redirect /login
 * - no staff role → redirect /dashboard
 * - valid staff session → render admin shell
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserServer();

  if (!user) {
    redirect('/login');
  }

  const isStaff = user.roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
  if (!isStaff) {
    redirect('/dashboard');
  }

  const site = getSiteConfig();

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar siteName={site.name} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
