/** @fileOverview Server Action origin scope stays aligned with the host under test. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock('next/headers', () => ({ headers: m.headers }));
vi.mock('@/lib/wallet-link', () => ({ WalletLinkError: class extends Error {} }));
import { walletActionOrigin } from './wallet-action-origin';
beforeEach(() => vi.resetAllMocks());
it.each(['http://localhost:3000', 'https://preview.example.test', 'https://www.veggat.com'])('accepts the exact same-host origin %s', async origin => {
  m.headers.mockResolvedValue(new Headers({ origin, host: new URL(origin).host }));
  expect(await walletActionOrigin()).toBe(origin);
});
it('uses the trusted forwarded host as Next Server Actions do', async () => {
  m.headers.mockResolvedValue(new Headers({ origin: 'https://www.veggat.com', host: 'internal:3000', 'x-forwarded-host': 'www.veggat.com' }));
  expect(await walletActionOrigin()).toBe('https://www.veggat.com');
});
it.each([null, 'null', 'https://attacker.example', 'http://localhost:3100', 'http://localhost:3000/', 'http://localhost:3000/path', 'http://user:pass@localhost:3000', 'ftp://localhost:3000'])('rejects %s', async origin => {
  m.headers.mockResolvedValue(new Headers({ host: 'localhost:3000', ...(origin ? { origin } : {}) }));
  await expect(walletActionOrigin()).rejects.toThrow('Open payment settings');
});
