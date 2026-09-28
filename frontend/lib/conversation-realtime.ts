/** @fileOverview Private realtime carries invalidations, never message bodies or image URLs. @stability active */
import 'server-only';
import { dbPrisma } from '@/lib/db';
import { authorizedChannelTarget, scopeChannel } from '@/lib/pusher-channel';
export async function realtimePublication(channel: string, event: string, data: unknown) {
  const scoped = scopeChannel(channel);
  const target = authorizedChannelTarget(scoped);
  if (target?.kind === 'conversation') {
    // Never publish message bodies, even for public threads: visibility can
    // change between a database read and delivery to an already-open socket.
    if (['new-message', 'edit-message', 'delete-message', 'conversation-updated'].includes(event)) return { channel: scoped, event: 'conversation-updated', data: {} };
    const conversation = await dbPrisma.conversation.findUnique({ where: { id: target.id }, select: { visibility: true, deletionVisibility: true, deletionRequestedAt: true } });
    if (!conversation) throw new Error('Realtime conversation unavailable');
    // Already-authorized sockets may outlive membership. They get no new private
    // content; the receiving browser must re-read the authenticated HTTP route.
    if (conversation.visibility !== 'PUBLIC' || (conversation.deletionRequestedAt && conversation.deletionVisibility === 'PRIVATE')) return { channel: scoped, event: 'conversation-updated', data: {} };
    // Public statistics are allowlisted; unknown event payloads fail closed.
    const fields: Record<string, string[]> = {
      'pulse-stats-update': ['positivePulseCount', 'negativePulseCount'],
      'view-update': ['viewCount', 'uniqueViewCount'], 'repost-update': ['repostCount'],
      'vibe-heartbeat-update': ['heartbeatCount'], 'vibe-repost-update': ['repostCount'],
    };
    if (!fields[event] || !data || typeof data !== 'object') return { channel: scoped, event: 'conversation-updated', data: {} };
    const source = data as Record<string, unknown>;
    const safe: Record<string, unknown> = { conversationId: target.id };
    for (const field of fields[event]) if (typeof source[field] === 'number' && Number.isSafeInteger(source[field]) && Number(source[field]) >= 0) safe[field] = source[field];
    if (event.startsWith('vibe-') && typeof source.messageId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(source.messageId)) safe.messageId = source.messageId;
    return { channel: scoped, event, data: safe };
  }
  if (target?.kind === 'user') return { channel: scoped, event, data: {} };
  return { channel: scoped, event, data };
}
