/**
 * Auth form behavioral tests.
 *
 * Tests the frontend auth forms in isolation with mocked dependencies.
 *
 * Notes:
 * - Input labels include a required "*" indicator, creating "Email*" text content
 * - Password fields are not type="text", so getByRole('textbox') won't find them
 * - We use CSS selector queries where label-based matching is ambiguous
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───────────────────────────────────────────
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockApiFetch = vi.fn();
vi.mock('@/lib/api-client', () => {
  class MockApiError extends Error {
    status: number;
    code: string;
    requestId: string;
    constructor(status: number, code: string, msg: string) {
      super(msg);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.requestId = 'test';
    }
  }
  return {
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
    ApiError: MockApiError,
  };
});

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    refresh: mockRefresh,
    logout: vi.fn(),
    roles: [],
    hasRole: () => false,
    isStaff: false,
    isEmailVerified: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Dynamic imports after mocks
const { LoginForm } = await import('@/app/(auth)/login/login-form');
const { SignupForm } = await import('@/app/(auth)/signup/signup-form');
const { ForgotPasswordForm } = await import('@/app/(auth)/forgot-password/forgot-password-form');
const { ResetPasswordForm } = await import('@/app/(auth)/reset-password/reset-password-form');
const { VerifyEmailForm } = await import('@/app/(auth)/verify-email/verify-email-form');

const apiClientModule = await import('@/lib/api-client');
const { ApiError } = apiClientModule;

beforeEach(() => {
  vi.clearAllMocks();
  mockApiFetch.mockReset();
});

/**
 * Get email input by type="email" or name="email"
 */
function getEmailInput(container: HTMLElement = document.body): HTMLInputElement {
  return container.querySelector('input[type="email"], input[name="email"]') as HTMLInputElement;
}

/**
 * Get password input by type="password" or name="password" or name="newPassword"
 */
function getPasswordInput(container: HTMLElement = document.body, name?: string): HTMLInputElement {
  if (name) return container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  return container.querySelector('input[type="password"]') as HTMLInputElement;
}

/**
 * Get input by name attribute
 */
