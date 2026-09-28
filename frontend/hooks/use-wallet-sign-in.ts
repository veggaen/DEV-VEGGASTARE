/** @fileOverview Shared browser-bound EOA sign-in with cancellable prompts and 2FA. @stability evolving */
'use client';
import * as React from 'react';
import { useConfig, useSignMessage } from 'wagmi';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';

type Phase = 'idle' | 'preparing' | 'in-wallet' | 'two-factor' | 'signing-in' | 'error' | 'uncertain';
type Proof = { challengeId: string; signature: string; expires: number; unchanged: () => boolean };
class SignInMessage extends Error {}
let owner: AbortController | null = null; // direct and AppKit must never prompt twice

export function useWalletSignIn(callbackUrl = '/products') {
  const config = useConfig();
  const { signMessageAsync } = useSignMessage();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const active = React.useRef<AbortController | null>(null);
  const proof = React.useRef<Proof | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const finishing = React.useRef(false);
  const release = React.useCallback(() => {
    clearTimeout(timer.current);
    if (owner === active.current) owner = null;
    active.current?.abort(); active.current = null; proof.current = null;
  }, []);
  const cancel = React.useCallback(() => {
    if (finishing.current) return; // an auth POST may already have set a session cookie
    release(); setPhase('idle'); setError(null);
  }, [release]);
  React.useEffect(() => () => release(), [release]);
  const safeCallback = React.useCallback(() => {
    try {
      const url = new URL(callbackUrl, window.location.origin);
      return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/products';
    } catch { return '/products'; }
  }, [callbackUrl]);
  const finish = React.useCallback(async (run: AbortController, signed: Proof, code?: string) => {
    const current = () => active.current === run && !run.signal.aborted;
    if (!current() || finishing.current) return false;
    if (!signed.unchanged()) { release(); setPhase('error'); setError('Wallet or network changed. Connect again.'); return false; }
    if (signed.expires <= Date.now()) { release(); setPhase('error'); setError('Sign-in expired. Connect your wallet again.'); return false; }
    clearTimeout(timer.current); finishing.current = true; setPhase('signing-in'); setError(null);
    timer.current = setTimeout(() => {
      if (current()) { setPhase('uncertain'); setError('Sign-in is taking longer than expected. Reload to check your session.'); }
    }, 60_000);
    try {
      const result = await signIn('wallet', { challengeId: signed.challengeId, signature: signed.signature, ...(code ? { code } : {}), redirect: false, callbackUrl: safeCallback() });
      if (!current()) return false;
      if (!result?.ok || result.error) {
        setPhase(code ? 'two-factor' : 'error');
        setError(code ? 'Code incorrect or expired. Check it or cancel and start again.' : 'Wallet sign-in failed. Try again or use another sign-in method.');
        if (!code) release();
        return false;
      }
      toast.success('Signed in with your wallet');
      window.location.assign(safeCallback()); release(); return true;
    } catch {
      if (current()) { setPhase('uncertain'); setError('We could not confirm sign-in. Reload to check your session.'); }
      return false;
    } finally { clearTimeout(timer.current); finishing.current = false; }
  }, [release, safeCallback]);

  const signInWithAddress = React.useCallback(async (address: string, connectorUid?: string): Promise<boolean> => {
    if (owner || active.current) return false;
    const run = new AbortController(); owner = run; active.current = run;
    const current = () => active.current === run && !run.signal.aborted;
    const deadline = (message: string, ms: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (current()) { release(); setPhase('error'); setError(message); }
      }, ms);
    };
    const post = async (url: string, body: unknown) => {
      deadline('The request timed out. Connect your wallet again when ready.', 60_000);
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: run.signal });
      const json = await response.json();
      if (!response.ok) throw new SignInMessage('Wallet sign-in is unavailable. Try again shortly or use another sign-in method.');
      return json;
    };
    try {
      setPhase('preparing'); setError(null);
      const matches = [...config.state.connections.values()].filter(c => (!connectorUid || c.connector.uid === connectorUid) && c.accounts.some(a => a.toLowerCase() === address.toLowerCase()));
      if (matches.length !== 1) throw new SignInMessage('Choose one connected wallet and try again.');
      const connection = matches[0], chainId = connection.chainId;
      const unchanged = () => [...config.state.connections.values()].some(c => c.connector.uid === connection.connector.uid && c.chainId === chainId && c.accounts.some(a => a.toLowerCase() === address.toLowerCase()));
      const challenge = await post('/api/auth/wallet/nonce', { address, chainId });
      if (!current()) return false;
      if (typeof challenge?.challengeId !== 'string' || typeof challenge.message !== 'string' || !Number.isFinite(Date.parse(challenge.expires))) throw new SignInMessage('Could not start sign-in. Please try again.');
      if (!unchanged()) throw new SignInMessage('Wallet or network changed. Connect again.');
      setPhase('in-wallet'); deadline('Your wallet did not respond. Close its old request before trying again.', 60_000);
      let signature: string;
      try { signature = await signMessageAsync({ message: challenge.message, connector: connection.connector, account: address as `0x${string}` }); }
      catch { throw new SignInMessage('Signature cancelled. You can try again when ready.'); }
      if (!current()) return false;
      if (!unchanged()) throw new SignInMessage('Wallet or network changed. Connect again.');
      setPhase('preparing');
      const signed = { challengeId: challenge.challengeId, signature, expires: Date.parse(challenge.expires), unchanged };
      const prepared = await post('/api/auth/wallet/prepare', { challengeId: signed.challengeId, signature });
      if (!current()) return false;
      clearTimeout(timer.current);
      if (prepared?.twoFactor === true) { proof.current = signed; setPhase('two-factor'); return false; }
      if (prepared?.ready !== true) throw new SignInMessage('Could not verify sign-in. Please try again.');
      return await finish(run, signed);
    } catch (failure) {
      if (current()) { release(); setPhase('error'); setError(failure instanceof SignInMessage ? failure.message : 'Wallet sign-in is unavailable. Please try again.'); }
      return false;
    }
  }, [config, signMessageAsync, finish, release]);
  const submitCode = React.useCallback(async (code: string) => {
    if (!/^\d{6}$/.test(code)) { setError('Enter the six digits from your email.'); return false; }
    if (!active.current || !proof.current) return false;
    return finish(active.current, proof.current, code);
  }, [finish]);
  return { signInWithAddress, signingIn: !['idle', 'error'].includes(phase), phase, error, submitCode, cancel };
}
