'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button, Sheet, SheetTrigger, SheetContent, SheetBody } from '@prisnames/ui';
import { useAuth } from '@/lib/auth-provider';

interface HeaderProps {
  siteName: string;
}

const publicNavItems = [
  { label: 'Domains', href: '/domains' },
  { label: 'Transfer', href: '/transfer' },
  { label: 'WHOIS', href: '/whois' },
  { label: 'Pricing', href: '/pricing' },
];

export function Header({ siteName }: HeaderProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-canvas)] border-b border-[var(--color-hairline)]">
      <div className="mx-auto flex h-16 max-w-[var(--container-max)] items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="text-lg font-medium text-[var(--color-ink)] hover:opacity-80 transition-opacity">
          {siteName}
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {publicNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-colors ${
                pathname === item.href
                  ? 'text-[var(--color-ink)] bg-[var(--color-surface)]'
                  : 'text-[var(--color-steel)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="primary" size="sm">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-[var(--color-steel)] hover:text-[var(--color-ink)] transition-colors px-3 py-2">
                Sign In
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              className="md:hidden p-2 rounded-[var(--radius-md)] text-[var(--color-steel)] hover:bg-[var(--color-surface)] transition-colors"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetBody>
              <nav className="flex flex-col gap-1 pt-8" aria-label="Mobile navigation">
                {publicNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2.5 text-sm font-medium rounded-[var(--radius-md)] transition-colors ${
                      pathname === item.href
                        ? 'text-[var(--color-ink)] bg-[var(--color-surface)]'
                        : 'text-[var(--color-steel)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="border-t border-[var(--color-hairline)] mt-3 pt-3 flex flex-col gap-2">
                  {isAuthenticated ? (
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                      <Button variant="primary" className="w-full">Dashboard</Button>
                    </Link>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setMobileOpen(false)}>
                        <Button variant="secondary" className="w-full">Sign In</Button>
                      </Link>
                      <Link href="/signup" onClick={() => setMobileOpen(false)}>
                        <Button variant="primary" className="w-full">Get Started</Button>
                      </Link>
                    </>
                  )}
                </div>
              </nav>
            </SheetBody>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
