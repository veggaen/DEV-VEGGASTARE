/** @fileOverview Verified private-file registration and tenant-scoped asset reads. @stability stable */
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { initEdgeStoreSdk } from '@edgestore/server/core';
import { isDemoUserId } from '@/lib/demo-policy';
import { canPublishForCompany } from '@/lib/product-publishing';
import { privateStorageUrl, fetchPrivateDownload } from '@/lib/private-download-storage';
import { checkRateLimit, rateLimitedResponse } from '@/lib/rate-limit';
import { hashUploadedFile } from '@/lib/uploaded-file-integrity';

export const maxDuration = 60;
const schema = z.object({
  fileName: z.string().trim().min(1).max(255).refine(name => !/[\\/\x00-\x1f]/.test(name)),
  fileSize: z.number().int().positive().max(100 * 1024 * 1024),
  mimeType: z.string().min(1).max(100),
  fileExtension: z.string().regex(/^\.?[a-zA-Z0-9]{1,16}$/),
  storageKey: z.string().max(2048),
  checksum: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  companyId: z.string().min(1).max(200).optional(),
}).strict();
const select = { id: true, fileName: true, fileSize: true, mimeType: true, fileExtension: true, createdAt: true } as const;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(req: Request) {
  const user = await MyLibUserAuth();
  if (!user?.id) return json({ error: 'Sign in to upload files.' }, 401);
  if (user.isDemo || isDemoUserId(user.id)) return json({ error: 'Demo accounts cannot upload files.' }, 403);
  if (req.headers.get('origin') !== new URL(req.url).origin) return json({ error: 'Upload files from this site.' }, 403);
  const limit = await checkRateLimit('digital-register:' + user.id, 'write');
  if (!limit.success) return rateLimitedResponse(limit);
  try {
    const raw = await req.text();
    if (raw.length > 8192) return json({ error: 'File metadata is too large.' }, 413);
    let input: unknown; try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid file metadata.' }, 400); }
    const parsed = schema.safeParse(input);
    if (!parsed.success) return json({ error: 'Check the file name, size and metadata.' }, 400);
    const data = parsed.data, companyId = data.companyId || null;
    let storageKey: string;
    try { storageKey = privateStorageUrl(data.storageKey); } catch { return json({ error: 'Invalid private file location.' }, 400); }
    if (!new URL(storageKey).pathname.includes('/digitalAssets/')) return json({ error: 'Use a protected digital-file upload.' }, 400);
    if (companyId && !await canPublishForCompany(dbPrisma, user.id, companyId, true, true)) return json({ error: 'No permission to upload for this company.' }, 403);
    const file = await initEdgeStoreSdk({}).getFile({ url: storageKey });
    if (file.metadata.owner !== undefined && file.metadata.owner !== user.id || file.path.owner !== user.id) return json({ error: 'This file belongs to another account.' }, 403);
    if (file.size !== data.fileSize || file.size <= 0 || file.size > 100 * 1024 * 1024) return json({ error: 'The uploaded file size does not match. Upload it again.' }, 400);
    // Hash actual bytes; never label a random value or client claim as a checksum.
    const checksum = await hashUploadedFile(await fetchPrivateDownload(storageKey, user.id), file.size);
    if (data.checksum && data.checksum.toLowerCase() !== checksum) return json({ error: 'The file checksum does not match. Upload it again.' }, 400);
    const asset = await dbPrisma.$transaction(async tx => {
      if (companyId && !await canPublishForCompany(tx, user.id!, companyId, true, true)) return null;
      // An immutable, repeated registration returns the same id, never reassigns
      // another user's upload or changes an existing asset's company.
      const existing = await tx.digitalAsset.findUnique({ where: { storageKey }, select: { ...select, uploadedById: true, companyId: true, isActive: true } });
      if (existing) return existing.uploadedById === user.id && existing.companyId === companyId && existing.isActive
        ? Object.fromEntries(Object.keys(select).map(key => [key, existing[key as keyof typeof existing]])) : null;
      return tx.digitalAsset.create({ data: {
        fileName: data.fileName, fileSize: file.size, mimeType: data.mimeType,
        fileExtension: data.fileExtension.toLowerCase().replace(/^\./, ''),
        storageKey, storageProvider: 'EDGESTORE', checksum, uploadedById: user.id!, companyId, isActive: true,
      }, select });
    }, { isolationLevel: 'Serializable' });
    return asset ? json(asset) : json({ error: 'This file is not available to this seller.' }, 403);
  } catch {
    console.error('[digital-assets] Registration unavailable');
    return json({ error: 'File verification is temporarily unavailable. Your file has not been published; try again.' }, 503);
  }
}

export async function GET(req: Request) {
  const user = await MyLibUserAuth();
  if (!user?.id) return json({ error: 'Sign in to view your files.' }, 401);
  if (user.isDemo || isDemoUserId(user.id)) return json({ assets: [], readOnly: true });
  const companyId = new URL(req.url).searchParams.get('companyId');
  if (companyId !== null && (!companyId || companyId.length > 200)) return json({ error: 'Invalid company.' }, 400);
  const limit = await checkRateLimit('digital-list:' + user.id, 'read');
  if (!limit.success) return rateLimitedResponse(limit);
  try {
    if (companyId && !await canPublishForCompany(dbPrisma, user.id, companyId, true, true)) return json({ error: 'No access to this company’s files.' }, 403);
    const assets = await dbPrisma.digitalAsset.findMany({
      where: companyId ? { companyId, isActive: true } : { uploadedById: user.id, companyId: null, isActive: true },
      select: { ...select, updatedAt: true, Product: { select: { id: true, title: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100,
    });
    return json({ assets });
  } catch {
    console.error('[digital-assets] List unavailable');
    return json({ error: 'Files are temporarily unavailable. Try again.' }, 503);
  }
}
