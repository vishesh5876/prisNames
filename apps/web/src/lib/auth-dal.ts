/**
 * Server-side auth Data Access Layer.
 *
 * Provides getCurrentUserServer() for authoritative session validation
 * inside server components and layouts.
 *
 * NEVER import this file in client components.
 * NEVER log, serialize, or pass the raw cookie to the client.
 * Only the safe normalized AuthUser object may cross into client hydration.
 */
import 'server-only';

import { cookies } from 'next/headers';
import type { AuthUser } from '@prisnames/contracts';
import { apiServerFetch } from './api-server';

export interface AuthMeResponse {
  user: AuthUser;
}

/**
 * Get the current authenticated user from the backend.
 *
 * - Reads the incoming HttpOnly cookie server-side
 * - Forwards it to the backend /api/v1/auth/me
 * - Returns the verified AuthUser or null
 * - NEVER exposes the raw session cookie to client components
 */
export async function getCurrentUserServer(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    if (!cookieHeader) {
      return null;
    }

    const data = await apiServerFetch<AuthMeResponse>('/auth/me', cookieHeader);
    return data.user;
  } catch {
    // Any error (401, network, etc.) means no valid session
    return null;
  }
}
