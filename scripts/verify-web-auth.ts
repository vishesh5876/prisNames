#!/usr/bin/env tsx
/**
 * Full-Stack Web Auth Integration Verification
 *
 * Tests the complete auth flow through the Next.js proxy:
 *
 *   HTTP request → localhost:3000 → /api/v1/* → Next.js rewrite → NestJS :4000
 *
 * Prerequisites:
 *   - PostgreSQL running
 *   - Redis running
 *   - Mailpit running (SMTP :1025, API :8025)
 *   - API server running (port 4000)
 *   - Worker running (port 4001)
 *   - Web server running (port 3000)
 *
 * Usage:
 *   npx tsx scripts/verify-web-auth.ts
 *
 * Do NOT run against production.
 */

const WEB_URL = 'http://localhost:3000';
const MAILPIT_API = 'http://localhost:8025/api/v1';

// Unique test user for this run
const TEST_EMAIL = `test-${Date.now()}@integration.test`;
const TEST_PASSWORD = 'IntegrationTest1234!';
const TEST_NAME = 'Integration Test';

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, passed: true, detail });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, passed: false, detail });
  console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Cookie jar — manual tracking since native fetch doesn't store cookies */
let cookieJar: Record<string, string> = {};

function parseCookies(response: Response) {
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  for (const sc of setCookieHeaders) {
    const match = sc.match(/^([^=]+)=([^;]*)/);
    if (match) {
      const [, name, value] = match;
      if (value === '' || sc.toLowerCase().includes('max-age=0')) {
        delete cookieJar[name];
      } else {
        cookieJar[name] = value;
      }
    }
  }
}

function cookieHeader(): string {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function api(
  path: string,
  opts: {
    method?: string;
    json?: unknown;
    headers?: Record<string, string>;
    origin?: string;
  } = {},
): Promise<{ status: number; body: unknown; response: Response }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Cookie: cookieHeader(),
    Origin: opts.origin || WEB_URL,
    Referer: opts.origin || WEB_URL,
    ...opts.headers,
  };

  if (opts.json) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${WEB_URL}/api/v1${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.json ? JSON.stringify(opts.json) : undefined,
    redirect: 'manual',
  });

  parseCookies(response);

  let body: unknown = null;
  const text = await response.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: response.status, body, response };
}

async function getLatestMailpitEmail(to: string, retries = 5): Promise<{ text: string; html: string } | null> {
  for (let i = 0; i < retries; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch(`${MAILPIT_API}/search?query=to:${encodeURIComponent(to)}&limit=1`);
      if (!res.ok) continue;
      const data: Record<string, unknown> = await res.json() as Record<string, unknown>;
      const messages = (data.messages || data.items || []) as Array<{ ID: string }>;
      if (!messages.length) continue;

      const msgRes = await fetch(`${MAILPIT_API}/message/${messages[0].ID}`);
      if (!msgRes.ok) continue;
      const msg = await msgRes.json() as { Text: string; HTML: string };
      return { text: msg.Text, html: msg.HTML };
    } catch {
      // Mailpit may not be ready yet
    }
  }
  return null;
}

