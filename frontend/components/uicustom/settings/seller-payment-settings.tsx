/**
 * @fileOverview  Seller Payment Settings — inline component for the User Settings page.
 *                Manages PayPal email (save → verify flow) and default receiving wallet.
 * @stability     experimental
 */
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useCurrentUser } from '@/hooks/use-current-user';
import { isDemoUserId } from '@/lib/demo-policy';
import { PayoutWalletPicker } from './payout-wallet-picker';
import {
  FiCheckCircle, FiAlertCircle, FiMail, FiTrash2, FiLoader,
  FiCreditCard, FiExternalLink,
} from 'react-icons/fi';
import {
  savePaypalEmail,
  removePaypalEmail,
  getSellerPaymentStatus,
  type SellerPaymentStatus,
} from '@/actions/seller-payment';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EvmWallet {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
  verifiedAt: string | null;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SellerPaymentSettings() {
  const user = useCurrentUser();
  return isDemoUserId(user?.id) ? <DemoSellerPayments /> : <EditableSellerPayments />;
}

function DemoSellerPayments() {
  return <section className="space-y-6" aria-labelledby="seller-payment-heading">
    <div className="border-b border-border pb-4">
      <h2 id="seller-payment-heading" className="text-xl font-semibold">Seller Payments</h2>
      <p className="mt-1 text-sm text-muted-foreground">Payout setup preview · no money moves in the demo.</p>
    </div>
    <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
      Use your own account to save and verify a PayPal receiving email or link a payout wallet. Demo accounts cannot change payout details.
    </p>
    <div className="space-y-2">
      <label htmlFor="demo-paypal" className="text-sm font-medium">PayPal receiving email</label>
      <Input id="demo-paypal" type="email" disabled placeholder="seller@example.com" className="min-h-11 text-base" />
      <p className="text-sm text-muted-foreground">Email verification proves access to the address. Automatic seller payouts require separate PayPal multiparty onboarding.</p>
    </div>
    <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
      <h3 className="font-medium">Verified payout wallet</h3>
      <p className="text-sm text-muted-foreground">Ownership is verified by a signed challenge, never by entering a seed phrase.</p>
      <Link href="/settings?section=wallet" className="inline-flex min-h-11 items-center text-sm text-emerald-500 underline underline-offset-4">View wallet connection options</Link>
    </div>
  </section>;
}

function EditableSellerPayments() {
  const [isPending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<SellerPaymentStatus | null>(null);
  const [wallets, setWallets] = useState<EvmWallet[]>([]);
  const [paypalInput, setPaypalInput] = useState('');
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingWallets, setIsLoadingWallets] = useState(true);
  const [walletLoadError, setWalletLoadError] = useState(false);

  // ── Fetch current status ──────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    setLoadError(null);
    try {
      const res = await getSellerPaymentStatus({ target: 'user' });
      if ('data' in res) {
        setStatus(res.data);
        setPaypalInput(res.data.paypalEmail ?? '');
      } else setLoadError(res.error);
    } catch { setLoadError('Payment settings could not load. Try again.'); }
    finally { setIsLoadingStatus(false); }
  }, []);

  const fetchWallets = useCallback(async () => {
    setIsLoadingWallets(true);
    setWalletLoadError(false);
    try {
      const res = await fetch('/api/wallets/evm');
      if (!res.ok) throw new Error('Unable to load wallets');
      const data = await res.json();
      setWallets(data.wallets ?? []);
    } catch {
      setWalletLoadError(true);
    }
    setIsLoadingWallets(false);
  }, []);

  useEffect(() => {
    void Promise.all([fetchWallets(), fetchStatus()]);
  }, [fetchStatus, fetchWallets]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const runUpdate = (action: () => Promise<{ error: string } | { success: string }>) => {
    setSaveError(null);
    startTransition(async () => {
      try {
        const res = await action();
        if ('error' in res) setSaveError(res.error);
        else { toast.success(res.success); await fetchStatus(); }
      } catch { setSaveError('Your change could not be saved. Please try again.'); }
    });
  };
  const handleSavePaypal = () => {
    if (paypalInput.trim()) runUpdate(() => savePaypalEmail({ paypalEmail: paypalInput.trim(), target: 'user' }));
  };
  const handleRemovePaypal = () => {
    if (window.confirm('Remove your PayPal receiving email? You can add it again later.'))
      runUpdate(() => removePaypalEmail({ target: 'user' }));
  };


  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoadingStatus) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16">
        <FiLoader className="h-6 w-6 animate-spin text-zinc-400" />
        <span className="text-sm text-muted-foreground">Loading payment settings…</span>
      </div>
    );
  }
  if (loadError) return <div className="space-y-4">
    <h2 className="text-xl font-semibold">Seller Payments</h2>
    <p role="alert" className="text-sm text-destructive">{loadError}</p>
    <Button className="min-h-11" onClick={() => void fetchStatus()}>Retry payment settings</Button>
  </div>;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-border dark:border-white/10 pb-4">
        <h2 className="text-xl font-semibold text-foreground dark:text-white">Seller Payments</h2>
        <p className="text-sm text-muted-foreground dark:text-white/50">
          Configure how you receive payments when selling products
        </p>
      </div>

      {/* ─── PayPal Section ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">
          PayPal Receiving Email
        </h3>
        <p className="text-sm text-muted-foreground dark:text-white/40">
          Verify the email for your seller records. Automatic PayPal seller payouts require marketplace onboarding.
        </p>

        {/* Current status badge */}
        {status?.paypalEmail && (
          <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            status.paypalEmailVerified
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }`}>
            {status.paypalEmailVerified ? (
              <FiCheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <FiAlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 break-all font-medium">{status.paypalEmail}</span>
            <span className="text-xs opacity-70">
              {status.paypalEmailVerified ? '— Verified' : '— Pending verification (check your inbox)'}
            </span>
          </div>
        )}

        {/* Input + actions */}
        <label htmlFor="seller-paypal-email" className="block text-sm font-medium">Receiving email</label>
        <form onSubmit={event => { event.preventDefault(); handleSavePaypal(); }} className="flex flex-wrap items-start gap-2">
          <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <FiMail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              type="email"
              id="seller-paypal-email" name="paypalEmail" autoComplete="email" spellCheck={false} required maxLength={254}
              placeholder="your-paypal@email.com"
              value={paypalInput}
              onChange={(e) => setPaypalInput(e.target.value)}
              className="min-h-11 pl-10 text-base"
              disabled={isPending}
            />
          </div>
          <Button
            type="submit" className="min-h-11"
            disabled={isPending || !paypalInput.trim() || paypalInput.trim() === status?.paypalEmail}
            size="sm"
          >
            {status?.paypalEmail ? 'Update & Verify' : 'Save & Verify'}
          </Button>
          {status?.paypalEmail && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemovePaypal}
              type="button" aria-label="Remove PayPal receiving email" className="size-11"
              disabled={isPending}
            >
              <FiTrash2 className="h-4 w-4" />
            </Button>
          )}
        </form>
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      </div>

      <PayoutWalletPicker target={{ target: 'user' }}
        wallets={wallets} selectedId={status?.defaultReceivingWalletId ?? null}
        selectedAddress={status?.defaultReceivingWalletAddress ?? null}
        loading={isLoadingWallets} loadError={walletLoadError} onRetry={() => void fetchWallets()}
        disabled={isPending} onChanged={fetchStatus} />

      {/* ─── Info ──────────────────────────────────────────────────────────── */}
      <details className="rounded-xl border border-border p-4 text-sm">
        <summary className="cursor-pointer rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Payment availability</summary>
        <p className="mt-2 text-muted-foreground">Checkout shows the methods available for each product. A saved email or wallet does not activate a payment method. Product-specific receiving choices take priority over defaults.</p>
      </details>
    </div>
  );
}
