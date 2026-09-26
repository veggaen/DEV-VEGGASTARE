/** @fileOverview Atomic, private and retry-safe conversation creation. @stability active */
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ConversationType, ConversationVisibility, ReplyPermission, type Prisma } from '@/generated/prisma/browser';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isDemoUserId } from '@/lib/demo-policy';
import { canReplyToConversation, canViewConversation } from '@/lib/conversation-permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { allowConversationCreate } from '@/lib/auth-rate-limit';
import { pusherServer } from '@/lib/pusher';
import { resolveVisibleEmail } from '@/lib/email-visibility';
import { ConversationAdminResponseSchema } from '@/lib/types/conversations';
import { MessageError, messageBody, messageFailure, messageReply, sameMessageOrigin } from '@/lib/message-request';

const recipient = z.string().trim().min(1).max(200);
const image = z.string().max(2048).url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'files.edgestore.dev' && !url.username && !url.password && !url.port;
});
const schema = z.object({
  title: z.string().trim().max(200).nullish(), description: z.string().trim().max(2000).nullish(),
  participants: z.array(recipient).max(50).default([]),
  type: z.nativeEnum(ConversationType).default('PRIVATE_DM'),
  visibility: z.nativeEnum(ConversationVisibility).default('PARTICIPANTS'),
  replyPermission: z.nativeEnum(ReplyPermission).default('PARTICIPANTS'),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  allowedRoles: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  customViewers: z.array(recipient).max(200).default([]), visibleToUserIds: z.array(recipient).max(200).default([]),
  initialMessage: z.string().trim().max(5000).nullish(), initialImageUrl: image.nullish(),
  pollQuestion: z.string().trim().max(500).nullish(),
  // Older Pulse clients link this through the separately authorized poll endpoint.
  advancedPollId: recipient.optional(), requestId: z.string().uuid().optional(),
}).strict();
const creatorInclude = { User: { select: { id: true, name: true, email: true, emailDisplayMode: true, image: true } } } as const;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function fail(message: string, status: number): never { throw new MessageError(message, status); }

