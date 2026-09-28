import { isCronAuthorized } from '@/lib/cron-auth';
import { mediaMaintenance } from '@/lib/ai-media/service';
import { chatImageMaintenance } from '@/lib/ai-chat/image-maintenance';
export const maxDuration = 180;
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!isCronAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  try { return Response.json({ ...await mediaMaintenance(), chatImages: await chatImageMaintenance() }, { headers }); }
  catch { return Response.json({ error: 'Media reconciliation deferred' }, { status: 503, headers }); }
}
