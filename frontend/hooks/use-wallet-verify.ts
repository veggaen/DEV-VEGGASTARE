/** @fileOverview Shared, cancellable server-challenge wallet linking. @stability evolving */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnections, useSignMessage } from 'wagmi';
import { WalletChallengeCreatedResponseSchema, WalletVerifyResponseSchema } from '@/lib/types/wallets';

export type VerifyStep = 'idle' | 'preparing' | 'two-factor' | 'in-wallet' | 'waiting' | 'success' | 'error';
export interface UseWalletVerifyReturn {
  step: VerifyStep; error: string | null; needsCode: boolean;
  verify: (code?: string) => Promise<void>; reset: () => void;
}

export function useWalletVerify({ address, chainId, connectorUid, authProvider, socialEmail, onSuccess }: {
  address: string | undefined; chainId: number | undefined; connectorUid: string | undefined;
  authProvider?: string; socialEmail?: string; onSuccess?: () => void;
}): UseWalletVerifyReturn {
  const [step, setStep] = useState<VerifyStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const { signMessageAsync } = useSignMessage();
  const connections = useConnections();
  const connectionsRef = useRef(connections); connectionsRef.current = connections;
  const active = useRef<AbortController | null>(null);
  const reset = useCallback(() => {
    active.current?.abort(); active.current = null;
    setStep('idle'); setError(null); setNeedsCode(false);
  }, []);
  useEffect(() => { reset(); return () => { active.current?.abort(); active.current = null; }; }, [address, chainId, connectorUid, reset]);

  const verify = useCallback(async (code?: string) => {
    if (active.current) return;
    const run = new AbortController(); active.current = run;
    const current = () => active.current === run && !run.signal.aborted;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = (message: string, ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (current()) { setError(message); setStep('error'); run.abort(); active.current = null; } }, ms);
    };
    const post = async (url: string, body: unknown) => {
      deadline('The request timed out. Refresh your wallets before trying again.', 90_000);
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: run.signal });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Verification failed. Please try again.');
      return json;
    };
    try {
      setError(null); setStep('preparing');
      const findConnection = () => connectionsRef.current.find(connection =>
        (!connectorUid || connection.connector.uid === connectorUid)
        && connection.accounts.some(account => account.toLowerCase() === address?.toLowerCase())
        && connection.chainId === chainId);
      if (!address || !chainId || !findConnection()) throw new Error('Reconnect this wallet on the selected network and try again.');
      const raw = await post('/api/wallets/evm/challenge', { address, chainId, ...(code ? { code } : {}) });
      if (!current()) return;
      if (raw?.twoFactor === true) { setNeedsCode(true); setStep('two-factor'); return; }
      const challenge = WalletChallengeCreatedResponseSchema.parse(raw);
      const connection = findConnection();
      if (!connection) throw new Error('Wallet or network changed. Start verification again.');
      setNeedsCode(false); setStep('in-wallet');
      deadline('The wallet did not respond. Close its old request before trying again.', 60_000);
      let signature: `0x${string}`;
      try { signature = await signMessageAsync({ message: challenge.message, connector: connection.connector, account: address as `0x${string}` }); }
      catch { throw new Error('Signature cancelled. No wallet was linked.'); }
      if (!current()) return;
      if (!findConnection()) throw new Error('Wallet or network changed. Start verification again.');
      setStep('waiting');
      const result = await post('/api/wallets/evm/verify', { challengeId: challenge.challengeId, signature,
        connectorType: connection.connector.type, authProvider: authProvider || undefined, socialEmail: socialEmail || undefined });
      if (!current()) return;
      WalletVerifyResponseSchema.parse(result);
      setStep('success'); onSuccess?.();
    } catch (failure) {
      if (current()) { setError(failure instanceof Error ? failure.message : 'Verification failed. Please try again.'); setStep('error'); }
    } finally {
      clearTimeout(timer);
      // A late result from a cancelled prompt cannot reset a newer attempt.
      if (active.current === run) active.current = null;
    }
  }, [address, chainId, connectorUid, authProvider, socialEmail, onSuccess, signMessageAsync]);
  return { step, error, needsCode, verify, reset };
}
