/**
 * Server-side API client.
 *
 * Uses API_INTERNAL_URL to call the NestJS backend directly.
 * Forwards the raw Cookie header for session validation.
 *
 * NEVER import this file in client components.
 */
import 'server-only';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:4000';

/**
 * Server-side fetch to the backend API.
 *
 * @param path - API path (e.g. '/auth/me')
 * @param cookies - Raw cookie header from the incoming request
 */
export async function apiServerFetch<T>(
  path: string,
  cookies: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Accept': 'application/json',
      'Cookie': cookies,
      ...(init?.headers as Record<string, string>),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
