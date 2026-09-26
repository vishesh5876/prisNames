'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Globe, ArrowRightLeft, ShoppingBag, CreditCard, FileText,
  User, Shield, Menu, LogOut, LayoutDashboard,
} from 'lucide-react';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetBody, Avatar } from '@prisnames/ui';
import { useAuth } from '@/lib/auth-provider';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Domains', href: '/dashboard/domains', icon: Globe },
  { label: 'Transfers', href: '/dashboard/transfers', icon: ArrowRightLeft },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
  { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { label: 'Invoices', href: '/dashboard/invoices', icon: FileText },
  { label: 'Account', href: '/dashboard/account', icon: User },
  { label: 'Security', href: '/dashboard/security', icon: Shield },
];

interface DashboardSidebarProps {
  siteName: string;
}

function NavLink({ href, icon: Icon, label, active }: { href: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-colors ${
        active
          ? 'bg-[var(--color-surface)] text-[var(--color-ink)]'
          : 'text-[var(--color-steel)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)]'
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

export function DashboardSidebar({ siteName }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <nav className="flex flex-col gap-1" aria-label="Dashboard navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={item.label}
          active={isActive(item.href)}
        />
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] border-r border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <div className="flex items-center h-16 px-5 border-b border-[var(--color-hairline)]">
          <Link href="/" className="text-lg font-medium text-[var(--color-ink)] hover:opacity-80 transition-opacity">
            {siteName}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {sidebarContent}
        </div>
        {/* User section */}
        <div className="border-t border-[var(--color-hairline)] p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar fallback={user?.displayName || user?.email || '?'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-ink)] truncate">{user?.displayName || user?.email}</p>
              {user?.displayName && (
                <p className="text-xs text-[var(--color-steel)] truncate">{user.email}</p>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-[var(--color-steel)] hover:text-[var(--color-error-text)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <LogOut className="size-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden flex items-center h-14 px-4 border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] sticky top-0 z-40">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button className="p-2 -ml-2 rounded-[var(--radius-md)] text-[var(--color-steel)] hover:bg-[var(--color-surface)]" aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <span className="text-lg font-medium text-[var(--color-ink)]">{siteName}</span>
            </SheetHeader>
            <SheetBody>
              <div onClick={() => setMobileOpen(false)}>
                {sidebarContent}
              </div>
            </SheetBody>
          </SheetContent>
        </Sheet>
        <span className="ml-3 text-sm font-medium text-[var(--color-ink)]">
          {navItems.find((n) => isActive(n.href))?.label || 'Dashboard'}
        </span>
      </div>
    </>
  );
}