function getInputByName(name: string, container: HTMLElement = document.body): HTMLInputElement {
  return container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

// ─── Login ─────────────────────────────────────────
describe('LoginForm', () => {
  it('renders email and password fields', () => {
    const { container } = render(<LoginForm />);
    expect(getEmailInput(container)).toBeInTheDocument();
    expect(getPasswordInput(container)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls API on valid submit', async () => {
    mockApiFetch.mockResolvedValueOnce({ user: { id: '1' } });
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);

    await user.type(getEmailInput(container), 'test@example.com');
    await user.type(getPasswordInput(container), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
        method: 'POST',
        json: expect.objectContaining({ email: 'test@example.com' }),
      }));
    });
  });

  it('shows invalid credentials error', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'bad'));
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);

    await user.type(getEmailInput(container), 'test@example.com');
    await user.type(getPasswordInput(container), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('shows rate limit error', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(429, 'AUTH_RATE_LIMITED', 'rate'));
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);

    await user.type(getEmailInput(container), 'test@example.com');
    await user.type(getPasswordInput(container), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });
  });

  it('shows suspended account error', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(403, 'AUTH_ACCOUNT_SUSPENDED', 'suspended'));
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);

    await user.type(getEmailInput(container), 'test@example.com');
    await user.type(getPasswordInput(container), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/suspended/i)).toBeInTheDocument();
    });
  });

  it('redirects to dashboard on success', async () => {
    mockApiFetch.mockResolvedValueOnce({});
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);

    await user.type(getEmailInput(container), 'test@example.com');
    await user.type(getPasswordInput(container), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('has forgot password link', () => {
    render(<LoginForm />);
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it('has create account link', () => {
    render(<LoginForm />);
    expect(screen.getByText(/create one/i)).toBeInTheDocument();
  });

  it('refreshes auth on successful login', async () => {
    mockApiFetch.mockResolvedValueOnce({});
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);

    await user.type(getEmailInput(container), 'test@example.com');
    await user.type(getPasswordInput(container), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

// ─── Signup ────────────────────────────────────────
describe('SignupForm', () => {
  it('renders email, password, and display name fields', () => {
    const { container } = render(<SignupForm />);
    expect(getEmailInput(container)).toBeInTheDocument();
    expect(getPasswordInput(container)).toBeInTheDocument();
    expect(getInputByName('displayName', container)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls API on valid submit', async () => {
    mockApiFetch.mockResolvedValueOnce({ user: { id: '1' } });
    const user = userEvent.setup();
    const { container } = render(<SignupForm />);

    await user.type(getEmailInput(container), 'test@example.com');
    await user.type(getPasswordInput(container), 'password123');
    await user.type(getInputByName('displayName', container), 'Test User');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  it('redirects to verify-email on success', async () => {
    mockApiFetch.mockResolvedValueOnce({});
    const user = userEvent.setup();
    const { container } = render(<SignupForm />);

    await user.type(getEmailInput(container), 'test@example.com');
    await user.type(getPasswordInput(container), 'password123');
    await user.type(getInputByName('displayName', container), 'Test');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/verify-email');
    }, { timeout: 3000 });
  });

  it('shows email already registered error', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(409, 'AUTH_EMAIL_ALREADY_REGISTERED', 'dup'));
    const user = userEvent.setup();
    const { container } = render(<SignupForm />);

    await user.type(getEmailInput(container), 'test@example.com');
    await user.type(getPasswordInput(container), 'password123');
    await user.type(getInputByName('displayName', container), 'Test');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

// ─── Verify Email ──────────────────────────────────
describe('VerifyEmailForm', () => {
  it('renders OTP input and verify button', () => {
    render(<VerifyEmailForm />);
    expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /verification code/i })).toBeInTheDocument();
  });

  it('verify button is disabled before full OTP entry', () => {
    render(<VerifyEmailForm />);
    expect(screen.getByRole('button', { name: /verify email/i })).toBeDisabled();
  });

  it('shows invalid OTP error', async () => {
    // onComplete auto-submits when 6 digits are entered, so the mock rejection
    // fires on the auto-submit path, not the button click.
    mockApiFetch.mockRejectedValue(new ApiError(400, 'AUTH_OTP_INVALID', 'invalid'));
    const user = userEvent.setup();
    render(<VerifyEmailForm />);

    // Type 6-digit OTP — find the first textbox and type sequentially
    const inputs = screen.getAllByRole('textbox');
    for (let i = 0; i < Math.min(6, inputs.length); i++) {
      await user.click(inputs[i]);
      await user.keyboard(String(i + 1));
    }

    // onComplete fires handleVerify, which shows the error
    await waitFor(() => {
      expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows cooldown error on resend', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(429, 'AUTH_OTP_COOLDOWN', 'wait'));
    const user = userEvent.setup();
    render(<VerifyEmailForm />);

    await user.click(screen.getByText(/resend code/i));

    await waitFor(() => {
      expect(screen.getByText(/please wait before requesting/i)).toBeInTheDocument();
    });
  });

  it('shows success on resend', async () => {
    mockApiFetch.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<VerifyEmailForm />);

    await user.click(screen.getByText(/resend code/i));

    await waitFor(() => {
      expect(screen.getByText(/new code has been sent/i)).toBeInTheDocument();
    });
  });

  it('redirects to dashboard on successful verification', async () => {
    mockApiFetch.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<VerifyEmailForm />);

    const inputs = screen.getAllByRole('textbox');
    for (let i = 0; i < Math.min(6, inputs.length); i++) {
      await user.click(inputs[i]);
      await user.keyboard(String(i + 1));
    }

    await user.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});

// ─── Forgot Password ──────────────────────────────
describe('ForgotPasswordForm', () => {
  it('renders email field and submit button', () => {
    const { container } = render(<ForgotPasswordForm />);
    expect(getEmailInput(container)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows generic success message regardless of email existence', async () => {
    mockApiFetch.mockResolvedValueOnce({});
    const user = userEvent.setup();
    const { container } = render(<ForgotPasswordForm />);

    await user.type(getEmailInput(container), 'anyone@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/password reset link/i)).toBeInTheDocument();
    });
  });

  it('shows success even on network error (timing-safe)', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    const { container } = render(<ForgotPasswordForm />);

    await user.type(getEmailInput(container), 'bad@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/password reset link/i)).toBeInTheDocument();
    });
  });
});

// ─── Reset Password ───────────────────────────────
describe('ResetPasswordForm', () => {
  it('shows no-token state when no token in URL', () => {
    window.location.hash = '';
    render(<ResetPasswordForm />);
    expect(screen.getByText(/no reset token/i)).toBeInTheDocument();
  });

  it('shows request new link when no token', () => {
    window.location.hash = '';
    render(<ResetPasswordForm />);
    expect(screen.getByText(/request new reset link/i)).toBeInTheDocument();
  });

  it('token is never stored in localStorage/sessionStorage (source verification)', async () => {
    // Read the actual source to verify no storage usage
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/(auth)/reset-password/reset-password-form.tsx'),
      'utf-8',
    );
    // Strip comments (both // and /* */) before checking
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
      .replace(/\/\/.*$/gm, '')            // line comments
      .replace(/\*[^/]*$/gm, '');          // doc comment lines starting with *
    expect(codeOnly).not.toMatch(/localStorage\s*\./);
    expect(codeOnly).not.toMatch(/sessionStorage\s*\./);
    expect(codeOnly).not.toMatch(/document\.cookie/);
    // Verify no module-level Map for token storage
    expect(codeOnly).not.toMatch(/^const\s+\w+\s*=\s*new\s+Map/m);
  });
});
