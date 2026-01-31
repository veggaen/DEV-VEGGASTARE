import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ConversationPulseDeleteResponseSchema,
  ConversationPulseGetResponseSchema,
  ConversationPulsePostResponseSchema,
} from '@/lib/types/conversations';

const LOG_PREFIX = '[api/conversations/[id]/pulse]';
const isDev = process.env.NODE_ENV !== 'production';

const postBodySchema = z.object({
  type: z.enum(['POSITIVE', 'NEGATIVE']),
});

/**
 * POST /api/conversations/[id]/pulse
 * 
 * Give a pulse (like/dislike) to a conversation.
 * - Users can only have one pulse per conversation
 * - Pulsing with the same type removes the pulse
 * - Pulsing with different type switches the pulse
 */
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

  const { type } = bodyResult.data;

  try {
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      select: { 
        id: true, 
        visibility: true,
        userId: true,
        positivePulseCount: true,
        negativePulseCount: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Check if negative pulses are allowed for this user's content
    if (type === 'NEGATIVE') {
      const ownerPrivacy = await dbPrisma.userPrivacySettings.findUnique({
        where: { userId: conversation.userId },
        select: { allowNegativePulses: true },
      });
      
      if (ownerPrivacy && !ownerPrivacy.allowNegativePulses) {
        return NextResponse.json(
          { message: 'Negative pulses are not allowed on this content' }, 
          { status: 403 }
        );
      }
    }

    // Check if user already has a pulse on this conversation
    const existingPulse = await dbPrisma.pulse.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    let action: 'added' | 'removed' | 'switched';
    let newType: 'POSITIVE' | 'NEGATIVE' | null;
    let positiveChange = 0;
    let negativeChange = 0;

    if (existingPulse) {
      if (existingPulse.type === type) {
        // Same type - remove the pulse (toggle off)
        await dbPrisma.pulse.delete({
          where: { id: existingPulse.id },
        });
        action = 'removed';
        newType = null;
        
        if (type === 'POSITIVE') {
          positiveChange = -1;
        } else {
          negativeChange = -1;
        }
      } else {
        // Different type - switch the pulse
        await dbPrisma.pulse.update({
          where: { id: existingPulse.id },
          data: { type },
        });
        action = 'switched';
        newType = type;
        
        if (type === 'POSITIVE') {
          positiveChange = 1;
          negativeChange = -1;
        } else {
          positiveChange = -1;
          negativeChange = 1;
        }
      }
    } else {
      // No existing pulse - create new
      await dbPrisma.pulse.create({
        data: {
          conversationId,
          userId,
          type,
        },
      });
      action = 'added';
      newType = type;
      
      if (type === 'POSITIVE') {
        positiveChange = 1;
      } else {
        negativeChange = 1;
      }
    }

    // Update conversation pulse counts
    const updatedConversation = await dbPrisma.conversation.update({
      where: { id: conversationId },
      data: {
        positivePulseCount: { increment: positiveChange },
        negativePulseCount: { increment: negativeChange },
      },
      select: {
        positivePulseCount: true,
        negativePulseCount: true,
      },
    });

    console.log(
      `${LOG_PREFIX} Pulse ${action}: conversation=${conversationId} user=${userId} type=${type} ` +
      `positive=${updatedConversation.positivePulseCount} negative=${updatedConversation.negativePulseCount}`
    );

    const payload = {
      action,
      currentPulse: newType,
      positivePulseCount: updatedConversation.positivePulseCount,
      negativePulseCount: updatedConversation.negativePulseCount,
    };

    const validated = ConversationPulsePostResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(`${LOG_PREFIX} Invalid POST response DTO:`, validated.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);

  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return NextResponse.json(
      { message: 'Failed to process pulse' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations/[id]/pulse
 * 
 * Get the current user's pulse on a conversation
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  const session = await MyLibUserAuth();
  const userId = session?.id;

  try {
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        positivePulseCount: true,
        negativePulseCount: true,
        userId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Check owner's privacy settings for negative pulse visibility
    const ownerPrivacy = await dbPrisma.userPrivacySettings.findUnique({
      where: { userId: conversation.userId },
      select: { showNegativePulses: true },
    });

    const showNegative = ownerPrivacy?.showNegativePulses ?? false;

    let userPulse: 'POSITIVE' | 'NEGATIVE' | null = null;
    
    if (userId) {
      const pulse = await dbPrisma.pulse.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        select: { type: true },
      });
      userPulse = pulse?.type ?? null;
    }

    const payload = {
      positivePulseCount: conversation.positivePulseCount,
      negativePulseCount: showNegative ? conversation.negativePulseCount : null,
      userPulse,
      showNegativePulses: showNegative,
    };

    const validated = ConversationPulseGetResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(`${LOG_PREFIX} Invalid GET response DTO:`, validated.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);

  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return NextResponse.json(
      { message: 'Failed to get pulse status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/[id]/pulse
 * 
 * Remove user's pulse from a conversation
 */
export async function DELETE(
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

  try {
    const existingPulse = await dbPrisma.pulse.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!existingPulse) {
      return NextResponse.json({ message: 'No pulse found' }, { status: 404 });
    }

    await dbPrisma.pulse.delete({
      where: { id: existingPulse.id },
    });

    // Update counts
    const updateData = existingPulse.type === 'POSITIVE'
      ? { positivePulseCount: { decrement: 1 } }
      : { negativePulseCount: { decrement: 1 } };

    const updatedConversation = await dbPrisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      select: {
        positivePulseCount: true,
        negativePulseCount: true,
      },
    });

    const payload = {
      removed: true,
      positivePulseCount: updatedConversation.positivePulseCount,
      negativePulseCount: updatedConversation.negativePulseCount,
    };

    const validated = ConversationPulseDeleteResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(`${LOG_PREFIX} Invalid DELETE response DTO:`, validated.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);

  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return NextResponse.json(
      { message: 'Failed to remove pulse' },
      { status: 500 }
    );
  }
}