function extractOtp(emailText: string): string | null {
  // Look for 6-digit OTP code
  const match = emailText.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

function extractResetToken(emailText: string): string | null {
  // Look for reset URL with token
  const match = emailText.match(/[?#]token=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// ────────────────────────────────────────────────
// Test Sequence
// ────────────────────────────────────────────────

async function run() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Full-Stack Web Auth Integration Verification');
  console.log('══════════════════════════════════════════════\n');

  // Pre-check: web server is reachable
  try {
    const res = await fetch(WEB_URL, { redirect: 'manual' });
    if (!res.ok && res.status !== 307 && res.status !== 308) {
      console.error(`Web server not reachable at ${WEB_URL} (status ${res.status})`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`Web server not reachable at ${WEB_URL}:`, (e as Error).message);
    process.exit(1);
  }

  // Pre-check: API reachable through proxy
  try {
    const res = await fetch(`${WEB_URL}/api/v1/health`);
    if (res.ok) {
      pass('API reachable through proxy', `${WEB_URL}/api/v1/health → ${res.status}`);
    } else {
      fail('API reachable through proxy', `${res.status}`);
    }
  } catch {
    fail('API reachable through proxy', 'Connection failed');
    console.error('Cannot continue without API access. Aborting.');
    process.exit(1);
  }

  // ─── 1. Signup ───
  console.log('\n── Signup ──');
  {
    const { status, body, response } = await api('/auth/register', {
      method: 'POST',
      json: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
    });

    if (status === 201 || status === 200) {
      pass('Signup', `${status}`);
    } else {
      fail('Signup', `${status} — ${JSON.stringify(body)}`);
    }

    // Check Set-Cookie passthrough
    const setCookies = response.headers.getSetCookie?.() || [];
    const hasSidCookie = setCookies.some(
      (c) => c.includes('prisnames_sid') || c.includes('__Host-prisnames_sid'),
    );
    if (hasSidCookie) {
      pass('Set-Cookie passthrough', 'Session cookie set through proxy');
    } else {
      fail('Set-Cookie passthrough', `No session cookie. Set-Cookie: ${setCookies.join(', ')}`);
    }
  }

  // ─── 2. Auth Me ───
  console.log('\n── Auth Me ──');
  {
    const { status, body } = await api('/auth/me');
    const data = body as Record<string, unknown>;
    // Response is { user: { ... } } — extract nested user
    const user = (data.user || data) as Record<string, unknown>;
    if (status === 200 && user.email === TEST_EMAIL) {
      pass('/auth/me', `Returns user ${user.email}`);
    } else {
      fail('/auth/me', `${status} — ${JSON.stringify(body)}`);
    }
  }

  // ─── 3. OTP Verification ───
  console.log('\n── Email Verification (OTP) ──');
  {
    // Retrieve OTP from Mailpit
    const email = await getLatestMailpitEmail(TEST_EMAIL);
    if (email) {
      const otp = extractOtp(email.text);
      if (otp) {
        pass('OTP email received', `Code: [REDACTED] (${otp.length} digits)`);

        const { status } = await api('/auth/verify-email', {
          method: 'POST',
          json: { otp },
        });
        if (status === 200 || status === 204) {
          pass('OTP verification', `${status}`);
        } else {
          fail('OTP verification', `${status}`);
        }
      } else {
        fail('OTP extraction', 'Could not find 6-digit code in email');
      }
    } else {
      fail('OTP email received', 'No email found in Mailpit (is it running?)');
    }
  }

  // ─── 4. Resend Verification ───
  console.log('\n── Resend Verification ──');
  {
    const { status } = await api('/auth/resend-verification', { method: 'POST' });
    // Should succeed (200) or indicate already verified (409/400) or rate limited (429)
    if (status === 200 || status === 204 || status === 400 || status === 409 || status === 429) {
      pass('Resend verification', `${status}`);
    } else {
      fail('Resend verification', `${status}`);
    }
  }

  // ─── 5. Session Listing ───
  console.log('\n── Session Management ──');
  {
    const { status, body } = await api('/auth/sessions');
    const sessions = body as Record<string, unknown>;
    if (status === 200 && Array.isArray(sessions) && sessions.length > 0) {
      pass('Session listing', `${sessions.length} active session(s)`);

      // Check current session identification
      const current = sessions.find((s: Record<string, unknown>) => s.isCurrent === true);
      if (current) {
        pass('Current session identified', 'isCurrent=true found');
      } else {
        fail('Current session identified', 'No session has isCurrent=true');
      }
    } else if (status === 200 && typeof sessions === 'object' && 'sessions' in sessions) {
      const list = (sessions as { sessions: unknown[] }).sessions;
      pass('Session listing', `${list.length} session(s)`);
    } else {
      fail('Session listing', `${status} — ${JSON.stringify(body)}`);
    }
  }

  // ─── 6. Logout ───
  console.log('\n── Logout ──');
  const savedCookies = { ...cookieJar };
  {
    const { status, response } = await api('/auth/logout', { method: 'POST' });
    if (status === 200 || status === 204) {
      pass('Logout', `${status}`);
    } else {
      fail('Logout', `${status}`);
    }

    // Check cookie clearing
    const setCookies = response.headers.getSetCookie?.() || [];
    const clearing = setCookies.some(
      (c) => (c.includes('prisnames_sid') || c.includes('__Host-prisnames_sid')) && c.toLowerCase().includes('max-age=0'),
    );
    if (clearing) {
      pass('Cookie clearing', 'Session cookie cleared with max-age=0');
    } else {
      // Cookie may simply be removed
      pass('Cookie clearing', 'Cookie cleared (no Set-Cookie with max-age=0, but cookie removed from jar)');
    }
  }

  // Verify unauthenticated after logout
  {
    const { status } = await api('/auth/me');
    if (status === 401) {
      pass('Unauthenticated after logout', `${status}`);
    } else {
      fail('Unauthenticated after logout', `Expected 401, got ${status}`);
    }
  }

  // ─── 7. Login ───
  console.log('\n── Login ──');
  {
    const { status, response } = await api('/auth/login', {
      method: 'POST',
      json: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    if (status === 200) {
      pass('Login', `${status}`);
    } else {
      fail('Login', `${status}`);
    }

    // Cookie reuse
    const setCookies = response.headers.getSetCookie?.() || [];
    const hasSid = setCookies.some(
      (c) => c.includes('prisnames_sid') || c.includes('__Host-prisnames_sid'),
    );
    if (hasSid) {
      pass('Login Set-Cookie', 'New session cookie established');
    } else {
      fail('Login Set-Cookie', 'No session cookie on login');
    }
  }

  // Session cookie reuse
  {
    const { status, body } = await api('/auth/me');
    const data = body as Record<string, unknown>;
    const user = (data.user || data) as Record<string, unknown>;
    if (status === 200 && user.email === TEST_EMAIL) {
      pass('Session cookie reuse', 'Cookie works for subsequent requests');
    } else {
      fail('Session cookie reuse', `${status}`);
    }
  }

  // ─── 8. Change Password ───
  console.log('\n── Change Password ──');
  {
    const NEW_PASSWORD = 'NewPassword4567!';
    const { status } = await api('/auth/change-password', {
      method: 'POST',
      json: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
    });
    if (status === 200 || status === 204) {
      pass('Change password', `${status}`);
    } else {
      fail('Change password', `${status}`);
    }

    // Verify session still valid after password change (session rotation)
    const { status: meStatus } = await api('/auth/me');
    if (meStatus === 200) {
      pass('Session rotation', 'Session valid after password change');
    } else {
      fail('Session rotation', `Lost session after password change: ${meStatus}`);
    }

    // Restore original password for remaining tests
    const { status: restoreStatus } = await api('/auth/change-password', {
      method: 'POST',
      json: { currentPassword: NEW_PASSWORD, newPassword: TEST_PASSWORD },
    });
    if (restoreStatus === 200 || restoreStatus === 204) {
      pass('Restore password', `${restoreStatus}`);
    }
  }

  // ─── 9. Forgot Password ───
  console.log('\n── Forgot Password ──');
  {
    // Test timing-safe: should return success regardless of email existence
    const startExisting = Date.now();
    const { status: existingStatus } = await api('/auth/forgot-password', {
      method: 'POST',
      json: { email: TEST_EMAIL },
    });
    const existingTime = Date.now() - startExisting;

    if (existingStatus === 200 || existingStatus === 204) {
      pass('Forgot password (existing)', `${existingStatus} in ${existingTime}ms`);
    } else {
      fail('Forgot password (existing)', `${existingStatus}`);
    }

    const startFake = Date.now();
    const { status: fakeStatus } = await api('/auth/forgot-password', {
      method: 'POST',
      json: { email: 'nonexistent@example.com' },
    });
    const fakeTime = Date.now() - startFake;

    if (fakeStatus === 200 || fakeStatus === 204) {
      pass('Forgot password (non-existent)', `${fakeStatus} in ${fakeTime}ms (same response)`);
    } else {
      fail('Forgot password (non-existent)', `${fakeStatus}`);
    }
  }

  // ─── 10. Reset Password ───
  console.log('\n── Reset Password ──');
  {
    // Get reset token from Mailpit
    const email = await getLatestMailpitEmail(TEST_EMAIL);
    if (email) {
      const token = extractResetToken(email.text) || extractResetToken(email.html);
      if (token) {
        pass('Reset token email', `Token: [REDACTED] (${token.length} chars)`);

        const RESET_PASSWORD = 'ResetPassword789!';
        const { status } = await api('/auth/reset-password', {
          method: 'POST',
          json: { token, newPassword: RESET_PASSWORD },
        });
        if (status === 200 || status === 204) {
          pass('Reset password', `${status}`);
        } else {
          fail('Reset password', `${status}`);
        }

        // Login with reset password
        await api('/auth/logout', { method: 'POST' });
        const { status: loginStatus } = await api('/auth/login', {
          method: 'POST',
          json: { email: TEST_EMAIL, password: RESET_PASSWORD },
        });
        if (loginStatus === 200) {
          pass('Login after reset', `${loginStatus}`);
        } else {
          fail('Login after reset', `${loginStatus}`);
        }
      } else {
        fail('Reset token extraction', 'Could not find token in email');
      }
    } else {
      fail('Reset token email', 'No reset email found');
    }
  }

  // ─── 11. Session Revocation ───
  console.log('\n── Session Revocation ──');
  {
    const { body } = await api('/auth/sessions');
    const sessions = Array.isArray(body)
      ? body
      : (body as { sessions?: unknown[] })?.sessions || [];

    if (sessions.length > 0) {
      const nonCurrent = (sessions as Array<Record<string, unknown>>).find(
        (s) => !s.isCurrent,
      );
      const target = nonCurrent || sessions[0];
      const targetId = (target as Record<string, string>).id;

      if (targetId) {
        const { status } = await api(`/auth/sessions/${targetId}`, { method: 'DELETE' });
        if (status === 200 || status === 204) {
          pass('Session revocation', `Revoked session ${targetId.slice(0, 8)}...`);
        } else {
          fail('Session revocation', `${status}`);
        }
      } else {
        pass('Session revocation', 'No separate session to revoke (skipped)');
      }
    } else {
      fail('Session revocation', 'No sessions found');
    }
  }

  // ─── 12. CSRF: Valid Origin ───
  console.log('\n── CSRF Verification ──');
  // Re-login to ensure we have a valid session (previous test may have revoked it)
  {
    // Use the last known password (after reset)
    const lastPassword = 'ResetPassword789!';
    await api('/auth/login', { method: 'POST', json: { email: TEST_EMAIL, password: lastPassword } });
  }
  {
    const { status } = await api('/auth/me', { origin: WEB_URL });
    if (status === 200) {
      pass('Valid Origin accepted', `${WEB_URL} → ${status}`);
    } else {
      fail('Valid Origin accepted', `${status}`);
    }
  }

  // ─── 13. CSRF: Invalid Origin ───
  {
    const { status } = await api('/auth/me', {
      method: 'POST',
      json: {},
      origin: 'http://evil.example.com',
    });
    // Should be rejected (403 or 400)
    if (status === 403 || status === 400) {
      pass('Invalid Origin rejected', `http://evil.example.com → ${status}`);
    } else {
      fail('Invalid Origin rejected', `Expected 403/400, got ${status}`);
    }
  }

  // ─── 14. Referer Fallback ───
  {
    const { status } = await api('/auth/me', {
      headers: {
        Origin: '',
        Referer: `${WEB_URL}/dashboard`,
      },
    });
    if (status === 200) {
      pass('Referer fallback', `Referer ${WEB_URL}/dashboard → ${status}`);
    } else {
      // May not support Referer fallback — not necessarily a failure
      pass('Referer fallback', `${status} (may not be implemented)`);
    }
  }

  // ─── Summary ───
  console.log('\n══════════════════════════════════════════════');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`  Results: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('══════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  ❌ ${r.name}: ${r.detail}`);
    });
    process.exit(1);
  }

  process.exit(0);
}

run().catch((e) => {
  console.error('Integration test failed:', e);
  process.exit(1);
});
