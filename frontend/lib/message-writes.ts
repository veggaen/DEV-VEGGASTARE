/** @fileOverview Authorized atomic message writes; realtime is not proof of persistence. @stability active */
import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isDemoUserId } from '@/lib/demo-policy';
import { canReplyToConversation, canViewConversation } from '@/lib/conversation-permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { allowMessageWrite } from '@/lib/auth-rate-limit';
import { pusherServer } from '@/lib/pusher';
import { MessageResponseSchema } from '@/lib/types/messages';
import { MessageError, messageBody, messageFailure, messageReply, sameMessageOrigin } from '@/lib/message-request';

const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const imageSchema = z.string().max(2048).url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'files.edgestore.dev' && !url.username && !url.password && !url.port;
}, 'Upload an image using the attachment control.');
const bodySchema = z.object({
  conversationId: idSchema.optional(), content: z.string().trim().max(5000).nullable().optional(),
  imageUrl: imageSchema.nullable().optional(), parentId: idSchema.nullable().optional(),
  requestId: z.string().uuid().optional(),
}).strict();
const senderInclude = { User: { select: { id: true, name: true, image: true } } } as const;
type Operation = 'create' | 'edit' | 'delete';
const fail = (text: string, status: number): never => { throw new MessageError(text, status); };

