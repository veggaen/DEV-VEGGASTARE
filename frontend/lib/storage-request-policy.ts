/** @fileOverview Fresh-auth and ownership boundary around storage SDK operations. @stability stable */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isDemoUserId } from '@/lib/demo-policy';
import { privateStorageUrl } from '@/lib/private-download-storage';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';

type StorageSession = { user?: { id?: string; role?: string } } | null;
type StoredFile = { path: Record<string, string>; metadata: Record<string, string> };
type Dependencies = {
  authenticate: () => Promise<StorageSession>;
  handler: (request: NextRequest) => Promise<Response>;
  fetchOwnedFile: (url: string, userId: string) => Promise<Response>;
  getFile: (url: string) => Promise<StoredFile>;
};
const bucket = z.enum(['myPublicImages', 'digitalAssets']);
const upload = z.object({ bucketName: bucket, fileInfo: z.object({
  extension: z.string().regex(/^[a-zA-Z0-9]{1,16}$/), type: z.string().max(120),
  size: z.number().int().positive().max(100 * 1024 * 1024), temporary: z.boolean().optional(),
  // No current app flow needs overwrite/replacement. These can otherwise delete
  // an existing object through the SDK without invoking its beforeDelete hook.
  fileName: z.never().optional(), replaceTargetUrl: z.never().optional(),
}).strict(), input: z.unknown().optional() }).strict();
const fileAction = z.object({ bucketName: bucket, url: z.string().max(2048) }).strict();
const parts = z.object({ path: z.string().min(1).max(2048), multipart: z.object({ uploadId: z.string().min(1).max(2048).optional(), parts: z.array(z.number().int().min(1).max(10_000)).min(1).max(100) }).strict() }).strict();
const complete = z.object({ bucketName: bucket, uploadId: z.string().min(1).max(2048), key: z.string().min(1).max(2048), parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10_000), eTag: z.string().min(1).max(200) }).strict()).min(1).max(100) }).strict();
const schemas = { 'request-upload': upload, 'confirm-upload': fileAction, 'delete-file': fileAction, 'request-upload-parts': parts, 'complete-multipart-upload': complete };
const error = (status: number, message: string) => NextResponse.json({ code: status === 401 ? 'UNAUTHORIZED' : 'BAD_REQUEST', message, error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export function storageContextMatchesSession(contextId: string, sessionId?: string) {
  return Boolean(sessionId && contextId === sessionId && !isDemoUserId(sessionId));
}

export function createStorageRequestHandler(deps: Dependencies) {
  return async function storageRequest(request: NextRequest): Promise<Response> {
    const operation = request.nextUrl.pathname.replace('/api/edgestore/', '');
    if (!['init', 'health', 'proxy-file', ...Object.keys(schemas)].includes(operation)) return error(404, 'Storage operation not found');
    if (operation === 'health') return new Response('OK');
    const session = await deps.authenticate(), userId = session?.user?.id;
    if (operation !== 'init' && !userId) return error(401, 'Sign in to use file storage');
    const isRead = operation === 'init' || operation === 'proxy-file';
    if (!isRead && request.method !== 'POST') return error(405, 'Use POST for this storage operation');
    if (operation === 'proxy-file' && request.method !== 'GET') return error(405, 'Use GET to read a stored file');
    if (!isRead && isDemoUserId(userId)) return error(403, 'Demo uploads are disabled');
    const origin = request.headers.get('origin');
    if (request.method !== 'GET' && origin && origin !== request.nextUrl.origin) return error(403, 'Use file storage from this site');
    const limit = await checkRateLimit('storage:' + getClientIdentifier(request, userId), isRead ? 'read' : 'write');
    if (!limit.success) return rateLimitedResponse(limit);
    try {
      if (operation === 'proxy-file') {
        let url: string;
        try { url = privateStorageUrl(request.nextUrl.searchParams.get('url') ?? ''); } catch { return error(400, 'Invalid storage location'); }
        // The SDK's generic proxy forwards every browser cookie and follows
        // redirects. Use a fresh token scoped to the current identity instead.
        const file = await deps.fetchOwnedFile(url, userId!);
        if (!file.ok) { await file.body?.cancel(); return error(file.status === 401 || file.status === 403 ? 403 : file.status === 404 ? 404 : 502, 'File is unavailable for this account'); }
        const mime = file.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
        return new Response(file.body, { headers: {
          'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "sandbox; default-src 'none'",
          'Content-Disposition': /^image\/(jpeg|png|gif|webp)$/.test(mime) ? 'inline' : 'attachment',
        } });
      }
      if (operation !== 'init') {
        const text = await request.clone().text();
        if (text.length > 65_536) return error(413, 'Storage request is too large');
        let data: unknown; try { data = JSON.parse(text); } catch { return error(400, 'Invalid storage request'); }
        const parsed = schemas[operation as keyof typeof schemas].safeParse(data);
        if (!parsed.success) return error(400, 'Invalid storage request');
        if (operation !== 'request-upload') {
          const input = parsed.data as { url?: string; key?: string; path?: string; bucketName?: string };
          let url: string;
          try { url = privateStorageUrl(input.url ?? new URL(input.key ?? input.path ?? '', 'https://files.edgestore.dev/').toString()); } catch { return error(400, 'Invalid storage location'); }
          if (input.bucketName && !new URL(url).pathname.includes('/' + input.bucketName + '/')) return error(400, 'Storage bucket mismatch');
          const file = await deps.getFile(url);
          // New public files carry owner metadata; legacy private assets have
          // the owner in their immutable path. Unattributed legacy files fail closed.
          if ((file.metadata.owner ?? file.path.owner) !== userId) return error(403, 'This file belongs to another account');
          if (operation === 'delete-file') return error(403, 'Direct file deletion is not enabled');
        }
      }
      const response = await deps.handler(request);
      response.headers.set('Cache-Control', 'private, no-store');
      if (response.status >= 500) console.error('[storage] SDK request failed', { operation, status: response.status });
      return response;
    } catch {
      // SDK errors can include signed URLs or credentials: never log the object.
      console.error('[storage] Request failed', { operation });
      return error(502, 'File storage is temporarily unavailable. Please try again.');
    }
  };
}
