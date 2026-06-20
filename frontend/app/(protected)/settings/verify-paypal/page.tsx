/**
 * @fileOverview  PayPal email verification callback page.
 *                User lands here from the email link → verifies the token.
 * @stability     experimental
 */
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { verifyPaypalEmail } from '@/actions/seller-payment';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';

export default function VerifyPaypalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);

  const rawToken = searchParams.get('token') ?? '';
  const rawType = searchParams.get('type') ?? '';
  const rawId = searchParams.get('id') ?? '';

  // Client-side validation — reject obviously bad params before calling server
  const TOKEN_RE = /^[0-9a-f]{64}$/;
  const CUID_RE = /^c[a-z0-9]{24}$/;
  const isValidType = rawType === 'user' || rawType === 'company';
  const isValidToken = TOKEN_RE.test(rawToken);
  const isValidId = rawType === 'company' ? CUID_RE.test(rawId) : true;
  const paramsValid = isValidType && isValidToken && isValidId;

  const entityType = isValidType ? (rawType as 'user' | 'company') : null;

  useEffect(() => {
    if (!paramsValid || !entityType) return;

    startTransition(async () => {
      const target = entityType === 'company'
        ? { target: 'company' as const, companyId: rawId }
        : { target: 'user' as const };

      const res = await verifyPaypalEmail({ token: rawToken, ...target });
      setResult(res);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!paramsValid || !entityType) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <FiAlertCircle className="mx-auto mb-2 h-10 w-10 text-red-500" />
            <h1 className="text-xl font-semibold">Invalid Link</h1>
          </CardHeader>
          <CardContent className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            This verification link is missing required parameters or has expired.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {isPending ? (
            <>
              <FiLoader className="mx-auto mb-2 h-10 w-10 animate-spin text-blue-500" />
              <h1 className="text-xl font-semibold">Verifying…</h1>
            </>
          ) : result?.success ? (
            <>
              <FiCheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
              <h1 className="text-xl font-semibold">PayPal Email Verified!</h1>
            </>
          ) : (
            <>
              <FiAlertCircle className="mx-auto mb-2 h-10 w-10 text-red-500" />
              <h1 className="text-xl font-semibold">Verification Failed</h1>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center">
          {isPending ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Checking your verification token…
            </p>
          ) : result?.success ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">{result.success}</p>
              <Button
                onClick={() => router.push(
                  entityType === 'company'
                    ? `/companies/${encodeURIComponent(rawId)}/settings`
                    : '/settings?section=payments'
                )}
                className="w-full"
              >
                Go to Settings
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-red-600 dark:text-red-400">{result?.error ?? 'Unknown error'}</p>
              <Button variant="outline" onClick={() => router.push('/settings?section=payments')} className="w-full">
                Back to Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
