import { after } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { AiCreditError } from '@/lib/ai-credit-ledger';
import { aiErrorResponse } from '@/lib/ai-chat/generation';
import { guardAiRequest, readAiJson } from '@/lib/ai-chat/request';
import { prepareMedia, publicMediaJob, readMediaWorkspace, runMediaJob } from '@/lib/ai-media/service';
import { checkRateLimit } from '@/lib/rate-limit';
export const maxDuration = 180;
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  try {
    const user = await MyLibUserAuth();
    if (!user?.id) throw new AiCreditError('AI_SIGN_IN_REQUIRED', 401);
    if (!(await checkRateLimit(`ai-media-read:${user.id}`, 'analytics')).success) throw new AiCreditError('AI_RATE_LIMIT', 429);
    return Response.json(await readMediaWorkspace(user.id), { headers });
  } catch (error) { return aiErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const user = await MyLibUserAuth();
    if (!user?.id) throw new AiCreditError('AI_SIGN_IN_REQUIRED', 401);
    await guardAiRequest(request, user.id);
    const result = await prepareMedia(await readAiJson(request), user.id);
    if (result.start) after(async () => { try { await runMediaJob(result.job.id); } catch { /* Durable deadline recovery; never log prompts, files, keys or raw provider errors. */ } });
    return Response.json({ job: publicMediaJob(result.job) }, { status: result.start ? 202 : 200, headers });
  } catch (error) { return aiErrorResponse(error); }
}
