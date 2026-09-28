/** @fileOverview Owner-only, environment-separated credit and cost-ceiling reporting. @stability active */
import { MyLibUserAuth } from '@/lib/user-auth';
import { dbPrisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { readAiCreditReport } from '@/lib/ai-credit-report';
import { paypalEnvironment } from '@/lib/payments/showcase-policy';

const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    const user = await MyLibUserAuth();
    if (!user?.id || user.role !== 'OWNER') return Response.json({ error: 'Owner access required.' }, { status: 403, headers });
    const fresh = await dbPrisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
    if (fresh?.role !== 'OWNER') return Response.json({ error: 'Owner access required.' }, { status: 403, headers });
    const limit = await checkRateLimit('owner-ai-report:' + user.id, 'analytics');
    if (!limit.success) return Response.json({ error: 'Too many refreshes. Try again shortly.' }, { status: 429, headers: { ...headers, 'Retry-After': String(limit.resetIn) } });
    const environment = new URL(request.url).searchParams.get('environment') ?? paypalEnvironment().mode;
    if (environment !== 'LIVE' && environment !== 'SANDBOX' && environment !== 'DEMO') return Response.json({ error: 'Choose Live, Sandbox or Demo.' }, { status: 400, headers });
    return Response.json(await readAiCreditReport(environment), { headers });
  } catch {
    // Do not log ORM parameters, payer records or secrets.
    return Response.json({ error: 'Credit reporting is unavailable. Retry shortly.' }, { status: 503, headers });
  }
}
