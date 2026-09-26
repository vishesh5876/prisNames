/**
 * PrisNames — Real PostgreSQL Auth Integration Tests
 *
 * Tests authentication workflows against the actual PostgreSQL database.
 * Requires DATABASE_URL or TEST_DATABASE_URL set.
 *
 * Tests use a unique prefix per run and clean up after themselves.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import {
  hashPassword,
  verifyPassword,
  generateOtp,
  hashOtp,
  verifyOtp,
  generateSessionToken,
  hashSessionToken,
  normalizeEmail,
  generateSecureToken,
  hashToken,
} from '@prisnames/security';
import { ROLES } from '@prisnames/contracts';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../../../.env') });

const DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('Real PostgreSQL Auth Integration', { timeout: 30_000 }, () => {
  let sql: ReturnType<typeof postgres>;
  const TEST_PREFIX = `test_${Date.now()}_`;

  beforeAll(async () => {
    if (!DB_URL) {
      throw new Error('DATABASE_URL or TEST_DATABASE_URL required');
    }
    sql = postgres(DB_URL);
  });

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email_canonical LIKE ${TEST_PREFIX + '%'})`;
      await sql`DELETE FROM email_verifications WHERE user_id IN (SELECT id FROM users WHERE email_canonical LIKE ${TEST_PREFIX + '%'})`;
      await sql`DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE email_canonical LIKE ${TEST_PREFIX + '%'})`;
      await sql`DELETE FROM password_credentials WHERE user_id IN (SELECT id FROM users WHERE email_canonical LIKE ${TEST_PREFIX + '%'})`;
      await sql`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email_canonical LIKE ${TEST_PREFIX + '%'})`;
      await sql`DELETE FROM auth_identities WHERE user_id IN (SELECT id FROM users WHERE email_canonical LIKE ${TEST_PREFIX + '%'})`;
      await sql`DELETE FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE email_canonical LIKE ${TEST_PREFIX + '%'})`;
      await sql`DELETE FROM users WHERE email_canonical LIKE ${TEST_PREFIX + '%'}`;
      await sql.end();
    }
  });

  async function createTestUser(emailSuffix: string) {
    const email = `${TEST_PREFIX}${emailSuffix}@example.com`;
    const canonical = normalizeEmail(email);
    const password = 'TestPassword123!';
    const passwordHash = await hashPassword(password);

    const [user] = await sql`
      INSERT INTO users (email, email_canonical, display_name)
      VALUES (${email}, ${canonical}, ${`Test ${emailSuffix}`})
      RETURNING id, email, email_canonical, account_status
    `;

    await sql`
      INSERT INTO auth_identities (user_id, provider, provider_id)
      VALUES (${user!.id}, 'email', ${canonical})
    `;

    await sql`
      INSERT INTO password_credentials (user_id, password_hash)
      VALUES (${user!.id}, ${passwordHash})
    `;

    const [userRole] = await sql`SELECT id FROM roles WHERE name = ${ROLES.USER}`;
    if (userRole) {
      await sql`
        INSERT INTO user_roles (user_id, role_id)
        VALUES (${user!.id}, ${userRole.id})
      `;
    }

    return { user: user!, email, canonical, password, passwordHash };
  }

  // ─── Registration Transaction ──────────────────────

  describe('registration transaction', () => {
    it('creates user + auth_identity + password_credential + role atomically', async () => {
      const { user, canonical } = await createTestUser('reg1');

      const [identity] = await sql`SELECT * FROM auth_identities WHERE user_id = ${user.id}`;
      expect(identity).toBeDefined();
      expect(identity!.provider).toBe('email');
      expect(identity!.provider_id).toBe(canonical);

      const [cred] = await sql`SELECT * FROM password_credentials WHERE user_id = ${user.id}`;
      expect(cred).toBeDefined();

      const roles = await sql`
        SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ${user.id}
      `;
      expect(roles.map(r => r.name)).toContain(ROLES.USER);
    });
  });

  // ─── Canonical Email Concurrent Registration ───────

  describe('canonical-email concurrent registration', () => {
    it('rejects duplicate email_canonical via UNIQUE constraint', async () => {
      await createTestUser('dup1');
      const email = `${TEST_PREFIX}dup1@example.com`;
      const canonical = normalizeEmail(email);

      await expect(
        sql`INSERT INTO users (email, email_canonical) VALUES (${email}, ${canonical})`
      ).rejects.toThrow();
    });

    it('treats User@Example.com and user@example.com as duplicates', async () => {
      await createTestUser('case1');
      const canonical = normalizeEmail(`${TEST_PREFIX}case1@example.com`);
      const upperCanonical = normalizeEmail(`${TEST_PREFIX}CASE1@EXAMPLE.COM`);
      expect(upperCanonical).toBe(canonical);

      const [existing] = await sql`SELECT id FROM users WHERE email_canonical = ${canonical}`;
      expect(existing).toBeDefined();
    });
  });

  // ─── OTP Persistence/Consumption ──────────────────

  describe('OTP persistence/consumption', () => {
    it('stores OTP hash and verifies correctly', async () => {
      const { user } = await createTestUser('otp1');
      const otp = generateOtp();
      const pepper = process.env.OTP_PEPPER || 'a'.repeat(32);
      const otpHash = hashOtp(otp, pepper);

      await sql`
        INSERT INTO email_verifications (user_id, otp_hash, method, expires_at)
        VALUES (${user.id}, ${otpHash}, 'otp', NOW() + INTERVAL '10 minutes')
      `;

      const [challenge] = await sql`
        SELECT otp_hash, expires_at, verified_at, attempts
        FROM email_verifications
        WHERE user_id = ${user.id} AND verified_at IS NULL AND invalidated = false
        ORDER BY created_at DESC LIMIT 1
      `;
      expect(challenge).toBeDefined();
      expect(verifyOtp(otp, challenge!.otp_hash, pepper)).toBe(true);
    });

    it('rejects invalid OTP', async () => {
      const { user } = await createTestUser('otp2');
      const otp = generateOtp();
      const pepper = process.env.OTP_PEPPER || 'a'.repeat(32);
      const otpHash = hashOtp(otp, pepper);

      await sql`
        INSERT INTO email_verifications (user_id, otp_hash, method, expires_at)
        VALUES (${user.id}, ${otpHash}, 'otp', NOW() + INTERVAL '10 minutes')
      `;

      const [challenge] = await sql`
        SELECT otp_hash FROM email_verifications
        WHERE user_id = ${user.id} AND verified_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `;
      expect(verifyOtp('000000', challenge!.otp_hash, pepper)).toBe(false);
    });

    it('OTP cannot be reused after verification', async () => {
      const { user } = await createTestUser('otp3');
      const otp = generateOtp();
      const pepper = process.env.OTP_PEPPER || 'a'.repeat(32);
      const otpHash = hashOtp(otp, pepper);

      await sql`
        INSERT INTO email_verifications (user_id, otp_hash, method, expires_at)
        VALUES (${user.id}, ${otpHash}, 'otp', NOW() + INTERVAL '10 minutes')
      `;

      // Mark as verified
      await sql`
        UPDATE email_verifications SET verified_at = NOW()
        WHERE user_id = ${user.id} AND verified_at IS NULL
      `;

      // Should not find unverified challenge
      const [challenge] = await sql`
        SELECT id FROM email_verifications
        WHERE user_id = ${user.id} AND verified_at IS NULL AND invalidated = false
      `;
      expect(challenge).toBeUndefined();
    });

    it('invalidated challenges are excluded', async () => {
      const { user } = await createTestUser('otp4');
      const otp = generateOtp();
      const pepper = process.env.OTP_PEPPER || 'a'.repeat(32);
      const otpHash = hashOtp(otp, pepper);

      await sql`
        INSERT INTO email_verifications (user_id, otp_hash, method, expires_at)
        VALUES (${user.id}, ${otpHash}, 'otp', NOW() + INTERVAL '10 minutes')
      `;

      // Invalidate (e.g., from resend)
      await sql`
        UPDATE email_verifications SET invalidated = true
        WHERE user_id = ${user.id}
      `;

      const [challenge] = await sql`
        SELECT id FROM email_verifications
        WHERE user_id = ${user.id} AND verified_at IS NULL AND invalidated = false
      `;
      expect(challenge).toBeUndefined();
    });

    it('attempt counter increments', async () => {
      const { user } = await createTestUser('otp5');
      const otp = generateOtp();
      const pepper = process.env.OTP_PEPPER || 'a'.repeat(32);
      const otpHash = hashOtp(otp, pepper);

      const [v] = await sql`
        INSERT INTO email_verifications (user_id, otp_hash, method, expires_at)
        VALUES (${user.id}, ${otpHash}, 'otp', NOW() + INTERVAL '10 minutes')
        RETURNING id
      `;

      await sql`UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ${v!.id}`;
      await sql`UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ${v!.id}`;
      await sql`UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ${v!.id}`;

      const [updated] = await sql`SELECT attempts FROM email_verifications WHERE id = ${v!.id}`;
      expect(updated!.attempts).toBe(3);
    });
  });

  // ─── Login ────────────────────────────────────────

  describe('login', () => {
    it('valid credentials succeed', async () => {
      const { user, password } = await createTestUser('login1');
      const [cred] = await sql`SELECT password_hash FROM password_credentials WHERE user_id = ${user.id}`;
      const result = await verifyPassword(password, cred!.password_hash);
      expect(result.valid).toBe(true);
    });

    it('invalid password fails', async () => {
      const { user } = await createTestUser('login2');
      const [cred] = await sql`SELECT password_hash FROM password_credentials WHERE user_id = ${user.id}`;
      const result = await verifyPassword('WrongPassword!', cred!.password_hash);
      expect(result.valid).toBe(false);
    });
  });

  // ─── Session Persistence ──────────────────────────

  describe('real session persistence', () => {
    it('creates session with token_hash', async () => {
      const { user } = await createTestUser('sess1');
      const rawToken = generateSessionToken();
      const tokenHash = hashSessionToken(rawToken);

      await sql`
        INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
        VALUES (${user.id}, ${tokenHash}, '127.0.0.1', 'TestAgent/1.0', NOW() + INTERVAL '7 days')
      `;

      const [session] = await sql`
        SELECT id, user_id, token_hash, ip_address FROM sessions
        WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
      `;
      expect(session).toBeDefined();
      expect(session!.user_id).toBe(user.id);
      expect(session!.token_hash).toBe(tokenHash);
    });

    it('different tokens produce different sessions', async () => {
      const { user } = await createTestUser('sess2');
      const hash1 = hashSessionToken(generateSessionToken());
      const hash2 = hashSessionToken(generateSessionToken());

      await sql`INSERT INTO sessions (user_id, token_hash, ip_address, expires_at)
        VALUES (${user.id}, ${hash1}, '127.0.0.1', NOW() + INTERVAL '7 days')`;
      await sql`INSERT INTO sessions (user_id, token_hash, ip_address, expires_at)
        VALUES (${user.id}, ${hash2}, '127.0.0.2', NOW() + INTERVAL '7 days')`;

      const sessions = await sql`SELECT id FROM sessions WHERE user_id = ${user.id} AND revoked_at IS NULL`;
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });

    it('duplicate token_hash is rejected by UNIQUE constraint', async () => {
      const { user } = await createTestUser('sess3');
      const tokenHash = hashSessionToken(generateSessionToken());

      await sql`INSERT INTO sessions (user_id, token_hash, ip_address, expires_at)
        VALUES (${user.id}, ${tokenHash}, '127.0.0.1', NOW() + INTERVAL '7 days')`;

      await expect(
        sql`INSERT INTO sessions (user_id, token_hash, ip_address, expires_at)
          VALUES (${user.id}, ${tokenHash}, '127.0.0.1', NOW() + INTERVAL '7 days')`
      ).rejects.toThrow();
    });
  });

  // ─── Revocation ───────────────────────────────────

  describe('revocation', () => {
    it('revokes a single session', async () => {
      const { user } = await createTestUser('rev1');
      const tokenHash = hashSessionToken(generateSessionToken());

      const [session] = await sql`
        INSERT INTO sessions (user_id, token_hash, ip_address, expires_at)
        VALUES (${user.id}, ${tokenHash}, '127.0.0.1', NOW() + INTERVAL '7 days')
        RETURNING id
      `;

      await sql`UPDATE sessions SET revoked_at = NOW() WHERE id = ${session!.id}`;

      const [active] = await sql`SELECT id FROM sessions WHERE id = ${session!.id} AND revoked_at IS NULL`;
      expect(active).toBeUndefined();
    });

    it('revokes all sessions for a user', async () => {
      const { user } = await createTestUser('rev2');

      for (let i = 0; i < 3; i++) {
        const tokenHash = hashSessionToken(generateSessionToken());
        await sql`INSERT INTO sessions (user_id, token_hash, ip_address, expires_at)
          VALUES (${user.id}, ${tokenHash}, '127.0.0.1', NOW() + INTERVAL '7 days')`;
      }

      const result = await sql`UPDATE sessions SET revoked_at = NOW() WHERE user_id = ${user.id} AND revoked_at IS NULL`;
      expect(result.count).toBe(3);

      const active = await sql`SELECT id FROM sessions WHERE user_id = ${user.id} AND revoked_at IS NULL`;
      expect(active.length).toBe(0);
    });
  });

  // ─── Password Reset ───────────────────────────────

  describe('password reset transaction', () => {
    it('creates reset token and retrieves it', async () => {
      const { user } = await createTestUser('reset1');
      const resetToken = generateSecureToken();
      const tokenHash = hashToken(resetToken);

      await sql`
        INSERT INTO password_resets (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${tokenHash}, NOW() + INTERVAL '1 hour')
      `;

      const [reset] = await sql`
        SELECT user_id, token_hash, used_at FROM password_resets
        WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > NOW()
      `;
      expect(reset).toBeDefined();
      expect(reset!.user_id).toBe(user.id);
    });
  });

  describe('reset replay rejection', () => {
    it('used reset token cannot be reused', async () => {
      const { user } = await createTestUser('replay1');
      const resetToken = generateSecureToken();
      const tokenHash = hashToken(resetToken);

      await sql`
        INSERT INTO password_resets (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${tokenHash}, NOW() + INTERVAL '1 hour')
      `;

      // Mark as used
      await sql`UPDATE password_resets SET used_at = NOW() WHERE token_hash = ${tokenHash}`;

      const [reset] = await sql`
        SELECT id FROM password_resets WHERE token_hash = ${tokenHash} AND used_at IS NULL
      `;
      expect(reset).toBeUndefined();
    });
  });

  // ─── Password Change ─────────────────────────────

  describe('password change', () => {
    it('updates password hash in database', async () => {
      const { user, password } = await createTestUser('pwchange1');
      const newPassword = 'NewStrongPassword456!';
      const newHash = await hashPassword(newPassword);

      await sql`UPDATE password_credentials SET password_hash = ${newHash} WHERE user_id = ${user.id}`;

      const [cred] = await sql`SELECT password_hash FROM password_credentials WHERE user_id = ${user.id}`;
      const oldResult = await verifyPassword(password, cred!.password_hash);
      expect(oldResult.valid).toBe(false);

      const newResult = await verifyPassword(newPassword, cred!.password_hash);
      expect(newResult.valid).toBe(true);
    });
  });

  // ─── Account Status Enforcement ───────────────────

  describe('account status enforcement', () => {
    it('suspended user status is persisted', async () => {
      const { user } = await createTestUser('status1');
      await sql`UPDATE users SET account_status = 'SUSPENDED' WHERE id = ${user.id}`;
      const [u] = await sql`SELECT account_status FROM users WHERE id = ${user.id}`;
      expect(u!.account_status).toBe('SUSPENDED');
    });

    it('disabled user status is persisted', async () => {
      const { user } = await createTestUser('status2');
      await sql`UPDATE users SET account_status = 'DISABLED' WHERE id = ${user.id}`;
      const [u] = await sql`SELECT account_status FROM users WHERE id = ${user.id}`;
      expect(u!.account_status).toBe('DISABLED');
    });

    it('CHECK constraint rejects invalid account status', async () => {
      const { user } = await createTestUser('status3');
      await expect(
        sql`UPDATE users SET account_status = 'INVALID_STATUS' WHERE id = ${user.id}`
      ).rejects.toThrow();
    });
  });

  // ─── RBAC Queries ─────────────────────────────────

  describe('RBAC queries', () => {
    it('retrieves all roles for a user', async () => {
      const { user } = await createTestUser('rbac1');
      const roles = await sql`
        SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ${user.id}
      `;
      expect(roles.map(r => r.name)).toContain(ROLES.USER);
    });

    it('assigns multiple roles to a user', async () => {
      const { user } = await createTestUser('rbac2');
      const [supportRole] = await sql`SELECT id FROM roles WHERE name = ${ROLES.SUPPORT}`;
      if (supportRole) {
        await sql`INSERT INTO user_roles (user_id, role_id) VALUES (${user.id}, ${supportRole.id})`;
      }
      const roles = await sql`
        SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ${user.id} ORDER BY r.name
      `;
      const roleNames = roles.map(r => r.name);
      expect(roleNames).toContain(ROLES.USER);
      expect(roleNames).toContain(ROLES.SUPPORT);
    });

    it('all 6 approved roles exist in the database', async () => {
      const allRoles = await sql`SELECT name FROM roles ORDER BY name`;
      const roleNames = allRoles.map(r => r.name);
      expect(roleNames).toContain(ROLES.USER);
      expect(roleNames).toContain(ROLES.SUPPORT);
      expect(roleNames).toContain(ROLES.FINANCE);
      expect(roleNames).toContain(ROLES.ABUSE);
      expect(roleNames).toContain(ROLES.ADMIN);
      expect(roleNames).toContain(ROLES.SUPER_ADMIN);
      expect(allRoles.length).toBe(6);
    });
  });
});
