/** @fileOverview Safe model availability and account balance, never provider secrets. @stability experimental */
import { MyLibUserAuth } from '@/lib/user-auth';
import { dbPrisma } from '@/lib/db';
import { aiCreditLedger, aiCreditEnvironment, DEMO_AI_CREDITS, AI_DAILY_REQUEST_LIMIT } from '@/lib/ai-credit-ledger';
import { isDemoUserId } from '@/lib/demo-policy';
import { FUNDED_AI_MODELS, pricingIsReviewed } from '@/lib/ai-chat/credit-policy';
import { platformAiKey, aiErrorResponse } from '@/lib/ai-chat/generation';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await MyLibUserAuth(), demo = isDemoUserId(user?.id);
    const keys = user?.id && !demo ? await dbPrisma.userAiApiKey.findMany({ where: { userId: user.id }, select: { provider: true } }) : [];
    const position = user?.id ? await aiCreditLedger.position(user.id) : { balance: 0, refundAdjustment: 0 };
    let balance = position.balance;
    if (demo && user?.id) {
      const account = await dbPrisma.aiCreditAccount.findUnique({ where: { id: `DEMO:${user.id}` }, select: { id: true } });
      // Old demo sessions get their one-time allowance on the first guarded send.
      if (!account) balance = DEMO_AI_CREDITS;
    }
    const date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const usage = user?.id ? await dbPrisma.dailyAiUsage.findUnique({ where: { userId_date: { userId: user.id, date } }, select: { count: true } }) : null;
    return Response.json({ balance, refundAdjustment: position.refundAdjustment, demo, authenticated: Boolean(user?.id), environment: aiCreditEnvironment(user?.id), dailyUsed: usage?.count ?? 0,
      dailyLimit: demo ? DEMO_AI_CREDITS : AI_DAILY_REQUEST_LIMIT, savedProviders: keys.map(key => key.provider),
      models: FUNDED_AI_MODELS.map(item => ({ provider: item.provider, model: item.model, label: item.label,
        credits: demo ? Math.max(1, item.credits) : item.credits,
        available: pricingIsReviewed() && Boolean(platformAiKey(item.provider, request)) && (Boolean(user?.id) || item.credits === 0),
      })), buyCreditsUrl: '/products/cveggatinterviewcredits01',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return aiErrorResponse(error); }
}
