import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonOrError } from '@/lib/api-validate';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';

const LOG_PREFIX = '[frontend/app/api/pusher/route.ts]';

export const dynamic = 'force-dynamic';

const postBodySchema = z.object({
  channel: z.string().min(1).max(200),
  event: z.string().min(1).max(200),
  data: z.unknown(),
});

export async function POST(req: Request) {
  const sessionUser = await MyLibUserAuth();
  if (!sessionUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const role = (sessionUser as any).role as string | undefined;
  if (role !== 'ADMIN' && role !== 'OWNER') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(req, postBodySchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { channel, event, data } = bodyResult.data;

  try {
    console.log(LOG_PREFIX, 'Triggering event:', event, 'on channel:', channel);
    await pusherServer.trigger(channel, event, data);
    return NextResponse.json({ message: 'Event triggered successfully' }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error triggering event:', error);
    return NextResponse.json({ message: 'Error triggering event' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}