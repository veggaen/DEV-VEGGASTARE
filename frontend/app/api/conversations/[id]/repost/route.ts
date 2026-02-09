import { dbPrisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ConversationRepostDeleteResponseSchema,
  ConversationRepostPostResponseSchema,
} from '@/lib/types/conversations';
import { propagateEcho } from '@/lib/reach/echo-propagation';
import { calculateEngagementStrength } from '@/lib/reach/engagement-strength';

const LOG_PREFIX = '[api/conversations/[id]/repost]';

/**
 * Broadcast repost count update via Pusher (fire-and-forget)
 */
async function broadcastRepostUpdate(conversationId: string) {
  const repostCount = await dbPrisma.conversationRepost.count({
    where: { conversationId },
  });
  
  pusherServer.trigger(`ConversationChannel_${conversationId}`, 'repost-update', {
    conversationId,
    repostCount,
  }).catch((err) => {
    console.error(`${LOG_PREFIX} Pusher broadcast failed:`, err);
  });
}
const isDev = process.env.NODE_ENV !== 'production';

const postBodySchema = z
  .object({
    mode: z.enum(['repost', 'quote']).default('repost'),
    text: z.string().trim().max(5000).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === 'quote') {
      const text = val.text?.trim() || '';
      if (!text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'text is required for quote repost',
          path: ['text'],
        });
      }
    }
  });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  const session = await MyLibUserAuth();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized ID' }, { status: 401 });
  }

  const bodyResult = await parseJsonOrError(req, postBodySchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { mode, text } = bodyResult.data;

  try {
    const original = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, visibility: true, type: true, isLocked: true },
    });

    if (!original) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // For now we only allow reposting public threads.
    if (original.visibility !== 'PUBLIC') {
      return NextResponse.json({ message: 'Only public posts can be reposted' }, { status: 403 });
    }

    if (mode === 'repost') {
      await dbPrisma.conversationRepost.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        create: { conversationId, userId },
        update: {},
      });

      // Broadcast real-time repost count update
      broadcastRepostUpdate(conversationId);

      const payload = { reposted: true as const, mode: 'repost' as const };
      const validated = ConversationRepostPostResponseSchema.safeParse(payload);
      if (!validated.success) {
        console.error(LOG_PREFIX, 'Invalid repost POST response DTO:', validated.error);
        return NextResponse.json(
          { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
          { status: 500 }
        );
      }

      return NextResponse.json(validated.data, { status: 201 });
    }

    // Quote repost: create a new PUBLIC_THREAD referencing the original
    const quoteText = (text || '').trim();

    const quoteConversation = await dbPrisma.conversation.create({
      data: {
        title: quoteText.slice(0, 50) + (quoteText.length > 50 ? '...' : ''),
        description: null,
        userId,
        participants: [],
        type: 'PUBLIC_THREAD',
        visibility: 'PUBLIC',
        replyPermission: 'EVERYONE',
        tags: [],
        allowedRoles: [],
        customViewers: [],
        repostOfConversationId: conversationId,
      },
      select: { id: true },
    });

    await dbPrisma.message.create({
      data: {
        content: quoteText,
        senderId: userId,
        conversationId: quoteConversation.id,
      },
    });

    await dbPrisma.conversation.update({
      where: { id: quoteConversation.id },
      data: {
        replyCount: 1,
        lastActivityAt: new Date(),
      },
    });

    // --- Reach: Record repost engagement on the original pulse & trigger echo ---
    try {
      const repostStrength = calculateEngagementStrength({
        eventType: 'REPULSE',
        verificationTier: 'WEB2_BASIC', // Auth'd user minimum
        priorEventCount: 0,
        threadDepth: 0,
        totalParticipants: 1,
        uniqueParticipants: 1,
      });

      // Record an EngagementEvent on the ORIGINAL pulse
      await dbPrisma.engagementEvent.create({
        data: {
          conversationId,
          userId,
          eventType: 'REPULSE',
          strength: repostStrength.strength,
          details: { mode: 'quote_repost', childPulseId: quoteConversation.id },
        },
      });

      // Bump the original pulse's reach
      await dbPrisma.conversation.update({
        where: { id: conversationId },
        data: {
          reachLifetime: { increment: repostStrength.strength },
          reachMomentum: { increment: repostStrength.strength },
          pillarEngagement: { increment: repostStrength.strength * 0.1 },
        },
      });

      // Seed echo propagation from the new child pulse
      await propagateEcho(quoteConversation.id, repostStrength.strength);
    } catch (echoErr) {
      // Non-fatal: log and continue
      console.error(LOG_PREFIX, 'Echo propagation failed:', echoErr);
    }

    const payload = { reposted: true as const, mode: 'quote' as const, conversationId: quoteConversation.id };
    const validated = ConversationRepostPostResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(LOG_PREFIX, 'Invalid quote repost POST response DTO:', validated.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data, { status: 201 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating repost:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: 'Error creating repost', ...(isDev ? { error: message } : {}) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  const session = await MyLibUserAuth();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized ID' }, { status: 401 });
  }

  try {
    await dbPrisma.conversationRepost.delete({
      where: { conversationId_userId: { conversationId, userId } },
    });

    // Broadcast real-time repost count update
    broadcastRepostUpdate(conversationId);

    const payload = { reposted: false as const };
    const validated = ConversationRepostDeleteResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(LOG_PREFIX, 'Invalid repost DELETE response DTO:', validated.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch (error) {
    // If there was nothing to delete, treat as idempotent
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      const payload = { reposted: false as const };
      const validated = ConversationRepostDeleteResponseSchema.safeParse(payload);
      if (!validated.success) {
        console.error(LOG_PREFIX, 'Invalid repost DELETE response DTO:', validated.error);
        return NextResponse.json(
          { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
          { status: 500 }
        );
      }

      return NextResponse.json(validated.data, { status: 200 });
    }

    console.error(LOG_PREFIX, 'Error removing repost:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: 'Error removing repost', ...(isDev ? { error: message } : {}) },
      { status: 500 }
    );
  }
}
