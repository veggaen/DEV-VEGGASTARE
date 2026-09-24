/** @fileOverview Private upload registration, cross-tenant reads and integrity boundaries. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ user: vi.fn(), rate: vi.fn(), company: vi.fn(), file: vi.fn(), download: vi.fn(), create: vi.fn(), existing: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.user }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate, rateLimitedResponse: () => new Response(null, { status: 429 }) }));
vi.mock('@/lib/product-publishing', () => ({ canPublishForCompany: m.company }));
vi.mock('@edgestore/server/core', () => ({ initEdgeStoreSdk: () => ({ getFile: m.file }) }));
vi.mock('@/lib/private-download-storage', () => ({
  privateStorageUrl: (value: string) => { const url = new URL(value); if (url.protocol !== 'https:' || url.hostname !== 'files.edgestore.dev' || url.search) throw new Error('bad'); return value; },
  fetchPrivateDownload: m.download,
}));
vi.mock('@/lib/db', () => ({ dbPrisma: {
  digitalAsset: { findMany: m.list }, $transaction: (fn: (tx: unknown) => unknown) => fn({ digitalAsset: { create: m.create, findUnique: m.existing } }),
} }));
import { GET, POST } from '@/app/api/digital-assets/route';
import { hashUploadedFile } from './uploaded-file-integrity';
const payload = () => ({ fileName: 'qa.txt', fileSize: 3, mimeType: 'text/plain', fileExtension: 'txt', storageKey: 'https://files.edgestore.dev/qa/digitalAssets/owner/seller/qa.txt' });
const post = (patch = {}, origin: string | null = 'http://localhost:3000') => POST(new Request('http://localhost:3000/api/digital-assets', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify({ ...payload(), ...patch }) }));
beforeEach(() => {
  vi.resetAllMocks(); m.user.mockResolvedValue({ id: 'seller', isDemo: false }); m.rate.mockResolvedValue({ success: true });
  m.company.mockResolvedValue(true); m.file.mockResolvedValue({ size: 3, metadata: { owner: 'seller' }, path: { owner: 'seller' } });
  m.download.mockImplementation(() => new Response('abc')); m.create.mockResolvedValue({ id: 'asset' }); m.existing.mockResolvedValue(null); m.list.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it('registers an owner-verified private file with a hash of real bytes, no secret response fields', async () => {
  const response = await post(); expect(response.status).toBe(200); expect(await response.json()).toEqual({ id: 'asset' });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(m.create.mock.calls[0][0].data).toMatchObject({ uploadedById: 'seller', checksum: createHash('sha256').update('abc').digest('hex') });
});
it.each([null, { id: 'demo_qa' }, { id: 'seller', isDemo: true }])('denies anonymous/demo upload %j', async user => {
  m.user.mockResolvedValue(user); expect((await post()).status).toBe(user ? 403 : 401); expect(m.file).not.toHaveBeenCalled();
});
it.each([null, 'https://other.invalid'])('requires same origin: %s', async origin => {
  expect((await post({}, origin)).status).toBe(403); expect(m.create).not.toHaveBeenCalled();
});
it('enforces the per-user write limit', async () => { m.rate.mockResolvedValue({ success: false }); expect((await post()).status).toBe(429); expect(m.file).not.toHaveBeenCalled(); });
it.each(['http://127.0.0.1/a', 'https://files.edgestore.dev/qa/myPublicImages/photo.png'])('rejects untrusted/public file location %s', async storageKey => {
  expect((await post({ storageKey })).status).toBe(400); expect(m.file).not.toHaveBeenCalled();
});
it.each([{ metadata: { owner: 'foreign' }, path: { owner: 'seller' } }, { metadata: { owner: 'seller' }, path: { owner: 'foreign' } }])('rejects a file not owned in both metadata and path %j', async file => {
  m.file.mockResolvedValue({ size: 3, ...file }); expect((await post()).status).toBe(403); expect(m.download).not.toHaveBeenCalled();
});
it('rejects size and checksum mismatches without creating a record', async () => {
  expect((await post({ fileSize: 4 })).status).toBe(400); expect((await post({ checksum: '0'.repeat(64) })).status).toBe(400); expect(m.create).not.toHaveBeenCalled();
});
it('checks company authorization before storage access and again before registration', async () => {
  m.company.mockResolvedValueOnce(true).mockResolvedValueOnce(false); expect((await post({ companyId: 'company' })).status).toBe(403);
  expect(m.company).toHaveBeenCalledTimes(2); expect(m.create).not.toHaveBeenCalled();
});
it('does not overwrite a registered file owned by a different seller/company', async () => {
  m.existing.mockResolvedValue({ id: 'asset', uploadedById: 'other', companyId: null, isActive: true });
  expect((await post()).status).toBe(403); expect(m.create).not.toHaveBeenCalled();
});
it('rejects cross-company asset enumeration and never queries their files', async () => {
  m.company.mockResolvedValue(false); expect((await GET(new Request('http://localhost:3000/api/digital-assets?companyId=foreign'))).status).toBe(403);
  expect(m.list).not.toHaveBeenCalled();
});
it('keeps personal reads bounded and private, with no storage keys', async () => {
  expect((await GET(new Request('http://localhost:3000/api/digital-assets'))).status).toBe(200);
  const query = m.list.mock.calls[0][0]; expect(query.where).toEqual({ uploadedById: 'seller', companyId: null, isActive: true });
  expect(query.take).toBe(100); expect(query.select).not.toHaveProperty('storageKey');
});
it('returns demo read-only empty assets without querying real rows', async () => {
  m.user.mockResolvedValue({ id: 'demo_qa' }); expect(await (await GET(new Request('http://localhost:3000/api/digital-assets?companyId=foreign'))).json()).toEqual({ assets: [], readOnly: true });
  expect(m.list).not.toHaveBeenCalled();
});
it('sanitizes storage failures instead of logging keys or raw SDK errors', async () => {
  m.file.mockRejectedValue(new Error('secret signed storage URL'));
  const response = await post(); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('secret');
  expect(console.error).toHaveBeenCalledExactlyOnceWith('[digital-assets] Registration unavailable');
});
it.each([2, 4, 0, 100 * 1024 * 1024 + 1])('hash verifier rejects incorrect/oversized length %s', async size => {
  await expect(hashUploadedFile(new Response('abc'), size)).rejects.toThrow();
});
