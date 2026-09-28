'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CardWrapper } from '../card-wrapper';
import { MyFormSuccess } from '../../forms/form-sucess';
import { MyFormError } from '../../forms/form-error';
import { MyNewVerificationAction } from '@/actions/new-verification';
import { emailLoginTokenAction } from '@/actions/email-login-token';

/** @fileOverview Single-use email verification with predictable same-tab completion. @stability stable */
export const MyNewVerificationForm = () => {
  const token = useSearchParams().get('token');
  const started = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    // Defer until after StrictMode's setup/cleanup check, without consuming twice.
    const timer = window.setTimeout(async () => {
      if (started.current) return;
      started.current = true;
      if (!token) {
        setError('This verification link is missing its token. Sign in to request a new email.');
        setBusy(false);
        return;
      }
      try {
        const result = await MyNewVerificationAction(token);
        if ('error' in result) {
          setError(result.error);
          return;
        }
        setSuccess(result.success);
        if ('loginToken' in result && result.loginToken && result.email) {
          const login = await emailLoginTokenAction(result.email, result.loginToken);
          if (login.success && login.redirectUrl) {
            window.location.replace(login.redirectUrl);
            return;
          }
          setSuccess('Email verified! You can now sign in.');
        }
      } catch {
        setError('Verification is temporarily unavailable. Please try again shortly.');
      } finally {
        setBusy(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [token]);

  return (
    <CardWrapper headerLabel="Confirm your email" backButtonLabel="Back to sign in" backButtonHref="/auth/login">
      <div className="space-y-4" aria-live="polite" aria-busy={busy}>
        {busy && <p className="text-sm text-muted-foreground">Verifying your email securely…</p>}
        {success && <MyFormSuccess message={success} />}
        {error && <MyFormError message={error} />}
      </div>
    </CardWrapper>
  );
};
