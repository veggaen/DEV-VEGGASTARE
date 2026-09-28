/** @fileOverview Regression coverage for storage proxy, session, ownership and write boundaries. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const rate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: rate, getClientIdentifier: () => 'qa', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { createStorageRequestHandler, storageContextMatchesSession } from './storage-request-policy';
const url = 'https://files.edgestore.dev/project/digitalAssets/viewer/file.txt';
const request = (operation: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => new NextRequest('https://app.example/api/edgestore/' + operation, { method, headers: { Cookie: 'authjs.session-token=never-forward; edgestore-token=stale-context', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
const authenticate = vi.fn(), handler = vi.fn(), fetchOwnedFile = vi.fn(), getFile = vi.fn();
const guarded = createStorageRequestHandler({ authenticate, handler, fetchOwnedFile, getFile });
beforeEach(() => { vi.resetAllMocks(); rate.mockResolvedValue({ success: true }); authenticate.mockResolvedValue({ user: { id: 'viewer', role: 'USER' } }); handler.mockImplementation(async () => new Response('{}')); fetchOwnedFile.mockImplementation(async () => new Response('image', { headers: { 'Content-Type': 'image/png' } })); getFile.mockResolvedValue({ path: {}, metadata: { owner: 'viewer' } }); });

describe('storage proxy', () => {
  it('requires fresh auth even if old storage cookies remain', async () => {
    authenticate.mockResolvedValue(null);
    expect((await guarded(request('proxy-file?url=' + encodeURIComponent(url)))).status).toBe(401);
    expect((await guarded(request('request-upload', {}))).status).toBe(401);
    expect(fetchOwnedFile).not.toHaveBeenCalled(); expect(handler).not.toHaveBeenCalled();
  });
  it.each(['https://evil.example/file', 'http://127.0.0.1/file', 'http://169.254.169.254/', 'https://files.edgestore.dev.evil.example/x', 'https://user:pass@files.edgestore.dev/x', 'https://files.edgestore.dev/x?token=secret', 'https://files.edgestore.dev:8443/x'])('denies unsafe destination %s before fetching', async target => {
    expect((await guarded(request('proxy-file?url=' + encodeURIComponent(target)))).status).toBe(400); expect(fetchOwnedFile).not.toHaveBeenCalled(); expect(handler).not.toHaveBeenCalled();
  });
  it('uses current identity rather than forwarding browser credentials', async () => {
    const result = await guarded(request('proxy-file?url=' + encodeURIComponent(url)));
    expect(fetchOwnedFile).toHaveBeenCalledExactlyOnceWith(url, 'viewer'); expect(handler).not.toHaveBeenCalled();
    expect(await result.text()).toBe('image'); expect(result.headers.get('Cache-Control')).toBe('private, no-store'); expect(result.headers.get('Content-Disposition')).toBe('inline'); expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
  it('does not render active uploaded content on the application origin', async () => {
    fetchOwnedFile.mockResolvedValue(new Response('<script>bad()</script>', { headers: { 'Content-Type': 'text/html' } }));
    const result = await guarded(request('proxy-file?url=' + encodeURIComponent(url)));
    expect(result.headers.get('Content-Disposition')).toBe('attachment'); expect(result.headers.get('Content-Security-Policy')).toContain("sandbox; default-src 'none'");
  });
  it('preserves private-file denial rather than escalating to a storage admin', async () => {
    fetchOwnedFile.mockResolvedValue(new Response('private', { status: 403 })); expect((await guarded(request('proxy-file?url=' + encodeURIComponent(url)))).status).toBe(403);
  });
});
describe('storage writes', () => {
  const upload = { bucketName: 'myPublicImages', fileInfo: { extension: 'png', type: 'image/png', size: 300 } };
  it('permits bounded signed-in requests and keeps anonymous init available', async () => {
    expect((await guarded(request('request-upload', upload))).status).toBe(200);
    authenticate.mockResolvedValue(null); expect((await guarded(request('init', {}))).status).toBe(200); expect(handler).toHaveBeenCalledTimes(2);
  });
  it('blocks demo writes, GET mutations and cross-origin POSTs', async () => {
    authenticate.mockResolvedValue({ user: { id: 'demo_qa' } }); expect((await guarded(request('request-upload', upload))).status).toBe(403);
    authenticate.mockResolvedValue({ user: { id: 'viewer' } }); expect((await guarded(request('request-upload'))).status).toBe(405);
    const cross = request('request-upload', upload); cross.headers.set('origin', 'https://evil.example'); expect((await guarded(cross)).status).toBe(403); expect(handler).not.toHaveBeenCalled();
  });
  it.each([{ ...upload, fileInfo: { ...upload.fileInfo, fileName: '../../another-file' } }, { ...upload, fileInfo: { ...upload.fileInfo, replaceTargetUrl: url } }, { ...upload, fileInfo: { ...upload.fileInfo, size: -1 } }, { ...upload, fileInfo: { ...upload.fileInfo, extension: '../png' } }, { ...upload, bucketName: 'unknown' }, '{'])('rejects malformed or destructive upload options', async data => {
    expect((await guarded(request('request-upload', data))).status).toBe(400); expect(handler).not.toHaveBeenCalled();
  });
  it('checks ownership on confirmations and multipart continuation', async () => {
    getFile.mockResolvedValue({ path: { owner: 'foreign' }, metadata: {} });
    expect((await guarded(request('confirm-upload', { bucketName: 'digitalAssets', url }))).status).toBe(403);
    expect((await guarded(request('request-upload-parts', { path: 'project/digitalAssets/foreign/file.txt', multipart: { uploadId: 'test-upload', parts: [1] } }))).status).toBe(403);
    expect((await guarded(request('complete-multipart-upload', { bucketName: 'digitalAssets', key: 'project/digitalAssets/foreign/file.txt', uploadId: 'test-upload', parts: [{ partNumber: 1, eTag: 'test-etag' }] }))).status).toBe(403); expect(handler).not.toHaveBeenCalled();
  });
  it('accepts legacy private owner paths but rejects unattributed and mismatched files', async () => {
    getFile.mockResolvedValue({ path: { owner: 'viewer' }, metadata: {} }); expect((await guarded(request('confirm-upload', { bucketName: 'digitalAssets', url }))).status).toBe(200);
    getFile.mockResolvedValue({ path: {}, metadata: {} }); expect((await guarded(request('confirm-upload', { bucketName: 'digitalAssets', url }))).status).toBe(403);
    expect((await guarded(request('confirm-upload', { bucketName: 'myPublicImages', url }))).status).toBe(400);
    getFile.mockResolvedValue({ path: {}, metadata: { owner: 'viewer' } }); expect((await guarded(request('delete-file', { bucketName: 'digitalAssets', url }))).status).toBe(403);
  });
  it('rate limits before invoking storage and rejects oversized/unknown requests', async () => {
    rate.mockResolvedValue({ success: false }); expect((await guarded(request('request-upload', upload))).status).toBe(429); expect(handler).not.toHaveBeenCalled();
    rate.mockResolvedValue({ success: true }); expect((await guarded(request('request-upload', ' '.repeat(65_537)))).status).toBe(413); expect((await guarded(request('nested/init', {}))).status).toBe(404);
  });
  it('requires the storage context and current non-demo identity to match', () => {
    expect(storageContextMatchesSession('viewer', 'viewer')).toBe(true);
    for (const identity of [undefined, 'other-user', 'demo_qa']) expect(storageContextMatchesSession('viewer', identity)).toBe(false);
    expect(storageContextMatchesSession('demo_qa', 'demo_qa')).toBe(false);
  });
});
