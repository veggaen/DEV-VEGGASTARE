import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';

const LOG_PREFIX = '[api/conversations/[id]/view]';

/**
 * POST /api/conversations/[id]/view
 *
 * Track a view for a conversation. This increments the viewCount
 * and updates lastActivityAt. Used for "reach over followers" sorting.
 *
 * Philosophy (inspired by Richard's insight):
 * - "Reach count" matters more than "follower count"
 * - A post with 3.1M followers but 8k views indicates algo issues, not content issues
 * - We track actual views to surface genuinely engaging content
 *
 * View tracking:
 * - viewCount: Total page loads (increments every time)
 * - uniqueViewCount: Unique users who viewed (increments only first time per user)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  const session = await MyLibUserAuth();
  const userId = session?.id;

  try {
    // Check if conversation exists
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, visibility: true },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Always increment total view count
    await dbPrisma.conversation.update({
      where: { id: conversationId },
      data: {
        viewCount: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });

    // Track unique views for logged-in users
    let isNewUniqueView = false;
    if (userId) {
      // Try to find existing view record for this user
      const existingView = await dbPrisma.conversationView.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (existingView) {
        // User has viewed before - just update their view count and lastViewedAt
        await dbPrisma.conversationView.update({
          where: { id: existingView.id },
          data: {
            viewCount: { increment: 1 },
            lastViewedAt: new Date(),
          },
        });
      } else {
        // First time this user views - create record and increment uniqueViewCount
        await dbPrisma.conversationView.create({
          data: {
            conversationId,
            userId,
            viewCount: 1,
            firstViewedAt: new Date(),
            lastViewedAt: new Date(),
          },
        });

        // Increment unique view count on the conversation
        await dbPrisma.conversation.update({
          where: { id: conversationId },
          data: {
            uniqueViewCount: { increment: 1 },
          },
        });

        isNewUniqueView = true;
      }
    }

    console.log(
      LOG_PREFIX,
      `View tracked for ${conversationId}${userId ? ` by ${userId}` : ' (anon)'}${isNewUniqueView ? ' [NEW UNIQUE]' : ''}`
    );

    return NextResponse.json({ success: true, isNewUniqueView }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error tracking view:', error);
    return NextResponse.json({ message: 'Error tracking view' }, { status: 500 });
  }
}

