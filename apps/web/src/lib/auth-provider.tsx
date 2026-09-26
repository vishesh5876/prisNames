'use client';

/**
 * Auth state provider.
 *
 * TanStack Query is the SINGLE authoritative source of truth for /auth/me.
 * useAuth() is a thin facade around that query.
 * No independent React Context state storage.
 *
 * Server layouts pass initialData to avoid /me round-trip on hydration.
 */

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@prisnames/contracts';
import { ROLES } from '@prisnames/contracts';
import { apiFetch, ApiError } from './api-client';

// ─── Query Key ──────────────────────────────────────────

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

// ─── Types ──────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  roles: string[];
  hasRole: (role: string) => boolean;
  isStaff: boolean;
  logout: () => Promise<void>;
  refresh: () => void;
}

const STAFF_ROLES = [ROLES.SUPPORT, ROLES.FINANCE, ROLES.ABUSE, ROLES.ADMIN, ROLES.SUPER_ADMIN] as const;

// ─── Context ────────────────────────────────────────────

const AuthContext = React.createContext<AuthContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await apiFetch<{ user: AuthUser }>('/auth/me');
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          return null;
        }
        throw err;
      }
    },
    initialData: initialUser ?? undefined,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const currentUser = user ?? null;

  const logout = React.useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Logout failure is non-critical for client
    }
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    // Intentional full-page navigation to clear all client state on logout
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/login';
  }, [queryClient]);

  const refresh = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
  }, [queryClient]);

  const value = React.useMemo<AuthContextValue>(() => {
    const roles = currentUser?.roles ?? [];
    return {
      user: currentUser,
      isLoading,
      isAuthenticated: !!currentUser,
      isEmailVerified: !!currentUser?.emailVerified,
      roles,
      hasRole: (role: string) => roles.includes(role),
      isStaff: roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r)),
      logout,
      refresh,
    };
  }, [currentUser, isLoading, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
