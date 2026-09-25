import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), headers: vi.fn(), allow: vi.fn(), user: vi.fn(), pending: vi.fn(), create: vi.fn(), cancel: vi.fn() }));
vi.mock('next/headers', () => ({ headers: m.headers }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.allow }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: async (run: (tx: unknown) => unknown) => run({ $queryRaw: vi.fn(), user: { findUnique: m.user },
  accountDeletionRequest: { findFirst: m.pending, create: m.create, updateMany: m.cancel } }) } }));
import * as actions from './gdpr-account-deletion';
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'qa-requester' }); m.allow.mockResolvedValue(true);
  m.headers.mockResolvedValue(new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }));
  m.user.mockResolvedValue({ id: 'qa-requester' }); m.pending.mockResolvedValue(null); m.create.mockResolvedValue({ id: 'qa-request' }); m.cancel.mockResolvedValue({ count: 1 });
});
describe('account-owned erasure request boundary', () => {
  it('does not expose a hard-delete Server Action', () => {
    expect(Object.keys(actions).sort()).toEqual(['cancelAccountDeletion', 'requestAccountDeletion']);
  });
  it.each([null, { id: 'demo_person' }, { id: 'qa-person', isImpersonating: true }])('rejects actor %j', async actor => {
    m.auth.mockResolvedValue(actor);
    expect((await actions.requestAccountDeletion()).success).toBe(false); expect((await actions.cancelAccountDeletion()).success).toBe(false);
    expect(m.create).not.toHaveBeenCalled(); expect(m.cancel).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests and cancellation', async () => {
    m.headers.mockResolvedValue(new Headers({ origin: 'https://other.example', host: 'localhost:3000' }));
    expect((await actions.requestAccountDeletion()).success).toBe(false); expect((await actions.cancelAccountDeletion()).success).toBe(false); expect(m.pending).not.toHaveBeenCalled();
  });
  it('fails closed on throttling', async () => {
    m.allow.mockResolvedValue(false); expect((await actions.requestAccountDeletion()).success).toBe(false); expect(m.user).not.toHaveBeenCalled();
  });
  it('bounds untrusted reason text', async () => {
    expect((await actions.requestAccountDeletion('x'.repeat(1001))).success).toBe(false); expect(m.create).not.toHaveBeenCalled();
  });
  it('queues only the authenticated user and returns the real scheduled date', async () => {
    const before = Date.now(), result = await actions.requestAccountDeletion(' Please review ');
    expect(result).toMatchObject({ success: true, requestId: 'qa-request' });
    const scheduled = new Date(result.scheduledFor!).getTime(); expect(scheduled).toBeGreaterThanOrEqual(before + 30 * 86_400_000); expect(scheduled).toBeLessThanOrEqual(Date.now() + 30 * 86_400_000);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ userId: 'qa-requester', reason: 'Please review', status: 'PENDING' });
  });
  it('does not create duplicate requests', async () => {
    m.pending.mockResolvedValue({ id: 'existing' }); expect((await actions.requestAccountDeletion()).success).toBe(false); expect(m.create).not.toHaveBeenCalled();
  });
  it('cancels only this user’s still-pending requests', async () => {
    expect(await actions.cancelAccountDeletion()).toEqual({ success: true });
    expect(m.cancel.mock.calls[0][0]).toEqual({ where: { userId: 'qa-requester', status: 'PENDING', cancelledAt: null }, data: { status: 'CANCELLED', cancelledAt: expect.any(Date) } });
    m.cancel.mockResolvedValue({ count: 0 }); expect((await actions.cancelAccountDeletion()).success).toBe(false);
  });
  it('does not log or disclose database errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {}); m.create.mockRejectedValue(new Error('private-marker'));
    try { expect(JSON.stringify(await actions.requestAccountDeletion())).not.toContain('private-marker'); expect(spy).not.toHaveBeenCalled(); } finally { spy.mockRestore(); }
  });
});
