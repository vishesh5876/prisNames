/**
 * PrisNames — Auth Contracts (Zod Schemas & Types)
 *
 * Shared between frontend and backend.
 * All validation is backend-enforced regardless of frontend checks.
 */

import { z } from 'zod';

// ─── Registration ───────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
  displayName: z
    .string()
    .min(1)
    .max(100)
    .optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;

// ─── Login ──────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginDto = z.infer<typeof loginSchema>;

// ─── Email Verification ─────────────────────────────

export const verifyEmailSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;

// ─── Forgot Password ───────────────────────────────

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

// ─── Reset Password ────────────────────────────────

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

// ─── Change Password ───────────────────────────────

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

// ─── Auth Error Codes ──────────────────────────────

export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  ACCOUNT_SUSPENDED: 'AUTH_ACCOUNT_SUSPENDED',
  RATE_LIMITED: 'AUTH_RATE_LIMITED',
  OTP_EXPIRED: 'AUTH_OTP_EXPIRED',
  OTP_INVALID: 'AUTH_OTP_INVALID',
  OTP_MAX_ATTEMPTS: 'AUTH_OTP_MAX_ATTEMPTS',
  OTP_COOLDOWN: 'AUTH_OTP_COOLDOWN',
  TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  TOKEN_USED: 'AUTH_TOKEN_USED',
  EMAIL_ALREADY_REGISTERED: 'AUTH_EMAIL_ALREADY_REGISTERED',
  SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  SESSION_REVOKED: 'AUTH_SESSION_REVOKED',
  SESSION_NOT_FOUND: 'AUTH_SESSION_NOT_FOUND',
  UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  FORBIDDEN: 'AUTH_FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

// ─── Role Constants ────────────────────────────────

export const ROLES = {
  USER: 'USER',
  SUPPORT: 'SUPPORT',
  FINANCE: 'FINANCE',
  ABUSE: 'ABUSE',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * All approved roles as ordered array.
 * Order is for display/sorting purposes ONLY — NOT for authorization hierarchy.
 * Authorization is capability-based (exact role match), not numeric.
 * SUPER_ADMIN is the only centralized override (checked explicitly in RolesGuard).
 */
export const ALL_ROLES: readonly Role[] = [
  ROLES.USER,
  ROLES.SUPPORT,
  ROLES.FINANCE,
  ROLES.ABUSE,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
] as const;

// ─── API Response Types ────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  accountStatus: string;
  roles: string[];
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
