import { NextRequest } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { AiCreditError, aiCreditLedger } from '@/lib/ai-credit-ledger';
import { aiErrorResponse } from '@/lib/ai-chat/generation';
import { guardAiRequest, readAiBytes } from '@/lib/ai-chat/request';
import { CHAT_IMAGE_MAX_BYTES } from '@/lib/ai-chat/image-policy';
import { normalizeChatImage } from '@/lib/ai-chat/normalize-image';
import { storeChatImage, deleteChatImage } from '@/lib/ai-chat/image-storage';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let stored: string | undefined;
  try {
    const user = await MyLibUserAuth();
    if (!user?.id || isDemoUserId(user.id)) throw new AiCreditError('IMAGE_PRIVATE_CHAT_REQUIRED', 403);
    const ownerId = user.id;
    await guardAiRequest(request, user.id);
    const parsedId = z.string().cuid().safeParse(request.nextUrl.searchParams.get('sessionId'));
    if (!parsedId.success) throw new AiCreditError('INVALID_REQUEST', 400);
    const conversationId = parsedId.data;
    const conversation = await dbPrisma.aiConversation.findFirst({ where: { id: conversationId, creatorId: user.id, isDeleted: false, isSuspended: false, isPublic: false }, select: { id: true } });
    if (!conversation) throw new AiCreditError('IMAGE_PRIVATE_CHAT_REQUIRED', 403);
    const position = await aiCreditLedger.position(user.id);
    if (position.balance < 1 && !await dbPrisma.userAiApiKey.findFirst({ where: { userId: user.id, provider: 'OPENAI' }, select: { id: true } })) throw new AiCreditError('AI_CREDITS_REQUIRED', 402);
    let image;
    try { image = await normalizeChatImage(new Uint8Array(await readAiBytes(request, CHAT_IMAGE_MAX_BYTES))); }
    catch { throw new AiCreditError('IMAGE_INVALID', 400); }
    // Serialize the small metadata reservation, never network I/O. Independent
    // storage fuses also bound failed uploads and new-account abuse.
    const row = await dbPrisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(621642901)`;
      if (!await tx.aiConversation.findFirst({ where: { id: conversationId, creatorId: user.id, isDeleted: false, isSuspended: false, isPublic: false }, select: { id: true } })) throw new AiCreditError('IMAGE_PRIVATE_CHAT_REQUIRED', 403);
      const day = new Date(Date.now() - 24 * 60 * 60_000);
      const [all, today, owner, ownerToday] = await Promise.all([
        tx.aiChatImage.count(), tx.aiChatImage.count({ where: { createdAt: { gt: day } } }),
        tx.aiChatImage.count({ where: { ownerId: user.id } }), tx.aiChatImage.count({ where: { ownerId: user.id, createdAt: { gt: day } } }),
      ]);
      if (all >= 5000 || today >= 200 || owner >= 100 || ownerToday >= 20) throw new AiCreditError('IMAGE_UPLOAD_LIMIT', 429);
      return tx.aiChatImage.create({ data: { conversationId, ownerId, width: image.width, height: image.height }, select: { id: true, width: true, height: true } });
    });
    stored = await storeChatImage(user.id, image.bytes);
    await dbPrisma.aiChatImage.update({ where: { id: row.id }, data: { storageKey: stored } });
    stored = undefined;
    return Response.json(row, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (stored) await deleteChatImage(stored).catch(() => undefined);
    return aiErrorResponse(error);
  }
}
