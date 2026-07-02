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
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<SellerPaymentStatus | null>(null);
  const [wallets, setWallets] = useState<EvmWallet[]>([]);
  const [paypalInput, setPaypalInput] = useState('');
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingWallets, setIsLoadingWallets] = useState(true);

  // ── Fetch current status ──────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    const res = await getSellerPaymentStatus({ target: 'user' });
    if ('data' in res) {
      setStatus(res.data);
      setPaypalInput(res.data.paypalEmail ?? '');
    }
    setIsLoadingStatus(false);
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
<<<<<<< HEAD
    void (async () => {
      await fetchWallets();
      await fetchStatus();
    })();
=======
    fetchStatus();
    fetchWallets();
>>>>>>> dev
  }, [fetchStatus, fetchWallets]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSavePaypal = () => {
    if (!paypalInput.trim()) return;
    startTransition(async () => {
      const res = await savePaypalEmail({ paypalEmail: paypalInput.trim(), target: 'user' });
      if ('error' in res) {
        toast.error(res.error);
      } else {
        toast.success(res.success);
        await fetchStatus();
      }
    });
  };

  const handleRemovePaypal = () => {
    startTransition(async () => {
      const res = await removePaypalEmail({ target: 'user' });
      if ('error' in res) {
        toast.error(res.error);
      } else {
        toast.success(res.success);
        setPaypalInput('');
        await fetchStatus();
      }
    });
  };

  const handleSetDefaultWallet = (walletId: string) => {
    startTransition(async () => {
      const res = await setDefaultReceivingWallet({ walletId, target: 'user' });
      if ('error' in res) {
        toast.error(res.error);
      } else {
        toast.success(res.success);
        await fetchStatus();
      }
    });
  };

  const handleRemoveDefaultWallet = () => {
    startTransition(async () => {
      const res = await removeDefaultReceivingWallet({ target: 'user' });
      if ('error' in res) {
        toast.error(res.error);
      } else {
        toast.success(res.success);
        await fetchStatus();
      }
    });
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoadingStatus) {
    return (
      <div className="flex items-center justify-center py-16">
        <FiLoader className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

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
<<<<<<< HEAD
          Save the PayPal email you want associated with seller records. Direct seller-routed PayPal payouts require
          PayPal multiparty onboarding; until then, checkout can use the platform PayPal merchant app when it is configured.
=======
          Buyers can pay you via PayPal to this address. We&apos;ll verify ownership first.
>>>>>>> dev
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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FiMail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              type="email"
              placeholder="your-paypal@email.com"
              value={paypalInput}
              onChange={(e) => setPaypalInput(e.target.value)}
              className="pl-10"
              disabled={isPending}
            />
          </div>
          <Button
            onClick={handleSavePaypal}
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
              disabled={isPending}
            >
              <FiTrash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
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
<<<<<<< HEAD
              No verified wallets yet. Connect and sign a wallet in{' '}
=======
              No verified wallets yet. Go to{' '}
>>>>>>> dev
              <button
                className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700 dark:text-emerald-400"
                onClick={() => {
                  // Navigate to wallet section
                  const url = new URL(window.location.href);
                  url.searchParams.set('section', 'wallet');
                  window.history.replaceState(null, '', url.toString());
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
              >
                Web3 & Wallet
              </button>{' '}
<<<<<<< HEAD
              . The first verified wallet is now used automatically for new product sales.
=======
              to connect and verify a wallet first.
>>>>>>> dev
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
<<<<<<< HEAD
          <li>PayPal - buyer checkout uses the configured merchant app. Automatic seller routing needs PayPal multiparty onboarding.</li>
          <li>Crypto wallet - buyers send supported tokens directly to your verified receiving wallet on-chain.</li>
          <li>Your first verified wallet becomes the default receiving wallet, and each product can override it.</li>
          <li>A product should have at least one working payment path before it is published.</li>
=======
          <li>• <strong>PayPal</strong> — Buyers pay via PayPal. Funds go to your verified email.</li>
          <li>• <strong>Crypto wallet</strong> — Buyers send tokens directly to your wallet on-chain.</li>
          <li>• You can override the receiving wallet on each product listing.</li>
          <li>• At least one payment method is required before listing products for sale.</li>
>>>>>>> dev
        </ul>
      </div>
    </div>
  );
}
