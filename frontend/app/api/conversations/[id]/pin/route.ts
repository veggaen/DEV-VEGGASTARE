import { NextResponse } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { dbPrisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: Pin a pulse
// - Admin/Owner can pin to main feed (?target=feed)
// - Any user can pin any pulse to their own profile (?target=profile)
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target') || 'profile'; // 'feed' or 'profile'
    
    const currentUser = await MyLibUserAuth();
    if (!currentUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = currentUser.id;

    // Verify conversation exists
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true, pinnedToFeed: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (target === 'feed') {
      // Only OWNER or ADMIN can pin to main feed
      if (currentUser.role !== 'OWNER' && currentUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only admins can pin to main feed' }, { status: 403 });
      }

      // Pin to main feed
      await dbPrisma.conversation.update({
        where: { id: conversationId },
        data: {
          pinnedToFeed: true,
          pinnedToFeedAt: new Date(),
          pinnedToFeedByUserId: userId,
        },
      });

      return NextResponse.json({ 
        success: true, 
        pinnedToFeed: true,
        message: 'Pinned to main feed' 
      });
    } else {
      // Pin to user's profile - any user can pin any public pulse to their profile
      // Check if already pinned
      const existingPin = await dbPrisma.profilePin.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (existingPin) {
        return NextResponse.json({ 
          success: true, 
          pinnedToProfile: true,
          message: 'Already pinned to your profile' 
        });
      }

      // Get the order for the new pin (put it at the top)
      const highestOrder = await dbPrisma.profilePin.findFirst({
        where: { userId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      await dbPrisma.profilePin.create({
        data: {
          conversationId,
          userId,
          order: (highestOrder?.order ?? -1) + 1,
        },
      });

      return NextResponse.json({ 
        success: true, 
        pinnedToProfile: true,
        message: 'Pinned to your profile' 
      });
    }
  } catch (error) {
    console.error('[pin] Error:', error);
    return NextResponse.json({ error: 'Failed to pin' }, { status: 500 });
  }
}

// DELETE: Unpin a pulse
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target') || 'profile';
    
    const currentUser = await MyLibUserAuth();
    if (!currentUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = currentUser.id;

    if (target === 'feed') {
      // Only OWNER or ADMIN can unpin from main feed
      if (currentUser.role !== 'OWNER' && currentUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only admins can unpin from main feed' }, { status: 403 });
      }

      await dbPrisma.conversation.update({
        where: { id: conversationId },
        data: {
          pinnedToFeed: false,
          pinnedToFeedAt: null,
          pinnedToFeedByUserId: null,
        },
      });

      return NextResponse.json({ 
        success: true, 
        pinnedToFeed: false,
        message: 'Unpinned from main feed' 
      });
    } else {
      // Unpin from user's profile
      await dbPrisma.profilePin.deleteMany({
        where: {
          conversationId,
          userId,
        },
      });

      return NextResponse.json({ 
        success: true, 
        pinnedToProfile: false,
        message: 'Unpinned from your profile' 
      });
    }
  } catch (error) {
    console.error('[unpin] Error:', error);
    return NextResponse.json({ error: 'Failed to unpin' }, { status: 500 });
  }
}

// GET: Check pin status
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: conversationId } = await params;
    
    const currentUser = await MyLibUserAuth();

    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      select: { 
        pinnedToFeed: true,
        pinnedToFeedAt: true,
        pinnedToFeedByUserId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    let pinnedToProfile = false;
    if (currentUser?.id) {
      const profilePin = await dbPrisma.profilePin.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: currentUser.id,
          },
        },
      });
      pinnedToProfile = !!profilePin;
    }

    return NextResponse.json({
      pinnedToFeed: conversation.pinnedToFeed,
      pinnedToFeedAt: conversation.pinnedToFeedAt,
      pinnedToProfile,
    });
  } catch (error) {
    console.error('[pin status] Error:', error);
    return NextResponse.json({ error: 'Failed to get pin status' }, { status: 500 });
  }
}