export async function createConversation(request: Request) {
  try {
    const session = await MyLibUserAuth();
    if (!session?.id) return messageReply({ message: 'Sign in to start a conversation.' }, 401);
    sameMessageOrigin(request);
    if (session.isImpersonating || session.isDemo || isDemoUserId(session.id)) return messageReply({ message: 'Messaging is read-only in this session.' }, 403);
    const burst = await checkRateLimit(`conversation-create:${session.id}`, 'message');
    if (!burst.success || !await allowConversationCreate(session.id, request)) return messageReply({ message: 'Please wait a few minutes before starting another conversation.' }, 429);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return messageReply({ message: 'Send a JSON conversation.' }, 415);
    let raw: unknown;
    const body = await messageBody(request);
    try { raw = JSON.parse(body); } catch { return messageReply({ message: 'Invalid conversation.' }, 400); }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return messageReply({ message: 'Review the recipients, message and visibility.' }, 400);
    const { requestId = randomUUID(), ...input } = parsed.data;
    if (input.type === 'PRIVATE_DM' && (input.visibility !== 'PARTICIPANTS' || input.customViewers.length || input.visibleToUserIds.length || input.allowedRoles.length)) fail('Direct messages are visible only to their participants.', 400);
    if (input.type === 'GROUP' && input.visibility !== 'PARTICIPANTS') fail('Group chats are visible only to their participants.', 400);
    if (input.initialImageUrl && (input.visibility !== 'PUBLIC' || input.type === 'PRIVATE_DM')) fail('Private-chat image uploads are temporarily unavailable. Send text instead.', 400);

    // A payload fingerprint in the ID rejects changed-payload retries without a schema change.
    // The request prefix is actor-scoped and serialized before any lookup/write.
    const attempt = digest(`${session.id}:${requestId}`).slice(0, 32);
    const prefix = `conv_${attempt}_`;
    const conversationId = prefix + digest(JSON.stringify(input)).slice(0, 32);
    const messageId = `initial_${attempt}`;
    const result = await dbPrisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`conversation-attempt:${attempt}`}, 0))`;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.id!} FOR SHARE`;
      const actor = await tx.user.findUnique({ where: { id: session.id! }, select: { id: true, role: true, tokenVersion: true } });
      if (!actor || !Number.isSafeInteger(session.sessionVersion) || actor.tokenVersion !== session.sessionVersion) fail('Your session changed. Sign in again.', 401);

      const replay = await tx.conversation.findFirst({ where: { id: { startsWith: prefix.replace(/_/g, '\\_') } }, include: creatorInclude });
      if (replay) {
        if (replay.id !== conversationId) fail('This attempt was already used. Start a new attempt for changed details.', 409);
        await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${replay.id} FOR UPDATE`;
        const current = await tx.conversation.findUnique({ where: { id: replay.id }, include: creatorInclude });
        if (!current || !canViewConversation(actor, current) || current.deletionScheduledFor) fail('Conversation unavailable.', 404);
        return { body: conversationDto(current, actor), status: 200, publicEvent: false, messageEvent: false, id: current.id };
      }

      const requested = [...new Set(input.participants)].filter(value => value !== actor.id);
      const users = requested.length ? await tx.user.findMany({
        where: { OR: requested.map(value => ({ OR: [
          { id: value },
          { email: { equals: value, mode: 'insensitive' }, ...(['OWNER', 'ADMIN'].includes(actor.role) ? {} : { emailDisplayMode: 'PRIMARY' as const }) },
        ] })) }, select: { id: true, name: true, email: true, emailDisplayMode: true },
      }) : [];
      // Do not silently discard an unavailable recipient or reveal a hidden email match.
      if (requested.some(value => !users.some(user => user.id === value || (user.email?.toLowerCase() === value.toLowerCase() && (user.emailDisplayMode === 'PRIMARY' || ['OWNER', 'ADMIN'].includes(actor.role))))) || users.some(user => user.id.startsWith('system-') || isDemoUserId(user.id))) fail('One or more recipients are unavailable. Choose them again.', 400);
      const participantIds = [...new Set(users.map(user => user.id))].filter(id => id !== actor.id);
      if (input.type === 'PRIVATE_DM' && participantIds.length !== 1) fail('Choose one recipient for a direct message.', 400);
      if (input.type === 'GROUP' && (participantIds.length < 1 || participantIds.length > 49)) fail('Choose between 1 and 49 people for a group.', 400);
      const participants = input.type === 'PUBLIC_THREAD' ? participantIds : [...participantIds, actor.id].sort();
      const content = input.initialMessage || '', imageUrl = input.initialImageUrl || null;
      const hasMessage = !!(content || imageUrl);

      if (input.type === 'PRIVATE_DM') {
        // Both initiators take the same lock; concurrent A→B / B→A starts cannot create duplicates.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`dm-pair:${JSON.stringify(participants)}`}, 0))`;
        const existing = await tx.conversation.findFirst({ where: { type: 'PRIVATE_DM', visibility: 'PARTICIPANTS', deletionRequestedAt: null, deletionScheduledFor: null,
          OR: [{ participants: { equals: participants } }, { participants: { equals: [...participants].reverse() } }],
        }, select: { id: true } });
        if (existing) {
          await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${existing.id} FOR UPDATE`;
          const current = await tx.conversation.findUnique({ where: { id: existing.id } });
          if (!current || !canViewConversation(actor, current) || current.deletionRequestedAt || current.deletionScheduledFor || current.type !== 'PRIVATE_DM' || current.visibility !== 'PARTICIPANTS' || JSON.stringify([...current.participants].sort()) !== JSON.stringify(participants)) fail('Conversation unavailable.', 404);
          let messageEvent = false;
          if (hasMessage) {
            if (!canReplyToConversation(actor, current)) fail('Replies are not available in this conversation.', 403);
            const previous = await tx.message.findUnique({ where: { id: messageId } });
            if (previous && (previous.senderId !== actor.id || previous.conversationId !== current.id || previous.content !== content || previous.imageUrl !== imageUrl)) fail('This attempt was already used. Start a new attempt for changed details.', 409);
            if (!previous) {
              const priorCount = await tx.message.count({ where: { conversationId: current.id, senderId: actor.id } });
              await tx.message.create({ data: { id: messageId, senderId: actor.id, conversationId: current.id, content, imageUrl } });
              await tx.conversation.update({ where: { id: current.id }, data: { replyCount: { increment: 1 }, lastActivityAt: new Date(),
                ...(priorCount === 0 && current.userId !== actor.id ? { uniqueRepliers: { increment: 1 } } : {}) } });
              messageEvent = true;
            }
          }
          return { body: { id: current.id, existing: true }, status: 200, publicEvent: false, messageEvent, id: current.id };
        }
      }
      const defaultTitle = content || input.pollQuestion || (input.type === 'PUBLIC_THREAD' ? 'New thread' : users.map(user => user.name || 'Veggat member').slice(0, 3).join(', '));
      const created = await tx.conversation.create({ data: {
        id: conversationId, userId: actor.id, title: input.title || defaultTitle.slice(0, 80) || 'New conversation', description: input.description || null,
        participants, type: input.type, visibility: input.visibility, replyPermission: input.replyPermission,
        tags: input.tags, allowedRoles: input.allowedRoles, customViewers: input.customViewers, visibleToUserIds: input.visibleToUserIds,
        replyCount: hasMessage ? 1 : 0,
        ...(hasMessage ? { Message: { create: { id: messageId, senderId: actor.id, content, imageUrl } } } : {}),
      }, include: creatorInclude });
      // Validate the response before committing so a serialization failure cannot leave a half-created thread.
      return { body: conversationDto(created, actor), status: 201, publicEvent: input.type === 'PUBLIC_THREAD' && input.visibility === 'PUBLIC', messageEvent: false, id: created.id };
    }, { maxWait: 5000, timeout: 10_000 });
    try {
      if (result.publicEvent) await pusherServer.trigger('public-pulse-feed', 'new-pulse', { conversationId: result.id });
      if (result.messageEvent) await pusherServer.trigger(`ConversationChannel_${result.id}`, 'new-message', { conversationId: result.id });
    } catch { console.warn('[conversations] Saved; realtime update unavailable.'); }
    return messageReply(result.body, result.status);
  } catch (error) { return messageFailure(error); }
}

function conversationDto(created: Prisma.ConversationGetPayload<{ include: typeof creatorInclude }>, actor: { id: string; role: string }) {
  const user = { id: created.User.id, name: created.User.name, image: created.User.image,
    email: resolveVisibleEmail({ targetUserId: created.User.id, targetEmail: created.User.email, targetEmailDisplayMode: created.User.emailDisplayMode, viewerUserId: actor.id, viewerRole: actor.role }) };
  return ConversationAdminResponseSchema.parse({
    id: created.id, companyId: created.companyId, title: created.title, description: created.description, userId: created.userId,
    participants: created.participants, createdAt: created.createdAt, updatedAt: created.updatedAt, editedAt: created.editedAt,
    allowedRoles: created.allowedRoles, customViewers: created.customViewers, isLocked: created.isLocked, isPinned: created.isPinned,
    replyPermission: created.replyPermission, tags: created.tags, type: created.type, visibility: created.visibility,
    lastActivityAt: created.lastActivityAt, replyCount: created.replyCount, uniqueRepliers: created.uniqueRepliers,
    viewCount: created.viewCount, uniqueViewCount: created.uniqueViewCount, deletionRequestedAt: created.deletionRequestedAt,
    deletionScheduledFor: created.deletionScheduledFor, deletionVisibility: created.deletionVisibility, isAnonymized: created.isAnonymized,
    originalUserId: created.originalUserId, User: user, user,
  });
}
