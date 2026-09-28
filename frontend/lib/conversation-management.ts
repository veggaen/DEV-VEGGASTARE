/** @fileOverview Locked, privacy-preserving conversation administration. @stability active */
import 'server-only';
import { z } from 'zod';
import { ConversationVisibility, ReplyPermission, DeletionVisibility, type Prisma } from '@/generated/prisma/browser';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isDemoUserId } from '@/lib/demo-policy';
import { allowConversationManagement } from '@/lib/auth-rate-limit';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveVisibleEmail } from '@/lib/email-visibility';
import { ConversationAdminResponseSchema } from '@/lib/types/conversations';
import { calculateDeletionDate, canDeleteImmediately, checkSuspiciousVelocity, getReachLevel } from '@/lib/conversation-deletion';
import { pusherServer } from '@/lib/pusher';
import { MessageError, messageBody, messageFailure, messageReply, sameMessageOrigin } from '@/lib/message-request';

const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const targetIds = z.array(idSchema).max(200);
const patchSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: z.nativeEnum(ConversationVisibility).optional(),
  replyPermission: z.nativeEnum(ReplyPermission).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  isPinned: z.boolean().optional(), isLocked: z.boolean().optional(),
  visibleToUserIds: targetIds.optional(), visibleToGroupIds: targetIds.max(50).optional(), customViewers: targetIds.optional(),
}).strict().refine(value => Object.keys(value).length > 0);
const booleanQuery = z.enum(['true', 'false']).default('false').transform(value => value === 'true');
const deleteSchema = z.object({
  visibility: z.nativeEnum(DeletionVisibility).optional(), force: booleanQuery, cancel: booleanQuery,
}).strict().refine(value => !(value.force && value.cancel));
const creatorInclude = { User: { select: { id: true, name: true, email: true, emailDisplayMode: true, image: true } } } as const;
type ManagedConversation = Prisma.ConversationGetPayload<{ include: typeof creatorInclude }>;
type Actor = { id: string; role: string };
type Context = { params: Promise<{ id: string }> };
type Operation = 'read' | 'edit' | 'delete';
function fail(message: string, status: number): never { throw new MessageError(message, status); }
const isAdmin = (actor: Actor) => actor.role === 'ADMIN' || actor.role === 'OWNER';

// Explicit allowlist: adding a Prisma field must never automatically expose it.
const dtoFields = [
  'id', 'companyId', 'title', 'description', 'userId', 'participants', 'createdAt', 'updatedAt', 'editedAt',
  'allowedRoles', 'customViewers', 'isLocked', 'isPinned', 'replyPermission', 'tags', 'type', 'visibility',
  'lastActivityAt', 'replyCount', 'uniqueRepliers', 'viewCount', 'uniqueViewCount', 'deletionRequestedAt',
  'deletionScheduledFor', 'deletionVisibility', 'isAnonymized', 'originalUserId', 'suspiciousActivity',
  'suspiciousReason', 'repostOfConversationId', 'uniqueIpCount', 'loggedInViewCount', 'anonymousViewCount',
  'reachScore', 'positivePulseCount', 'negativePulseCount', 'repulseCount',
] as const;
function dto(conversation: ManagedConversation, actor: Actor) {
  const creator = conversation.User;
  const user = { id: creator.id, name: creator.name, image: creator.image,
    email: resolveVisibleEmail({ targetUserId: creator.id, targetEmail: creator.email,
      targetEmailDisplayMode: creator.emailDisplayMode, viewerUserId: actor.id, viewerRole: actor.role }) };
  return ConversationAdminResponseSchema.parse({
    ...Object.fromEntries(dtoFields.map(key => [key, conversation[key]])), User: user, user,
  });
}

async function parsePatch(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail('Send JSON changes.', 415);
  const text = await messageBody(request);
  let body: unknown;
  try { body = JSON.parse(text); } catch { fail('Invalid changes.', 400); }
  const result = patchSchema.safeParse(body);
  if (!result.success) fail('Review the conversation details.', 400);
  return result.data;
}

function parseDelete(request: Request) {
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => query.getAll(key).length > 1)) fail('Invalid deletion options.', 400);
  const result = deleteSchema.safeParse(Object.fromEntries(query));
  if (!result.success) fail('Invalid deletion options.', 400);
  return result.data;
}

function scheduledReply(conversation: ManagedConversation) {
  return { message: 'Deletion scheduled', scheduled: true, reachLevel: getReachLevel(conversation),
    deletionScheduledFor: conversation.deletionScheduledFor!.toISOString(),
    visibility: conversation.deletionVisibility, anonymized: conversation.isAnonymized };
}

async function editConversation(tx: Prisma.TransactionClient, conversation: ManagedConversation, actor: Actor, input: z.infer<typeof patchSchema>) {
  if (conversation.deletionRequestedAt || conversation.deletionScheduledFor) fail('Cancel the pending deletion before editing.', 409);
  if (!isAdmin(actor) && (input.isPinned !== undefined || input.isLocked !== undefined)) fail('Only moderators can pin or lock conversations.', 403);
  if (conversation.type === 'PRIVATE_DM' || conversation.type === 'GROUP') {
    if ((input.visibility !== undefined && input.visibility !== 'PARTICIPANTS') || input.customViewers?.length || input.visibleToUserIds?.length || input.visibleToGroupIds?.length) {
      fail('Private conversations must remain visible only to their participants.', 400);
    }
  }
  const data: Prisma.ConversationUpdateInput = { ...input };
  if (input.title !== undefined) data.title = input.title || null;
  if (input.description !== undefined) data.description = input.description || null;
  if ((input.title !== undefined && data.title !== conversation.title) || (input.description !== undefined && data.description !== conversation.description)) data.editedAt = new Date();
  const updated = await tx.conversation.update({ where: { id: conversation.id }, data, include: creatorInclude });
  // Validate inside the transaction: an invalid response must roll the write back.
  return { body: dto(updated, actor), changed: true };
}