export async function writeMessage(request: Request, operation: Operation, messageId?: string) {
  try {
    const session = await MyLibUserAuth();
    if (!session?.id) return messageReply({ message: 'Sign in to send messages.' }, 401);
    sameMessageOrigin(request);
    if (session.isImpersonating || session.isDemo || isDemoUserId(session.id)) return messageReply({ message: 'Messaging is read-only in this session.' }, 403);
    if (messageId && !idSchema.safeParse(messageId).success) return messageReply({ message: 'Message not found.' }, 404);
    const burst = await checkRateLimit(`message-write:${session.id}`, 'message');
    if (!burst.success || !await allowMessageWrite(session.id, request)) return messageReply({ message: 'Too many messages. Wait a moment before retrying.' }, 429);
    let raw: unknown = {};
    if (operation !== 'delete') {
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return messageReply({ message: 'Send a JSON message.' }, 415);
      const text = await messageBody(request);
      try { raw = JSON.parse(text); } catch { return messageReply({ message: 'Invalid message.' }, 400); }
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return messageReply({ message: 'Review your message or attachment.' }, 400);
    const input = parsed.data;
    if (operation === 'create' && (!input.conversationId || !(input.content || input.imageUrl))) return messageReply({ message: 'Write a message first.' }, 400);
    if (operation === 'edit' && input.content === undefined && input.imageUrl === undefined) return messageReply({ message: 'No changes to save.' }, 400);
    if (operation === 'edit' && (input.parentId !== undefined || input.requestId !== undefined)) return messageReply({ message: 'A reply cannot be moved.' }, 400);

    const result = await dbPrisma.$transaction(async tx => {
      // Lock current identity and conversation before checking permissions or changing data.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.id!} FOR SHARE`;
      const actor = await tx.user.findUnique({ where: { id: session.id! }, select: { id: true, role: true, tokenVersion: true } });
      if (!actor || !Number.isSafeInteger(session.sessionVersion) || actor.tokenVersion !== session.sessionVersion) fail('Your session changed. Sign in again.', 401);
      const original = messageId ? await tx.message.findUnique({ where: { id: messageId } }) : null;
      if (operation !== 'create' && !original) fail('Message not found.', 404);
      const conversationId = original?.conversationId ?? input.conversationId!;
      if (original && input.conversationId && input.conversationId !== conversationId) fail('A message cannot be moved.', 400);
      await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversationId} FOR UPDATE`;
      const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation || !canViewConversation(actor!, conversation)) fail('Conversation unavailable.', 404);
      if (operation !== 'delete' && !canReplyToConversation(actor!, conversation!)) fail('Replies are not available in this conversation.', 403);
      if (operation !== 'create' && original!.senderId !== actor!.id && !['OWNER', 'ADMIN'].includes(actor!.role)) fail('You can only change your own messages.', 403);
      if (conversation!.deletionScheduledFor) fail('This conversation is scheduled for deletion.', 409);
      if ((conversation!.visibility !== 'PUBLIC' || conversation!.type === 'PRIVATE_DM') && input.imageUrl && input.imageUrl !== original?.imageUrl) fail('Private-chat image uploads are temporarily unavailable. Send text instead.', 400);

      if (operation === 'delete') {
        await tx.message.delete({ where: { id: messageId! } });
        await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date(), lastActivityAt: new Date(), replyCount: Math.max(0, conversation!.replyCount - 1) } });
        if (original!.parentId) await tx.message.updateMany({ where: { id: original!.parentId, conversationId, replyCount: { gt: 0 } }, data: { replyCount: { decrement: 1 } } });
        return { conversationId, event: 'delete-message', data: { messageId }, body: { message: 'Message deleted' }, status: 200 };
      }
      if (operation === 'create' && input.parentId) {
        const parent = await tx.message.findUnique({ where: { id: input.parentId }, select: { conversationId: true } });
        if (!parent || parent.conversationId !== conversationId) fail('Reply target unavailable.', 400);
      }
      const content = input.content ?? original?.content ?? '';
      const imageUrl = input.imageUrl === undefined ? original?.imageUrl ?? null : input.imageUrl;
      if (!content && !imageUrl) fail('A message cannot be empty.', 400);
      // Old clients still work. New clients reuse this stable ID after a lost response.
      const replayId = operation === 'create' && input.requestId ? `msg_${createHash('sha256').update(`${actor!.id}:${input.requestId}`).digest('hex').slice(0, 48)}` : undefined;
      const replay = replayId ? await tx.message.findUnique({ where: { id: replayId }, include: senderInclude }) : null;
      if (replay && (replay.senderId !== actor!.id || replay.conversationId !== conversationId || replay.content !== content || replay.imageUrl !== imageUrl || replay.parentId !== (input.parentId ?? null))) fail('This send attempt has already been used. Refresh before sending again.', 409);
      const message = replay ?? (operation === 'edit'
        ? await tx.message.update({ where: { id: messageId! }, data: { content, imageUrl, editedAt: new Date() }, include: senderInclude })
        : await tx.message.create({ data: { ...(replayId ? { id: replayId } : {}), content, imageUrl, senderId: actor!.id, conversationId, parentId: input.parentId ?? null }, include: senderInclude }));
      if (!replay && operation === 'create') {
        const previous = await tx.message.count({ where: { conversationId, senderId: actor!.id, id: { not: message.id } } });
        await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date(), lastActivityAt: new Date(), replyCount: { increment: 1 }, ...(previous === 0 && actor!.id !== conversation!.userId ? { uniqueRepliers: { increment: 1 } } : {}) } });
        if (input.parentId) await tx.message.update({ where: { id: input.parentId }, data: { replyCount: { increment: 1 } } });
      }
      const dto = MessageResponseSchema.parse({ id: message.id, content: message.content, imageUrl: message.imageUrl, senderId: message.senderId, conversationId, createdAt: message.createdAt, editedAt: message.editedAt, parentId: message.parentId, User: message.User, sender: message.User });
      return { conversationId, event: operation === 'edit' ? 'edit-message' : 'new-message', data: operation === 'edit' ? { messageId: message.id, content: message.content, imageUrl: message.imageUrl, editedAt: message.editedAt } : { conversationId, message: dto }, body: dto, status: replay ? 200 : operation === 'create' ? 201 : 200 };
    }, { maxWait: 5000, timeout: 10_000 });
    // Persistence is committed. A realtime outage must never invite duplicate sends.
    try { await pusherServer.trigger(`ConversationChannel_${result.conversationId}`, result.event, result.data); }
    catch { console.warn('[messages] Saved; realtime update unavailable.'); }
    return messageReply(result.body, result.status);
  } catch (error) { return messageFailure(error); }
}
