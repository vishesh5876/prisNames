/**
 * Next.js 16 Proxy — lightweight routing checks only.
 *
 * DOES NOT perform authoritative session validation.
 * DOES NOT fetch /auth/me.
 * Only checks if a session cookie exists for quick routing.
 *
 * Authoritative auth checks happen in:
 * - /dashboard/layout.tsx (getCurrentUserServer)
 * - /admin/layout.tsx (getCurrentUserServer + role check)
 * - Auth pages (getCurrentUserServer for redirects)
 *
 * Cookie names imported from centralized @prisnames/config.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME_DEV,
} from '@prisnames/config';

/**
 * Check if any session cookie exists (not whether it's valid).
 */
function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has(SESSION_COOKIE_NAME) ||
    request.cookies.has(SESSION_COOKIE_NAME_DEV)
  );
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Protected routes: redirect if no cookie at all ───
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname === '/verify-email'
  ) {
    if (!hasSessionCookie(request)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ─── Guest pages: NO redirect based on cookie existence ───
  // /login, /signup, /forgot-password, /reset-password are always accessible.
  // Authoritative redirect (valid session → /dashboard) happens in the page's
  // server component via getCurrentUserServer().

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/verify-email',
    '/login',
    '/signup',
  ],
};
