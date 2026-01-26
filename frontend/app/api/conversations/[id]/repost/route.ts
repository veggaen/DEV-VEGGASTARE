import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const LOG_PREFIX = '[api/conversations/[id]/repost]';
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

      return NextResponse.json({ reposted: true, mode: 'repost' }, { status: 201 });
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

    return NextResponse.json(
      { reposted: true, mode: 'quote', conversationId: quoteConversation.id },
      { status: 201 }
    );
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

    return NextResponse.json({ reposted: false }, { status: 200 });
  } catch (error) {
    // If there was nothing to delete, treat as idempotent
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ reposted: false }, { status: 200 });
    }

    console.error(LOG_PREFIX, 'Error removing repost:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: 'Error removing repost', ...(isDev ? { error: message } : {}) },
      { status: 500 }
    );
  }
}
