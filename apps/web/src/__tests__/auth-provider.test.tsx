/**
 * Auth provider tests.
 *
 * Covers: AuthProvider context, useAuth hook, isStaff computation,
 * role checking, query key.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, AUTH_QUERY_KEY } from '@/lib/auth-provider';
import type { AuthUser } from '@prisnames/contracts';

function createWrapper(initialUser?: AuthUser | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={initialUser}>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

const mockUser: AuthUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['USER'],
  emailVerified: true,
  accountStatus: 'active',
};

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const queryClient = new QueryClient();
    expect(() => {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      });
    }).toThrow('useAuth must be used within AuthProvider');
  });

  it('returns unauthenticated state when no user', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(null),
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.roles).toEqual([]);
    expect(result.current.isStaff).toBe(false);
  });

  it('returns authenticated state with user', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockUser),
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isEmailVerified).toBe(true);
  });

  it('computes roles correctly', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockUser),
    });
    expect(result.current.roles).toEqual(['USER']);
    expect(result.current.hasRole('USER')).toBe(true);
    expect(result.current.hasRole('ADMIN')).toBe(false);
  });

  it('identifies staff roles', () => {
    const staffUser: AuthUser = {
      ...mockUser,
      roles: ['USER', 'SUPPORT'],
    };
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(staffUser),
    });
    expect(result.current.isStaff).toBe(true);
  });

  it('identifies admin as staff', () => {
    const adminUser: AuthUser = {
      ...mockUser,
      roles: ['USER', 'ADMIN'],
    };
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(adminUser),
    });
    expect(result.current.isStaff).toBe(true);
  });

  it('identifies super_admin as staff', () => {
    const superUser: AuthUser = {
      ...mockUser,
      roles: ['USER', 'SUPER_ADMIN'],
    };
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(superUser),
    });
    expect(result.current.isStaff).toBe(true);
  });

  it('regular user is not staff', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockUser),
    });
    expect(result.current.isStaff).toBe(false);
  });

  it('reports unverified email', () => {
    const unverified: AuthUser = {
      ...mockUser,
      emailVerified: false,
    };
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(unverified),
    });
    expect(result.current.isEmailVerified).toBe(false);
  });
});

describe('AUTH_QUERY_KEY', () => {
  it('is a stable tuple', () => {
    expect(AUTH_QUERY_KEY).toEqual(['auth', 'me']);
  });
});
