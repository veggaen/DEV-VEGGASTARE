/** @fileOverview Demo bounds remain fail-closed with useful public refusal codes. @stability stable */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
// Keep the real Auth.js error class without loading Next's server runtime in Vitest.
vi.mock('next-auth', async () => ({ CredentialsSignin: (await import('@auth/core/errors')).CredentialsSignin }));
const mocks = vi.hoisted(() => ({ rate: vi.fn(), transaction: vi.fn(), count: vi.fn(), create: vi.fn(), lock: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: mocks.transaction } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.rate, getClientIdentifier: () => '192.0.2.1' }));
import { createDemoUser } from './demo-user';
import { demoLoginMessage } from './demo-login-message';
const request = new Request('http://localhost:3000');
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('AUTH_SECRET', 'test-only-secret');
  mocks.rate.mockResolvedValue({ success: true });
  mocks.transaction.mockImplementation(fn => fn({ $executeRaw: mocks.lock, user: { count: mocks.count, create: mocks.create } }));
  mocks.create.mockImplementation(({ data }) => Promise.resolve(data));
});
afterEach(() => vi.unstubAllEnvs());
test('rate refusal never reaches provisioning', async () => {
  mocks.rate.mockResolvedValue({ success: false });
  await expect(createDemoUser(request)).rejects.toMatchObject({ code: 'demo_retry_later', type: 'CredentialsSignin' });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
test.each([[5, 5, 'demo_daily_limit'], [1, 200, 'demo_capacity']])('refuses bounded counts %s/%s', async (visitor, global, code) => {
  mocks.count.mockResolvedValueOnce(visitor).mockResolvedValueOnce(global);
  await expect(createDemoUser(request)).rejects.toMatchObject({ code });
  expect(mocks.lock).toHaveBeenCalledOnce(); expect(mocks.create).not.toHaveBeenCalled();
});
test('last allowed slot creates an isolated non-admin identity after locking', async () => {
  mocks.count.mockResolvedValueOnce(4).mockResolvedValueOnce(199);
  const user = await createDemoUser(request);
  if (!user) throw new Error('Expected the last allowed demo slot');
  expect(user).toMatchObject({ role: 'USER', emailDisplayMode: 'HIDE', web3ModeEnabled: false });
  expect(user.id).toMatch(/^demo_\d{4}-\d{2}-\d{2}_[a-f0-9]{24}_/);
  expect(user.id).not.toContain('192.0.2.1');
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.count.mock.invocationCallOrder[0]);
});
test('missing configuration and database failures never provision', async () => {
  vi.stubEnv('AUTH_SECRET', ''); vi.stubEnv('NEXTAUTH_SECRET', '');
  expect(await createDemoUser(request)).toBeNull(); expect(mocks.transaction).not.toHaveBeenCalled();
  vi.stubEnv('AUTH_SECRET', 'test-only-secret'); mocks.transaction.mockRejectedValue(new Error('private database details'));
  await expect(createDemoUser(request)).rejects.toThrow(); expect(mocks.create).not.toHaveBeenCalled();
});
test('only known codes get specific public messages', () => {
  expect(demoLoginMessage('demo_daily_limit')).toContain('00:00 UTC');
  expect(demoLoginMessage('demo_capacity')).toContain('capacity');
  expect(demoLoginMessage('demo_retry_later')).toContain('Wait a minute');
  expect(demoLoginMessage('private database details')).toBe(demoLoginMessage());
});
