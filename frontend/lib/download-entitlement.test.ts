/** @fileOverview Downloads require the correct session, completed order and intact private file. @stability stable */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), update: vi.fn(), storage: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { downloadToken: { findUnique: m.find, update: m.update } } }));
vi.mock('@/lib/private-download-storage', () => ({ fetchPrivateDownload: m.storage }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }), rateLimitedResponse: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
import { GET } from '@/app/api/download/[token]/route';
const bytes = Buffer.from('Real reviewer download\n');
const fixture = () => ({ id: 'token1', userId: 'buyer', isRevoked: false, expiresAt: new Date(Date.now() + 60_000), usedCount: 0, maxUses: 10,
  DigitalAsset: { isActive: true, storageKey: 'private-url', uploadedById: 'seller', fileSize: bytes.length,
    checksum: createHash('sha256').update(bytes).digest('hex'), fileName: 'notes.txt', mimeType: 'text/plain' },
  Order: { status: 'COMPLETED', CheckoutAttempt: { state: 'COMPLETED' } },
});
const download = () => GET(new Request('http://localhost:3000/api/download/fixture'), { params: Promise.resolve({ token: 'a'.repeat(64) }) });
describe('download entitlement', () => {
  beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'buyer' }); m.find.mockResolvedValue(fixture()); m.update.mockResolvedValue({}); m.storage.mockImplementation(async () => new Response(bytes)); });
  it('serves only an intact file to the entitled buyer', async () => {
    const response = await download(); expect(response.status).toBe(200); expect(await response.text()).toBe(bytes.toString());
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(m.storage).toHaveBeenCalledWith('private-url', 'seller');
    expect(m.update.mock.calls[0][0].where.isRevoked).toBe(false);
  });
  it.each([undefined, { id: 'another-buyer' }])('denies the wrong session without retrieving private bytes', async session => {
    m.auth.mockResolvedValue(session); expect((await download()).status).toBe(session ? 403 : 401); expect(m.storage).not.toHaveBeenCalled();
  });
  it.each(['PENDING', 'CANCELLED'])('denies an order in %s', async status => {
    m.find.mockResolvedValue({ ...fixture(), Order: { status, CheckoutAttempt: null } });
    expect((await download()).status).toBe(403); expect(m.storage).not.toHaveBeenCalled();
  });
  it.each(['REFUNDED', 'REVERSED', 'PAYMENT_REVIEW'])('denies %s even if a stale order still says completed', async state => {
    m.find.mockResolvedValue({ ...fixture(), Order: { status: 'COMPLETED', CheckoutAttempt: { state } } });
    expect((await download()).status).toBe(403);
  });
  it('denies revoked and expired tokens', async () => {
    m.find.mockResolvedValue({ ...fixture(), isRevoked: true }); expect((await download()).status).toBe(403);
    m.find.mockResolvedValue({ ...fixture(), expiresAt: new Date(0) }); expect((await download()).status).toBe(410);
    expect(m.storage).not.toHaveBeenCalled();
  });
  it('does not consume a token when file integrity fails', async () => {
    m.storage.mockResolvedValue(new Response('corrupted')); expect((await download()).status).toBe(502); expect(m.update).not.toHaveBeenCalled();
  });
});
