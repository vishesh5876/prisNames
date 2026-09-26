'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, LogOut, ArrowLeft } from 'lucide-react';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetBody, Avatar, Badge } from '@prisnames/ui';
import { useAuth } from '@/lib/auth-provider';
import { getVisibleAdminNav } from './admin-nav-config';

interface AdminSidebarProps {
  siteName: string;
}

export function AdminSidebar({ siteName }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, roles, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const visibleSections = getVisibleAdminNav(roles);

  const isActive = (href: string) => pathname.startsWith(href);

  const navContent = (
    <nav className="flex flex-col gap-4" aria-label="Admin navigation">
      {visibleSections.map((section, i) => (
        <div key={i}>
          {section.heading && (
            <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {section.heading}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-colors ${
                    isActive(item.href)
                      ? 'bg-[var(--color-surface)] text-[var(--color-ink)]'
                      : 'text-[var(--color-steel)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)]'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] border-r border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <div className="flex items-center justify-between h-16 px-5 border-b border-[var(--color-hairline)]">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-lg font-medium text-[var(--color-ink)] hover:opacity-80 transition-opacity">
              {siteName}
            </Link>
            <Badge variant="purple">Admin</Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {navContent}
        </div>
        <div className="border-t border-[var(--color-hairline)] p-3 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--color-steel)] hover:text-[var(--color-ink)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <ArrowLeft className="size-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar fallback={user?.displayName || user?.email || '?'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-ink)] truncate">{user?.displayName || user?.email}</p>
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
            <button className="p-2 -ml-2 rounded-[var(--radius-md)] text-[var(--color-steel)] hover:bg-[var(--color-surface)]" aria-label="Open admin navigation">
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-[var(--color-ink)]">{siteName}</span>
                <Badge variant="purple">Admin</Badge>
              </div>
            </SheetHeader>
            <SheetBody>
              <div onClick={() => setMobileOpen(false)}>
                {navContent}
              </div>
            </SheetBody>
          </SheetContent>
        </Sheet>
        <span className="ml-3 text-sm font-medium text-[var(--color-ink)]">Admin</span>
      </div>
    </>
  );
}
