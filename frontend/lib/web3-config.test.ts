/** @fileOverview Missing/blank WalletConnect configuration is explicitly unavailable. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
beforeEach(() => {
  vi.resetModules();
  for (const key of ['NEXT_PUBLIC_APPKIT_PROJECT_ID', 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'NEXT_PUBLIC_PROJECT_ID']) vi.stubEnv(key, '');
});
afterEach(() => vi.unstubAllEnvs());
it('disables QR connections without any project id', async () => {
  const config = await import('./web3-config');
  expect(config.IS_WEB3_CONFIGURED).toBe(false);
});
it('ignores whitespace and permits a configured fallback', async () => {
  vi.stubEnv('NEXT_PUBLIC_APPKIT_PROJECT_ID', '   ');
  vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'qa-project');
  expect((await import('./web3-config')).WEB3_PROJECT_ID).toBe('qa-project');
});
it('prefers the explicit AppKit project', async () => {
  vi.stubEnv('NEXT_PUBLIC_APPKIT_PROJECT_ID', 'qa-appkit');
  vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'qa-fallback');
  expect((await import('./web3-config')).WEB3_PROJECT_ID).toBe('qa-appkit');
});
