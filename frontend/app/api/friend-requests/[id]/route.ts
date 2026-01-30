import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH - Accept or decline a friend request
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { action } = await request.json();

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "accept" or "decline"' }, { status: 400 });
    }

    // Get the friend request
    const friendRequest = await dbPrisma.friendRequest.findUnique({
      where: { id },
    });

    if (!friendRequest) {
      return NextResponse.json({ error: 'Friend request not found' }, { status: 404 });
    }

    // Only the receiver can accept/decline
    if (friendRequest.receiverId !== session.id) {
      return NextResponse.json({ error: 'Not authorized to respond to this request' }, { status: 403 });
    }

    if (friendRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Friend request already processed' }, { status: 400 });
    }

    if (action === 'accept') {
      // Create friendship and update request in a transaction
      await dbPrisma.$transaction([
        // Update request status
        dbPrisma.friendRequest.update({
          where: { id },
          data: { status: 'ACCEPTED' },
        }),
        // Create friendship (ensure userAId < userBId for uniqueness)
        dbPrisma.friendship.create({
          data: {
            userAId: friendRequest.senderId < friendRequest.receiverId 
              ? friendRequest.senderId 
              : friendRequest.receiverId,
            userBId: friendRequest.senderId < friendRequest.receiverId 
              ? friendRequest.receiverId 
              : friendRequest.senderId,
          },
        }),
        // Auto-follow each other
        dbPrisma.follow.createMany({
          data: [
            { followerId: friendRequest.senderId, followingId: friendRequest.receiverId },
            { followerId: friendRequest.receiverId, followingId: friendRequest.senderId },
          ],
          skipDuplicates: true,
        }),
      ]);

      return NextResponse.json({
        success: true,
        status: 'ACCEPTED',
        message: 'Friend request accepted',
      });
    } else {
      // Decline
      await dbPrisma.friendRequest.update({
        where: { id },
        data: { status: 'DECLINED' },
      });

      return NextResponse.json({
        success: true,
        status: 'DECLINED',
        message: 'Friend request declined',
      });
    }
  } catch (error: any) {
    console.error('[api/friend-requests/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to process friend request' }, { status: 500 });
  }
}

// DELETE - Cancel a sent friend request or remove a friend
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // First check if it's a friend request
    const friendRequest = await dbPrisma.friendRequest.findUnique({
      where: { id },
    });

    if (friendRequest) {
      // Only sender can cancel pending request
      if (friendRequest.senderId !== session.id) {
        return NextResponse.json({ error: 'Not authorized to cancel this request' }, { status: 403 });
      }

      if (friendRequest.status !== 'PENDING') {
        return NextResponse.json({ error: 'Can only cancel pending requests' }, { status: 400 });
      }

      await dbPrisma.friendRequest.delete({ where: { id } });

      return NextResponse.json({
        success: true,
        message: 'Friend request cancelled',
      });
    }

    // Check if it's a friendship ID
    const friendship = await dbPrisma.friendship.findUnique({
      where: { id },
    });

    if (friendship) {
      if (friendship.userAId !== session.id && friendship.userBId !== session.id) {
        return NextResponse.json({ error: 'Not authorized to remove this friendship' }, { status: 403 });
      }

      // Remove friendship
      await dbPrisma.friendship.delete({ where: { id } });

      return NextResponse.json({
        success: true,
        message: 'Friend removed',
      });
    }

    return NextResponse.json({ error: 'Request or friendship not found' }, { status: 404 });
  } catch (error) {
    console.error('[api/friend-requests/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
