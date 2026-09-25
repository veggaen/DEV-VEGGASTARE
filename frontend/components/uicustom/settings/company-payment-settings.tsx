/**
 * @fileOverview  Company Seller Payment Settings — PayPal email & default wallet.
 *                Embedded in the company settings page for company owners.
 * @stability     experimental
 */
'use client';

import { useEffect, useState, useTransition, useCallback, useId, useRef } from 'react';
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
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CompanyPaymentSettings({ companyId }: CompanyPaymentSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<SellerPaymentStatus | null>(null);
  const [paypalInput, setPaypalInput] = useState('');
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const emailId = useId();
  const requestSequence = useRef(0), emailEdited = useRef(false);

  // ── Fetch current status ──────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    const sequence = ++requestSequence.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setIsLoadingStatus(true);
    setLoadError(null);
    try {
      const res = await Promise.race([getSellerPaymentStatus({ target: 'company', companyId }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 12_000); })]);
      if (sequence !== requestSequence.current) return false;
      if ('data' in res) {
        setStatus(res.data);
        if (!emailEdited.current) setPaypalInput(res.data.pendingPaypalEmail ?? res.data.paypalEmail ?? '');
        return true;
      } else setLoadError(res.error);
    } catch { if (sequence === requestSequence.current) setLoadError('Payment settings could not load. Try again.'); }
    finally { if (timer) clearTimeout(timer); if (sequence === requestSequence.current) setIsLoadingStatus(false); }
    return false;
  }, [companyId]);

  useEffect(() => {
    const sequence = requestSequence; // Request counter, not a DOM ref.
    void fetchStatus();
    return () => { sequence.current++; };
  }, [fetchStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSavePaypal = () => {
    if (!paypalInput.trim()) return;
    setSaveError(null);
    startTransition(async () => {
      try {
      const res = await savePaypalEmail({ paypalEmail: paypalInput.trim(), expectedEmail: status?.paypalEmail ?? null, target: 'company', companyId });
      if ('error' in res) {
        setSaveError(res.error);
      } else {
        toast.success(res.success);
        emailEdited.current = false;
        await fetchStatus();
      }
      } catch { setSaveError('Your change could not be saved. Please try again.'); }
    });
  };

  const handleRemovePaypal = () => {
    if (!window.confirm('Remove this company’s receiving email and any pending verification? You can add an address again later.')) return;
    setSaveError(null);
    startTransition(async () => {
      try {
      const res = await removePaypalEmail({ expectedEmail: status?.paypalEmail ?? null, expectedPendingEmail: status?.pendingPaypalEmail ?? null, target: 'company', companyId });
      if ('error' in res) {
        setSaveError(res.error);
      } else {
        toast.success(res.success);
        emailEdited.current = false;
        setPaypalInput('');
        await fetchStatus();
      }
      } catch { setSaveError('Your change could not be saved. Please try again.'); }
    });
  };


  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoadingStatus && !status) {
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
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <h2 className="text-lg font-semibold">Payment setup</h2>
      </div>

      {/* ─── PayPal Email ──────────────────────────────────────────────── */}
      <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
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

        {status?.pendingPaypalEmail && <p role="status" className="mb-3 break-words text-sm text-muted-foreground">
          Check <span className="font-medium text-foreground">{status.pendingPaypalEmail}</span> for a verification link. Your current address stays unchanged until you confirm.
        </p>}
        <form onSubmit={event => { event.preventDefault(); handleSavePaypal(); }} className="flex flex-wrap gap-2">
          <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <FiMail aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={emailId} name="companyPaypalEmail" autoComplete="email" spellCheck={false} required maxLength={254}
              type="email"
              placeholder="company-paypal@email.com"
              value={paypalInput}
              onChange={(e) => { emailEdited.current = true; setPaypalInput(e.target.value); }}
              className="min-h-11 pl-10 text-base"
              disabled={isPending || isLoadingStatus}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending || isLoadingStatus || !paypalInput.trim() || (paypalInput.trim().toLowerCase() === status?.paypalEmail && status.paypalEmailVerified && !status.pendingPaypalEmail)}
            className="min-h-11"
          >
            {isPending ? 'Sending…' : status?.pendingPaypalEmail ? 'Resend verification' : 'Send verification'}
          </Button>
          {(status?.paypalEmail || status?.pendingPaypalEmail) && (
            <Button type="button" variant="destructive" className="min-h-11 min-w-11" aria-label="Remove company PayPal receiving email" onClick={handleRemovePaypal} disabled={isPending || isLoadingStatus}>
              <FiTrash2 aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
        </form>
        {saveError && <p role="alert" className="mt-2 text-sm text-destructive">{saveError}</p>}
      </div>

      <PayoutWalletPicker key={`${companyId}:${status?.defaultReceivingWalletId}:${status?.walletChangesAllowed}`} target={{ target: 'company', companyId }}
        wallets={status?.receivingWallets ?? []} selectedId={status?.defaultReceivingWalletId ?? null}
        selectedAddress={status?.defaultReceivingWalletAddress ?? null}
        loading={isLoadingStatus} web3Disabled={status?.walletChangesAllowed === false}
        disabled={isPending} onChanged={async () => { if (!await fetchStatus()) throw new Error('Refresh failed'); }} />
    </div>
  );
}
