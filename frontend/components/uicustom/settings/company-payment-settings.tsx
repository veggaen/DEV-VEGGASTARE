/**
 * @fileOverview  Company Seller Payment Settings — PayPal email & default wallet.
 *                Embedded in the company settings page for company owners.
 * @stability     experimental
 */
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FiCheckCircle, FiAlertCircle, FiMail, FiTrash2, FiLoader,
  FiCreditCard,
} from 'react-icons/fi';
import {
  savePaypalEmail,
  removePaypalEmail,
  setDefaultReceivingWallet,
  removeDefaultReceivingWallet,
  getSellerPaymentStatus,
  type SellerPaymentStatus,
} from '@/actions/seller-payment';

// ─── Props ──────────────────────────────────────────────────────────────────

interface CompanyPaymentSettingsProps {
  companyId: string;
  /** Wallets already loaded from the company API (WalletDto-like) */
  wallets?: Array<{
    id: string;
    label: string;
    address: string;
    isDefault: boolean;
    verifiedAt: string | null;
  }>;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CompanyPaymentSettings({ companyId, wallets = [] }: CompanyPaymentSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<SellerPaymentStatus | null>(null);
  const [paypalInput, setPaypalInput] = useState('');
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // ── Fetch current status ──────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    const res = await getSellerPaymentStatus({ target: 'company', companyId });
    if ('data' in res) {
      setStatus(res.data);
      setPaypalInput(res.data.paypalEmail ?? '');
    }
    setIsLoadingStatus(false);
  }, [companyId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSavePaypal = () => {
    if (!paypalInput.trim()) return;
    startTransition(async () => {
      const res = await savePaypalEmail({ paypalEmail: paypalInput.trim(), target: 'company', companyId });
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
      const res = await removePaypalEmail({ target: 'company', companyId });
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
      const res = await setDefaultReceivingWallet({ walletId, target: 'company', companyId });
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
      const res = await removeDefaultReceivingWallet({ target: 'company', companyId });
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
      <div className="flex items-center justify-center py-8">
        <FiLoader className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Company wallets that have been verified
  const verifiedWallets = wallets.filter((w) => w.verifiedAt);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Payment Setup</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Configure how this company receives payments from buyers.
        </p>
      </div>

      {/* ─── PayPal Email ──────────────────────────────────────────────── */}
      <div className="rounded-lg border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-white/3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
          PayPal Receiving Email
        </p>

        {status?.paypalEmail && (
          <div className={`mb-3 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
            status.paypalEmailVerified
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }`}>
            {status.paypalEmailVerified ? (
              <FiCheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <FiAlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">{status.paypalEmail}</span>
            <span className="text-xs opacity-70">
              {status.paypalEmailVerified ? '— Verified' : '— Pending verification'}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <FiMail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              type="email"
              placeholder="company-paypal@email.com"
              value={paypalInput}
              onChange={(e) => setPaypalInput(e.target.value)}
              className="pl-10 h-9 text-sm"
              disabled={isPending}
            />
          </div>
          <Button
            onClick={handleSavePaypal}
            disabled={isPending || !paypalInput.trim() || paypalInput.trim() === status?.paypalEmail}
            size="sm"
          >
            {status?.paypalEmail ? 'Update' : 'Save & Verify'}
          </Button>
          {status?.paypalEmail && (
            <Button variant="destructive" size="sm" onClick={handleRemovePaypal} disabled={isPending}>
              <FiTrash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ─── Default Receiving Wallet ──────────────────────────────────── */}
      <div className="rounded-lg border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-white/3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
          Default Receiving Wallet
        </p>

        {status?.defaultReceivingWalletAddress && (
          <div className="mb-3 flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <FiCreditCard className="h-4 w-4 shrink-0" />
            <span className="font-mono text-xs">
              {status.defaultReceivingWalletAddress.slice(0, 6)}…{status.defaultReceivingWalletAddress.slice(-4)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 px-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
              onClick={handleRemoveDefaultWallet}
              disabled={isPending}
            >
              Remove
            </Button>
          </div>
        )}

        {verifiedWallets.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No verified wallets available for this company.
          </p>
        ) : (
          <div className="grid gap-2">
            {verifiedWallets.map((w) => {
              const isSelected = status?.defaultReceivingWalletId === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => !isSelected && handleSetDefaultWallet(w.id)}
                  disabled={isPending || isSelected}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5'
                      : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-white dark:bg-white/5'
                  }`}
                >
                  <FiCreditCard className={`h-4 w-4 shrink-0 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`} />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-zinc-900 dark:text-white/90">{w.label}</span>
                    <span className="ml-2 font-mono text-xs text-zinc-500 dark:text-white/40">
                      {w.address.slice(0, 6)}…{w.address.slice(-4)}
                    </span>
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
    </div>
  );
}
