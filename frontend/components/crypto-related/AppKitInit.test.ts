/** @fileOverview Wallet startup stays opt-in, shared, bounded and retryable. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  ready: vi.fn(), open: vi.fn(), create: vi.fn(), storage: vi.fn(),
  session: { status: 'unauthenticated', data: null as null | { user: { web3ModeEnabled: boolean } } },
}));
vi.mock('react', () => ({ useEffect: (effect: () => void) => effect() }));
vi.mock('next-auth/react', () => ({ useSession: () => sdk.session }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn() }) }));
vi.mock('@/lib/web3-config', () => ({ WEB3_PROJECT_ID: 'qa-project' }));
vi.mock('@reown/appkit/react', () => ({ createAppKit: sdk.create }));
vi.mock('@reown/appkit/networks', () => ({ mainnet: { id: 1 }, sepolia: { id: 11155111 }, base: { id: 8453 }, baseSepolia: { id: 84532 } }));
vi.mock('@reown/appkit-adapter-wagmi', () => ({ WagmiAdapter: class { wagmiConfig = {}; } }));
vi.mock('@wagmi/core', () => ({ cookieStorage: {}, createStorage: vi.fn(), injected: vi.fn() }));

import { AppKitInitializer, ensureAppKit, openAppKitWallet } from './AppKitInit';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__veggatAppKitPromise = undefined;
  sdk.session = { status: 'unauthenticated', data: null };
  sdk.storage.mockReturnValue(null);
  sdk.ready.mockResolvedValue(undefined);
  sdk.open.mockResolvedValue(undefined);
  sdk.create.mockImplementation(() => ({ ready: sdk.ready, open: sdk.open }));
  vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' } });
  vi.stubGlobal('localStorage', { getItem: sdk.storage });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); globalThis.__veggatAppKitPromise = undefined; });

it('does not start for visitors, non-wallet users, or a loading session', () => {
  AppKitInitializer();
  sdk.session = { status: 'authenticated', data: { user: { web3ModeEnabled: false } } }; AppKitInitializer();
  sdk.session = { status: 'loading', data: { user: { web3ModeEnabled: true } } }; AppKitInitializer();
  expect(globalThis.__veggatAppKitPromise).toBeUndefined(); expect(sdk.create).not.toHaveBeenCalled();
});
it('restores a previously opted-in account once without opening a modal', async () => {
  sdk.session = { status: 'authenticated', data: { user: { web3ModeEnabled: true } } };
  AppKitInitializer(); AppKitInitializer(); await globalThis.__veggatAppKitPromise;
  expect(sdk.create).toHaveBeenCalledTimes(1); expect(sdk.open).not.toHaveBeenCalled();
});
it('honors an explicit local opt-in but tolerates disabled browser storage', async () => {
  sdk.storage.mockImplementationOnce(() => { throw new Error('Storage blocked'); }); AppKitInitializer();
  expect(sdk.create).not.toHaveBeenCalled();
  sdk.storage.mockReturnValue('true'); AppKitInitializer(); await globalThis.__veggatAppKitPromise;
  expect(sdk.create).toHaveBeenCalledTimes(1);
});
it('shares concurrent initialization and opens only after readiness', async () => {
  let release!: () => void; sdk.ready.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  const first = ensureAppKit(); expect(ensureAppKit()).toBe(first);
  const opened = openAppKitWallet(); expect(sdk.open).not.toHaveBeenCalled();
  release(); await opened;
  expect(sdk.create).toHaveBeenCalledTimes(1); expect(sdk.open).toHaveBeenCalledWith({ view: 'Connect' });
  expect(sdk.create.mock.calls[0][0].metadata.url).toBe('http://localhost:3000');
});
it('does not cache a rejected initialization or open a failed modal', async () => {
  sdk.ready.mockRejectedValueOnce(new Error('Controlled SDK failure'));
  await expect(openAppKitWallet()).rejects.toThrow('Controlled SDK failure');
  expect(sdk.open).not.toHaveBeenCalled(); expect(globalThis.__veggatAppKitPromise).toBeUndefined();
  await openAppKitWallet(); expect(sdk.create).toHaveBeenCalledTimes(2);
});
it('bounds slow startup and never opens a late modal after timeout', async () => {
  vi.useFakeTimers(); let release!: () => void;
  sdk.ready.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  const failed = expect(openAppKitWallet()).rejects.toThrow('took too long');
  await vi.advanceTimersByTimeAsync(15_000); await failed;
  release(); await Promise.resolve(); expect(sdk.open).not.toHaveBeenCalled();
  expect(globalThis.__veggatAppKitPromise).toBeUndefined();
});
it('cannot initialize a browser wallet on the server', async () => {
  vi.stubGlobal('window', undefined);
  await expect(ensureAppKit()).rejects.toThrow('not configured'); expect(sdk.create).not.toHaveBeenCalled();
});
