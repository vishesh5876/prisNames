'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, OtpInput, Alert } from '@prisnames/ui';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-provider';

export function VerifyEmailForm() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [otp, setOtp] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [resendSuccess, setResendSuccess] = React.useState(false);

  const handleVerify = async (code?: string) => {
    const otpValue = code || otp;
    if (otpValue.length !== 6) return;

    setError(null);
    setIsVerifying(true);
    try {
      await apiFetch('/auth/verify-email', { method: 'POST', json: { otp: otpValue } });
      refresh();
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === 'AUTH_OTP_INVALID' ? 'Invalid verification code.' :
          err.code === 'AUTH_OTP_EXPIRED' ? 'Code has expired. Please request a new one.' :
          err.code === 'AUTH_OTP_MAX_ATTEMPTS' ? 'Too many attempts. Please request a new code.' :
          'Something went wrong. Please try again.',
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResendSuccess(false);
    setIsResending(true);
    try {
      await apiFetch('/auth/resend-verification', { method: 'POST' });
      setResendSuccess(true);
      setOtp('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AUTH_OTP_COOLDOWN') {
        setError('Please wait before requesting a new code.');
      } else {
        setError('Could not resend code. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {error && <Alert variant="error" className="w-full">{error}</Alert>}
      {resendSuccess && <Alert variant="success" className="w-full">A new code has been sent.</Alert>}

      <OtpInput
        value={otp}
        onChange={setOtp}
        onComplete={(code) => handleVerify(code)}
        error={!!error}
        autoFocus
      />

      <Button
        onClick={() => handleVerify()}
        loading={isVerifying}
        disabled={otp.length !== 6}
        className="w-full"
      >
        Verify Email
      </Button>

      <button
        type="button"
        onClick={handleResend}
        disabled={isResending}
        className="text-sm text-[var(--color-brand-green-dark)] hover:underline disabled:opacity-50 disabled:no-underline"
      >
        {isResending ? 'Sending…' : 'Resend code'}
      </button>
    </div>
  );
}
