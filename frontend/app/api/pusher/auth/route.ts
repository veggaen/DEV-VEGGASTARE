/** @fileOverview Authorize only current-environment channels the current viewer may read. @stability active */
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { canViewConversation } from '@/lib/conversation-permissions';
import { authorizedChannelTarget } from '@/lib/pusher-channel';
import { pusherServer } from '@/lib/pusher';
import { allowRealtimeAuthorization } from '@/lib/auth-rate-limit';
import { messageBody, messageFailure, messageReply, sameMessageOrigin } from '@/lib/message-request';
export async function POST(request: Request) {
  try {
    sameMessageOrigin(request);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) return messageReply({ message: 'Invalid authorization request.' }, 400);
    const params = new URLSearchParams(await messageBody(request, 2048));
    if ([...params.keys()].some(key => !['channel_name', 'socket_id'].includes(key) || params.getAll(key).length !== 1)) return messageReply({ message: 'Invalid authorization request.' }, 400);
    const channel = params.get('channel_name') ?? '', socket = params.get('socket_id') ?? '';
    const target = authorizedChannelTarget(channel);
    if (!target || !/^\d{1,20}\.\d{1,20}$/.test(socket)) return messageReply({ message: 'Channel unavailable.' }, 403);
    const session = await MyLibUserAuth();
    if (!await allowRealtimeAuthorization(session?.id ?? '', request)) return messageReply({ message: 'Wait a moment before reconnecting.' }, 429);
    const actor = session?.id ? await dbPrisma.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, tokenVersion: true } }) : null;
    if (session?.id && (!actor || !Number.isSafeInteger(session.sessionVersion) || actor.tokenVersion !== session.sessionVersion || session.isImpersonating)) return messageReply({ message: 'Sign in again.' }, 401);
    if (target.kind === 'user') {
      if (!actor || target.id !== actor.id) return messageReply({ message: 'Channel unavailable.' }, 403);
    } else {
      const conversation = await dbPrisma.conversation.findUnique({ where: { id: target.id } });
      if (!conversation || !canViewConversation(actor, conversation)) return messageReply({ message: 'Channel unavailable.' }, 403);
    }
    return messageReply(pusherServer.authorizeChannel(socket, channel));
  } catch (error) { return messageFailure(error); }
}
