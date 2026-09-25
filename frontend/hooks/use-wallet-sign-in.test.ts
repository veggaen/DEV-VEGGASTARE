/** @vitest-environment jsdom */
/** @fileOverview Bound connector, one prompt, email code, cancellation and uncertain session checks. @stability stable */
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ sign: vi.fn(), auth: vi.fn(), toast: vi.fn(), config: { state: { connections: new Map() } } }));
vi.mock('wagmi', () => ({ useConfig: () => m.config, useSignMessage: () => ({ signMessageAsync: m.sign }) }));
vi.mock('next-auth/react', () => ({ signIn: m.auth }));
vi.mock('sonner', () => ({ toast: { success: m.toast } }));
import { useWalletSignIn } from './use-wallet-sign-in';
let root: Root, container: HTMLDivElement, flow: ReturnType<typeof useWalletSignIn>, other: ReturnType<typeof useWalletSignIn>;
let requests: { url: string; body: unknown; signal: AbortSignal; resolve: (r: Response) => void }[];
const address = '0x' + '1'.repeat(40), signature = '0x' + '2'.repeat(130);
const connector = { uid: 'qa', type: 'injected' };
function Harness() {
  const first = useWalletSignIn('https://attacker.test'), second = useWalletSignIn();
  useEffect(() => { flow = first; other = second; }); return null;
}
const challenge = () => ({ challengeId: 'qa-challenge', message: 'exact server message', expires: new Date(Date.now() + 600000).toISOString() });
const start = async () => { await act(async () => { void flow.signInWithAddress(address, 'qa'); }); };
const respond = async (index: number, data: unknown, status = 200) => { await act(async () => requests[index].resolve(new Response(JSON.stringify(data), { status }))); };
beforeEach(async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.resetAllMocks(); requests = [];
  m.config.state.connections = new Map([['qa', { connector, accounts: [address], chainId: 8453 }]]);
  m.sign.mockResolvedValue(signature); m.auth.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });
  vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => new Promise<Response>(resolve => {
    requests.push({ url, body: JSON.parse(init.body as string), signal: init.signal!, resolve });
  })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(React.createElement(Harness)));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('signs only the selected connector and sends a challenge id, not a caller-selected user', async () => {
  await start(); expect(requests[0].body).toEqual({ address, chainId: 8453 }); expect(m.sign).not.toHaveBeenCalled();
  const c = challenge(); await respond(0, c);
  expect(m.sign).toHaveBeenCalledWith({ message: c.message, account: address, connector });
  expect(requests[1].body).toEqual({ challengeId: c.challengeId, signature });
  await respond(1, { ready: true });
  expect(m.auth).toHaveBeenCalledWith('wallet', { challengeId: c.challengeId, signature, redirect: false, callbackUrl: '/products' });
  expect(flow.phase).toBe('error'); expect(m.toast).not.toHaveBeenCalled();
});
it('waits for exact six digits, allows correction and never signs twice for 2FA', async () => {
  await start(); await respond(0, challenge()); await respond(1, { twoFactor: true });
  expect(flow.phase).toBe('two-factor'); expect(m.auth).not.toHaveBeenCalled();
  await act(async () => { await flow.submitCode('1234560'); }); expect(m.auth).not.toHaveBeenCalled();
  await act(async () => { await flow.submitCode('123456'); }); expect(flow.phase).toBe('two-factor');
  await act(async () => { await flow.submitCode('654321'); }); expect(m.auth).toHaveBeenCalledTimes(2); expect(m.sign).toHaveBeenCalledTimes(1);
});
it('blocks double clicks and the other hook while waiting for a code', async () => {
  await start(); await act(async () => { void flow.signInWithAddress(address); void other.signInWithAddress(address); }); expect(requests).toHaveLength(1);
  await respond(0, challenge()); await respond(1, { twoFactor: true });
  await act(async () => { void other.signInWithAddress(address); }); expect(requests).toHaveLength(2);
  await act(async () => flow.cancel()); await act(async () => { void other.signInWithAddress(address); }); expect(requests).toHaveLength(3);
});
it('cancellation ignores a late wallet signature without releasing a newer request', async () => {
  let resolve!: (value: string) => void; m.sign.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await start(); await respond(0, challenge()); await act(async () => flow.cancel()); await start();
  await act(async () => resolve(signature)); expect(flow.phase).toBe('preparing'); expect(requests).toHaveLength(2);
  await start(); expect(requests).toHaveLength(2); expect(m.auth).not.toHaveBeenCalled();
});
it.each(['before-sign', 'before-auth', 'before-code'])('rejects a changed account or network %s', async when => {
  await start();
  if (when === 'before-sign') m.config.state.connections.get('qa').chainId = 1;
  await respond(0, challenge());
  if (when === 'before-auth') m.config.state.connections.get('qa').accounts = ['0x' + '3'.repeat(40)];
  if (when !== 'before-sign') await respond(1, when === 'before-code' ? { twoFactor: true } : { ready: true });
  if (when === 'before-code') { m.config.state.connections.clear(); await act(async () => { await flow.submitCode('123456'); }); }
  expect(flow.phase).toBe('error'); expect(m.auth).not.toHaveBeenCalled();
});
it('missing authorization response is not a successful login', async () => {
  m.auth.mockResolvedValue(undefined); await start(); await respond(0, challenge()); await respond(1, { ready: true });
  expect(flow.phase).toBe('error'); expect(m.toast).not.toHaveBeenCalled();
});
it('a possibly committed auth request requires session reload, not an automatic retry', async () => {
  m.auth.mockImplementation(() => new Promise(() => {}));
  await start(); await respond(0, challenge()); await respond(1, { ready: true });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); }); expect(flow.phase).toBe('uncertain');
  await start(); await act(async () => flow.cancel()); expect(m.auth).toHaveBeenCalledTimes(1); expect(flow.phase).toBe('uncertain');
});
it('a late challenge after unmount does not open the wallet', async () => {
  await start(); await act(async () => root.unmount()); expect(requests[0].signal.aborted).toBe(true);
  await respond(0, challenge()); expect(m.sign).not.toHaveBeenCalled();
});
it('hides raw network and provider error text', async () => {
  m.sign.mockRejectedValue(new Error('SECRET wallet payload')); await start(); await respond(0, challenge());
  expect(flow.error).toContain('cancelled'); expect(flow.error).not.toContain('SECRET'); expect(requests).toHaveLength(1);
});
