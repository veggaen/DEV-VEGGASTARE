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
import {
  FiCheckCircle, FiAlertCircle, FiMail, FiTrash2, FiLoader,
  FiCreditCard, FiExternalLink,
} from 'react-icons/fi';
import {
  savePaypalEmail,
  removePaypalEmail,
  setDefaultReceivingWallet,
  removeDefaultReceivingWallet,
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
    try {
      const res = await fetch('/api/wallets/evm');
      if (res.ok) {
        const data = await res.json();
        setWallets(data.wallets ?? []);
      }
    } catch {
      // silently fail — wallets section just shows empty
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

  const handleSetDefaultWallet = (walletId: string) => {
    runUpdate(() => setDefaultReceivingWallet({ walletId, target: 'user' }));
  };

  const handleRemoveDefaultWallet = () => {
    if (window.confirm('Remove your default payout wallet? Its verified link will stay saved.'))
      runUpdate(() => removeDefaultReceivingWallet({ target: 'user' }));
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

  const verifiedWallets = wallets.filter((w) => w.verifiedAt);

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
          Save the PayPal email you want associated with seller records. Direct seller-routed PayPal payouts require
          PayPal multiparty onboarding; until then, checkout can use the platform PayPal merchant app when it is configured.
        </p>

        {/* Current status badge */}
        {status?.paypalEmail && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            status.paypalEmailVerified
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }`}>
            {status.paypalEmailVerified ? (
              <FiCheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <FiAlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">{status.paypalEmail}</span>
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

      {/* ─── Default Receiving Wallet ──────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">
          Default Receiving Wallet
        </h3>
        <p className="text-sm text-muted-foreground dark:text-white/40">
          Choose which verified wallet should receive crypto payments by default.
          You can override this per-product.
        </p>

        {/* Current selection */}
        {status?.defaultReceivingWalletAddress && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <FiCreditCard className="h-4 w-4 shrink-0" />
            <span className="font-mono text-xs">
              {status.defaultReceivingWalletAddress.slice(0, 6)}…{status.defaultReceivingWalletAddress.slice(-4)}
            </span>
            <span className="text-xs opacity-70">— Default receiving wallet</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
              onClick={handleRemoveDefaultWallet}
              disabled={isPending}
            >
              Remove
            </Button>
          </div>
        )}

        {/* Wallet list */}
        {isLoadingWallets ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <FiLoader className="h-4 w-4 animate-spin" />
            Loading wallets…
          </div>
        ) : verifiedWallets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-white/10 p-6 text-center">
            <FiCreditCard className="mx-auto mb-2 h-8 w-8 text-zinc-400 dark:text-white/30" />
            <p className="text-sm text-zinc-500 dark:text-white/40">
              No verified wallets yet. Connect and sign a wallet in{' '}
              <Link href="/settings?section=wallet" className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700 dark:text-emerald-400">
                Web3 & Wallet
              </Link>{' '}
              . The first verified wallet is now used automatically for new product sales.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {verifiedWallets.map((w) => {
              const isSelected = status?.defaultReceivingWalletId === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => !isSelected && handleSetDefaultWallet(w.id)}
                  disabled={isPending || isSelected}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5 ring-2 ring-emerald-500/30'
                      : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-white dark:bg-white/5'
                  }`}
                >
                  <FiCreditCard className={`h-5 w-5 shrink-0 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground dark:text-white/90">{w.label}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground dark:text-white/40">
                      {w.address}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Info ──────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border dark:border-white/10 bg-zinc-50 dark:bg-white/2 p-4">
        <h3 className="text-sm font-medium text-foreground dark:text-white/80 mb-2">How it works</h3>
        <ul className="space-y-1 text-sm text-muted-foreground dark:text-white/50">
          <li>PayPal - buyer checkout uses the configured merchant app. Automatic seller routing needs PayPal multiparty onboarding.</li>
          <li>Crypto wallet - buyers send supported tokens directly to your verified receiving wallet on-chain.</li>
          <li>Your first verified wallet becomes the default receiving wallet, and each product can override it.</li>
          <li>A product should have at least one working payment path before it is published.</li>
        </ul>
      </div>
    </div>
  );
}
