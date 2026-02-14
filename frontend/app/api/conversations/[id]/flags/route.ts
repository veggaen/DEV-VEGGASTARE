/**
 * @fileOverview Content flag management for pulse moderation
 * @stability active
 * @dependencies lib/db, lib/user-auth, lib/api-validate
 * @keyInvariants Only OWNER/ADMIN can create/manage flags. Flags are soft-deletable via isActive.
 */

import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const LOG_PREFIX = '[api/conversations/[id]/flags]';
const isDev = process.env.NODE_ENV !== 'production';

const CONTENT_FLAG_TYPES = [
  'DISTURBING_CONTENT',
  'DEATH_OR_INJURY',
  'NUDITY',
  'FLASHING_IMAGES',
  'VIOLENCE',
  'HATE_SPEECH',
  'MISINFORMATION',
  'SPOILER',
  'SENSITIVE_TOPIC',
  'OTHER',
] as const;

const createFlagSchema = z.object({
  type: z.enum(CONTENT_FLAG_TYPES),
  reason: z.string().trim().max(500).optional().nullable(),
});

const removeFlagSchema = z.object({
  flagId: z.string().min(1),
});

/**
 * GET /api/conversations/[id]/flags
 * 
 * Fetch active content flags for a conversation.
 * Public — anyone can see flags (they're shown as warnings).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  try {
    const flags = await dbPrisma.contentFlag.findMany({
      where: {
        conversationId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        reason: true,
        createdAt: true,
        flaggedByUserId: true,
      },
    });

    return NextResponse.json({ flags }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching flags:', error);
    return NextResponse.json(
      { message: 'Error fetching flags', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/[id]/flags
 * 
 * Add a content flag to a conversation.
 * Admin/Owner only.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const session = await MyLibUserAuth();

  if (!session?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userRole = session.role;
  const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

  if (!isAdmin) {
    return NextResponse.json({ message: 'Forbidden — admin only' }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(req, createFlagSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { type, reason } = bodyResult.data;

  try {
    // Verify conversation exists
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Check if this exact flag type already exists and is active
    const existing = await dbPrisma.contentFlag.findFirst({
      where: {
        conversationId,
        type,
        isActive: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'This flag type is already active on this pulse', flag: existing },
        { status: 409 }
      );
    }

    const flag = await dbPrisma.contentFlag.create({
      data: {
        conversationId,
        flaggedByUserId: session.id,
        type,
        reason: reason || null,
      },
    });

    console.log(LOG_PREFIX, `Flag added: ${type} on conversation ${conversationId} by ${session.id}`);

    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating flag:', error);
    return NextResponse.json(
      { message: 'Error creating flag', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/[id]/flags
 * 
 * Remove (deactivate) a content flag.
 * Admin/Owner only.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const session = await MyLibUserAuth();

  if (!session?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userRole = session.role;
  const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

  if (!isAdmin) {
    return NextResponse.json({ message: 'Forbidden — admin only' }, { status: 403 });
  }

  // Parse flagId from query params
  const url = new URL(req.url);
  const flagId = url.searchParams.get('flagId');

  if (!flagId) {
    return NextResponse.json({ message: 'flagId query param required' }, { status: 400 });
  }

  try {
    const flag = await dbPrisma.contentFlag.findFirst({
      where: {
        id: flagId,
        conversationId,
        isActive: true,
      },
    });

    if (!flag) {
      return NextResponse.json({ message: 'Flag not found or already removed' }, { status: 404 });
    }

    await dbPrisma.contentFlag.update({
      where: { id: flagId },
      data: { isActive: false },
    });

    console.log(LOG_PREFIX, `Flag removed: ${flag.type} from conversation ${conversationId} by ${session.id}`);

    return NextResponse.json({ message: 'Flag removed' }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error removing flag:', error);
    return NextResponse.json(
      { message: 'Error removing flag', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}
