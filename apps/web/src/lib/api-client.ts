/**
 * Browser-side API client.
 *
 * All requests go to /api/v1/* (same-origin via Next.js rewrite).
 * Credentials included for HttpOnly session cookie.
 * No tokens in localStorage/sessionStorage.
 */

export interface ApiErrorResponse {
  code: string;
  message: string;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super(`API Error: ${code}`);
    this.name = 'ApiError';
  }
}

/**
 * Typed fetch wrapper for browser API calls.
 *
 * @param path - API path without /api/v1 prefix (e.g. '/auth/login')
 * @param init - Fetch options
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, headers: customHeaders, ...rest } = init || {};

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`/api/v1${path}`, {
    ...rest,
    credentials: 'include',
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!response.ok) {
    let code = 'UNKNOWN_ERROR';
    let requestId: string | undefined;

    try {
      const errorBody = await response.json();
      if (errorBody?.error?.code) {
        code = errorBody.error.code;
        requestId = errorBody.error.requestId;
      } else if (errorBody?.code) {
        code = errorBody.code;
      }
    } catch {
      // Response body is not JSON
    }

    throw new ApiError(response.status, code, requestId);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
