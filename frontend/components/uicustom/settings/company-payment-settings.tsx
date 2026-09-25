/**
 * @fileOverview  Company Seller Payment Settings — PayPal email & default wallet.
 *                Embedded in the company settings page for company owners.
 * @stability     experimental
 */
'use client';

import { useEffect, useState, useTransition, useCallback, useId } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PayoutWalletPicker } from './payout-wallet-picker';
import {
  FiCheckCircle, FiAlertCircle, FiMail, FiTrash2, FiLoader,
} from 'react-icons/fi';
import {
  savePaypalEmail,
  removePaypalEmail,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const emailId = useId();

  // ── Fetch current status ──────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    setLoadError(null);
    try {
      const res = await getSellerPaymentStatus({ target: 'company', companyId });
      if ('data' in res) {
        setStatus(res.data);
        setPaypalInput(res.data.paypalEmail ?? '');
      } else setLoadError(res.error);
    } catch { setLoadError('Payment settings could not load. Try again.'); }
    finally { setIsLoadingStatus(false); }
  }, [companyId]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void fetchStatus();
    });
  }, [fetchStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSavePaypal = () => {
    if (!paypalInput.trim()) return;
    setSaveError(null);
    startTransition(async () => {
      try {
      const res = await savePaypalEmail({ paypalEmail: paypalInput.trim(), target: 'company', companyId });
      if ('error' in res) {
        setSaveError(res.error);
      } else {
        toast.success(res.success);
        await fetchStatus();
      }
      } catch { setSaveError('Your change could not be saved. Please try again.'); }
    });
  };

  const handleRemovePaypal = () => {
    if (!window.confirm('Remove this company’s PayPal receiving email? You can add it again later.')) return;
    setSaveError(null);
    startTransition(async () => {
      try {
      const res = await removePaypalEmail({ target: 'company', companyId });
      if ('error' in res) {
        setSaveError(res.error);
      } else {
        toast.success(res.success);
        setPaypalInput('');
        await fetchStatus();
      }
      } catch { setSaveError('Your change could not be saved. Please try again.'); }
    });
  };


  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoadingStatus) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-8">
        <FiLoader aria-hidden="true" className="h-5 w-5 motion-safe:animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading payment settings…</span>
      </div>
    );
  }
  if (loadError) return <div className="space-y-3">
    <p role="alert" className="text-sm text-destructive">{loadError}</p>
    <Button className="min-h-11" onClick={() => void fetchStatus()}>Retry payment settings</Button>
  </div>;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <p className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Payment Setup</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Configure how this company receives payments from buyers.
        </p>
      </div>

      {/* ─── PayPal Email ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border p-4">
        <label htmlFor={emailId} className="mb-2 block text-sm font-semibold">
          PayPal Receiving Email
        </label>
        <p className="mb-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          Verifies inbox ownership for payout records. Automatic PayPal seller routing requires marketplace approval.
        </p>

        {status?.paypalEmail && (
          <div className={`mb-3 flex flex-wrap items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
            status.paypalEmailVerified
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }`}>
            {status.paypalEmailVerified ? (
              <FiCheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <FiAlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 break-all font-medium">{status.paypalEmail}</span>
            <span className="text-xs opacity-70">
              {status.paypalEmailVerified ? '— Verified' : '— Pending verification'}
            </span>
          </div>
        )}

        <form onSubmit={event => { event.preventDefault(); handleSavePaypal(); }} className="flex flex-wrap gap-2">
          <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <FiMail aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={emailId} name="companyPaypalEmail" autoComplete="email" spellCheck={false} required maxLength={254}
              type="email"
              placeholder="company-paypal@email.com"
              value={paypalInput}
              onChange={(e) => setPaypalInput(e.target.value)}
              className="min-h-11 pl-10 text-base"
              disabled={isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending || !paypalInput.trim() || paypalInput.trim() === status?.paypalEmail}
            className="min-h-11"
          >
            {status?.paypalEmail ? 'Update' : 'Save & Verify'}
          </Button>
          {status?.paypalEmail && (
            <Button type="button" variant="destructive" className="min-h-11 min-w-11" aria-label="Remove company PayPal receiving email" onClick={handleRemovePaypal} disabled={isPending}>
              <FiTrash2 aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
        </form>
        {saveError && <p role="alert" className="mt-2 text-sm text-destructive">{saveError}</p>}
      </div>

      <PayoutWalletPicker key={companyId} target={{ target: 'company', companyId }}
        wallets={wallets} selectedId={status?.defaultReceivingWalletId ?? null}
        selectedAddress={status?.defaultReceivingWalletAddress ?? null}
        disabled={isPending} onChanged={fetchStatus} />
    </div>
  );
}
