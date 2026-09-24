/** @fileOverview Public cron requests cannot reach database mutations. @stability stable */
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ process: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: new Proxy({}, { get: () => { throw new Error('Unauthorized database access'); } }) }));
vi.mock('@/lib/payments/email-dispatch', () => ({ processTransactionEmailBatch: m.process }));
import { GET as reachGet, POST as reachPost } from '@/app/api/cron/reach-decay/route';
import { POST as dailyPost } from '@/app/api/cron/daily-poll/route';
import { GET as emailGet } from '@/app/api/cron/transactional-email/route';
afterEach(() => vi.unstubAllEnvs());
it.each([reachGet, reachPost, dailyPost, emailGet])('fails closed before any work without CRON_SECRET', async handler => {
  vi.stubEnv('CRON_SECRET', '');
  expect((await handler(new Request('https://veggat.com/api/cron/test'))).status).toBe(401);
  vi.stubEnv('CRON_SECRET', 'correct-secret-for-test');
  expect((await handler(new Request('https://veggat.com/api/cron/test', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401);
  expect(m.process).not.toHaveBeenCalled();
});
