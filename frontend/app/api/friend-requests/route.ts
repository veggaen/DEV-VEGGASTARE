import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get pending friend requests for current user
export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'received'; // 'received' or 'sent'

  try {
    const requests = await dbPrisma.friendRequest.findMany({
      where: type === 'received'
        ? { receiverId: session.id, status: 'PENDING' }
        : { senderId: session.id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            bio: true,
            _count: {
              select: { followers: true, following: true },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            bio: true,
            _count: {
              select: { followers: true, following: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      requests: requests.map(r => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        user: type === 'received' ? {
          ...r.sender,
          followerCount: r.sender._count.followers,
          followingCount: r.sender._count.following,
        } : {
          ...r.receiver,
          followerCount: r.receiver._count.followers,
          followingCount: r.receiver._count.following,
        },
      })),
    });
  } catch (error) {
    console.error('[api/friend-requests] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch friend requests' }, { status: 500 });
  }
}

// POST - Send a friend request
export async function POST(request: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    if (session.id === userId) {
      return NextResponse.json({ error: 'Cannot send friend request to yourself' }, { status: 400 });
    }

    // Check if user exists
    const targetUser = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already friends
    const existingFriendship = await dbPrisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: session.id < userId ? session.id : userId, userBId: session.id < userId ? userId : session.id },
        ],
      },
    });

    if (existingFriendship) {
      return NextResponse.json({ error: 'Already friends with this user' }, { status: 409 });
    }

    // Check if request already exists (in either direction)
    const existingRequest = await dbPrisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: session.id, receiverId: userId },
          { senderId: userId, receiverId: session.id },
        ],
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      // If they already sent us a request, accept it instead
      if (existingRequest.senderId === userId) {
        return NextResponse.json({ 
          error: 'This user already sent you a friend request. Accept it instead.',
          existingRequestId: existingRequest.id,
        }, { status: 409 });
      }
      return NextResponse.json({ error: 'Friend request already sent' }, { status: 409 });
    }

    // Create friend request
    const friendRequest = await dbPrisma.friendRequest.create({
      data: {
        senderId: session.id,
        receiverId: userId,
      },
    });

    return NextResponse.json({
      success: true,
      request: friendRequest,
    });
  } catch (error: any) {
    console.error('[api/friend-requests] Error:', error);
    return NextResponse.json({ error: 'Failed to send friend request' }, { status: 500 });
  }
}
