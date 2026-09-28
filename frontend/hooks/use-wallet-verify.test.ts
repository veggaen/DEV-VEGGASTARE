/** @vitest-environment jsdom */
/** @fileOverview Challenge sequencing, 2FA and cancelled wallet prompts. @stability stable */
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ sign: vi.fn(), connections: [] as { accounts: string[]; chainId: number; connector: { uid: string; type: string } }[] }));
vi.mock('wagmi', () => ({ useConnections: () => m.connections, useSignMessage: () => ({ signMessageAsync: m.sign }) }));
import { useWalletVerify } from './use-wallet-verify';
const address = '0x' + '1'.repeat(40), success = vi.fn();
let root: Root, container: HTMLDivElement, flow: ReturnType<typeof useWalletVerify>;
let requests: { url: string; body: Record<string, unknown>; signal: AbortSignal; resolve: (r: Response) => void }[];
function Harness({ selected = address }: { selected?: string }) {
  const result = useWalletVerify({ address: selected, chainId: 1, connectorUid: 'qa', onSuccess: success });
  useEffect(() => { flow = result; }, [result]); return null;
}
const render = async (selected = address) => { await act(async () => { root.render(React.createElement(Harness, { selected })); }); };
const start = async (code?: string) => { await act(async () => { void flow.verify(code); }); };
const respond = async (index: number, data: unknown, status = 200) => { await act(async () => { requests[index].resolve(new Response(JSON.stringify(data), { status })); }); };
const challenge = { challengeId: 'qa-challenge', message: 'server-issued message', expires: new Date(Date.now() + 600000).toISOString() };
const wallet = { id: 'qa-wallet', label: 'QA', address, chainId: 1, family: 'EVM', solanaCluster: null, isDefault: false,
  ownerUserId: 'qa-owner', ownerCompanyId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), verifiedAt: new Date().toISOString() };
beforeEach(async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.resetAllMocks(); requests = [];
  m.connections = [{ accounts: [address], chainId: 1, connector: { uid: 'qa', type: 'injected' } }];
  m.sign.mockResolvedValue('0x' + '1'.repeat(130));
  vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => new Promise<Response>(resolve => {
    requests.push({ url, body: JSON.parse(init.body as string), signal: init.signal!, resolve });
  })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container); await render();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('fetches a challenge before signing, then sends only its id, signature and display metadata', async () => {
  await start(); expect(requests[0].url).toBe('/api/wallets/evm/challenge'); expect(m.sign).not.toHaveBeenCalled();
  await respond(0, challenge); expect(m.sign).toHaveBeenCalledWith({ message: challenge.message, account: address, connector: m.connections[0].connector });
  expect(requests[1].body).toEqual({ challengeId: challenge.challengeId, signature: '0x' + '1'.repeat(130), connectorType: 'injected' });
  await respond(1, { ok: true, wallet }); expect(flow.step).toBe('success'); expect(success).toHaveBeenCalledTimes(1);
});
it('waits for the email code before opening the wallet, preserving code entry after an incorrect code', async () => {
  await start(); await respond(0, { twoFactor: true }); expect(flow.step).toBe('two-factor'); expect(m.sign).not.toHaveBeenCalled();
  await start('123456'); expect(requests[1].body.code).toBe('123456'); await respond(1, { error: 'Incorrect code' }, 400);
  expect(flow.needsCode).toBe(true); expect(flow.error).toBe('Incorrect code');
  await start('654321'); await respond(2, challenge); expect(m.sign).toHaveBeenCalledTimes(1); expect(flow.needsCode).toBe(false);
});
it('does not sign when challenge authorization fails', async () => {
  await start(); await respond(0, { error: 'Enable Web3 mode first.' }, 403);
  expect(flow.step).toBe('error'); expect(m.sign).not.toHaveBeenCalled(); expect(requests).toHaveLength(1);
});
it('does not fall back to a different connector or account', async () => {
  m.connections[0].accounts = ['0x' + '2'.repeat(40)]; await start();
  expect(flow.step).toBe('error'); expect(requests).toHaveLength(0); expect(m.sign).not.toHaveBeenCalled();
});
it('double clicks cannot create competing challenges', async () => {
  await act(async () => { void flow.verify(); void flow.verify(); }); expect(requests).toHaveLength(1);
});
it('ignores a late signature after cancellation without unlocking a newer request', async () => {
  let finish!: (s: `0x${string}`) => void;
  m.sign.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await start(); await respond(0, challenge); expect(flow.step).toBe('in-wallet');
  await act(async () => flow.reset()); await start(); expect(requests).toHaveLength(2);
  await act(async () => finish('0x1234')); expect(flow.step).toBe('preparing');
  await start(); expect(requests).toHaveLength(2); expect(success).not.toHaveBeenCalled();
});
it('does not submit a late result after unmount or changed wallet', async () => {
  await start(); await render('0x' + '2'.repeat(40)); expect(requests[0].signal.aborted).toBe(true);
  await respond(0, challenge); expect(m.sign).not.toHaveBeenCalled(); expect(flow.step).toBe('idle');
});
it('never retries a possibly committed POST automatically', async () => {
  await start(); await respond(0, challenge); expect(requests).toHaveLength(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
  expect(flow.step).toBe('error'); expect(requests[1].signal.aborted).toBe(true); expect(requests).toHaveLength(2);
  await respond(1, { ok: true, wallet }); expect(flow.step).toBe('error'); expect(success).not.toHaveBeenCalled();
});
it('reports wallet rejection without calling verify', async () => {
  m.sign.mockRejectedValueOnce(new Error('User rejected')); await start(); await respond(0, challenge);
  expect(flow.error).toContain('cancelled'); expect(requests).toHaveLength(1);
});
