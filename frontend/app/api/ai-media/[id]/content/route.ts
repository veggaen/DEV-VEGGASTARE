import { MyLibUserAuth } from '@/lib/user-auth';
import { dbPrisma } from '@/lib/db';
import { aiCreditEnvironment } from '@/lib/ai-credit-ledger';
import { fetchPrivateDownload } from '@/lib/private-download-storage';
import { MEDIA_MAX_BYTES } from '@/lib/ai-media/policy';
import { checkRateLimit } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };
  const user = await MyLibUserAuth();
  if (!user?.id) return Response.json({ error: 'Sign in to access your media.' }, { status: 401, headers });
  const limit = await checkRateLimit(`ai-media-content:${user.id}`, 'read');
  if (!limit.success) return new Response(null, { status: 429, headers: { ...headers, 'Retry-After': String(limit.resetIn) } });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404, headers });
  const job = await dbPrisma.aiMediaJob.findFirst({ where: { id, userId: user.id, environment: aiCreditEnvironment(user.id), state: 'COMPLETED', Reservation: { state: 'COMPLETED' } } });
  if (!job?.storageKey || !job.mimeType || !job.byteSize || job.byteSize > MEDIA_MAX_BYTES) return new Response(null, { status: 404, headers });
  try {
    const file = await fetchPrivateDownload(job.storageKey, user.id);
    if (!file.ok) { await file.body?.cancel(); return new Response(null, { status: 503, headers }); }
    const extension = job.kind === 'IMAGE' ? 'png' : 'mp4';
    return new Response(file.body, { headers: { ...headers, 'Content-Type': job.mimeType,
      'Content-Length': String(job.byteSize), 'Content-Disposition': `${new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline'}; filename="veggat-${id}.${extension}"` } });
  } catch { return new Response(null, { status: 503, headers }); }
}