async function deleteConversation(tx: Prisma.TransactionClient, conversation: ManagedConversation, actor: Actor, input: z.infer<typeof deleteSchema>) {
  if (input.force && !isAdmin(actor)) fail('Only moderators can bypass the deletion period.', 403);
  if (input.cancel) {
    if (!conversation.deletionRequestedAt && !conversation.deletionScheduledFor) return { body: { message: 'Deletion cancelled', restored: true }, changed: false };
    if (conversation.deletionScheduledFor && conversation.deletionScheduledFor <= new Date()) fail('The cancellation period has ended.', 409);
    await tx.conversation.update({ where: { id: conversation.id }, data: {
      deletionRequestedAt: null, deletionScheduledFor: null, deletionVisibility: 'PRIVATE', isAnonymized: false,
      userId: conversation.originalUserId || conversation.userId, originalUserId: null,
    } });
    return { body: { message: 'Deletion cancelled', restored: true }, changed: true };
  }
  if (!input.force && conversation.deletionScheduledFor) return { body: scheduledReply(conversation), changed: false };
  if (input.force || canDeleteImmediately(conversation)) {
    await tx.conversation.delete({ where: { id: conversation.id } });
    return { body: { message: 'Conversation deleted', deleted: true }, changed: true };
  }
  const velocity = checkSuspiciousVelocity(conversation);
  const updated = await tx.conversation.update({ where: { id: conversation.id }, data: {
    deletionRequestedAt: new Date(), deletionScheduledFor: calculateDeletionDate(conversation),
    // Deletion preferences cannot expose a private chat, even to former participants.
    deletionVisibility: ['PRIVATE_DM', 'GROUP'].includes(conversation.type) ? 'PRIVATE' : input.visibility || 'PRIVATE',
    isAnonymized: true, originalUserId: conversation.originalUserId || conversation.userId,
    ...(velocity.isSuspicious && !conversation.suspiciousActivity ? { suspiciousActivity: true, suspiciousReason: velocity.reason } : {}),
  }, include: creatorInclude });
  return { body: scheduledReply(updated), changed: true };
}

async function manage(request: Request, { params }: Context, operation: Operation) {
  try {
    const session = await MyLibUserAuth();
    if (!session?.id) return messageReply({ message: 'Sign in to manage conversations.' }, 401);
    const write = operation !== 'read';
    if (write) {
      sameMessageOrigin(request);
      if (session.isDemo || session.isImpersonating || isDemoUserId(session.id)) return messageReply({ message: 'Messaging is read-only in this session.' }, 403);
      const burst = await checkRateLimit(`conversation-manage:${session.id}`, 'message');
      if (!burst.success || !await allowConversationManagement(session.id, request)) return messageReply({ message: 'Please wait a moment before trying again.' }, 429);
    }
    const { id } = await params;
    if (!idSchema.safeParse(id).success) return messageReply({ message: 'Conversation unavailable.' }, 404);
    const patch = operation === 'edit' ? await parsePatch(request) : null;
    const deletion = operation === 'delete' ? parseDelete(request) : null;
    const result = await dbPrisma.$transaction(async tx => {
      // All messaging writes use the same identity → conversation lock order.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.id!} FOR SHARE`;
      const actor = await tx.user.findUnique({ where: { id: session.id! }, select: { id: true, role: true, tokenVersion: true } });
      if (!actor || !Number.isSafeInteger(session.sessionVersion) || actor.tokenVersion !== session.sessionVersion) fail('Your session changed. Sign in again.', 401);
      if (write) await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id} FOR UPDATE`;
      else await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id} FOR SHARE`;
      const conversation = await tx.conversation.findUnique({ where: { id }, include: creatorInclude });
      // DELETE is idempotent after a lost response. No record or ownership data is disclosed.
      if (!conversation && deletion && !deletion.cancel) return { body: { message: 'Conversation deleted', deleted: true }, changed: false };
      if (!conversation || (!isAdmin(actor) && conversation.userId !== actor.id && !(conversation.deletionRequestedAt && conversation.originalUserId === actor.id))) fail('Conversation unavailable.', 404);
      if (patch) return editConversation(tx, conversation, actor, patch);
      if (deletion) return deleteConversation(tx, conversation, actor, deletion);
      return { body: dto(conversation, actor), changed: false };
    }, { maxWait: 5000, timeout: 10_000 });
    if (result.changed) {
      // Invalidation only: no title, participants, or content on stale sockets.
      try { await pusherServer.trigger(`ConversationChannel_${id}`, 'conversation-updated', {}); }
      catch { console.warn('[conversations] Saved; realtime update unavailable.'); }
    }
    return messageReply(result.body);
  } catch (error) { return messageFailure(error); }
}

export const readManagedConversation = (request: Request, context: Context) => manage(request, context, 'read');
export const updateManagedConversation = (request: Request, context: Context) => manage(request, context, 'edit');
export const deleteManagedConversation = (request: Request, context: Context) => manage(request, context, 'delete');
