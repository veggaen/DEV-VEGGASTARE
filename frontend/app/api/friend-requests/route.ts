import { dbPrisma } from '@/lib/db';
import { resolveVisibleEmail } from '@/lib/email-visibility';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  FriendRequestCreateResponseSchema,
  FriendRequestsListResponseSchema,
} from '@/lib/types/friend-requests';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const FriendRequestBodySchema = z.object({
  userId: z.string().min(1),
});

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

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
            emailDisplayMode: true,
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
            emailDisplayMode: true,
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

    const payload = {
      requests: requests.map((r) => {
        const peer = type === 'received' ? r.sender : r.receiver;
        return {
          id: r.id,
          status: r.status,
          createdAt: toIsoString(r.createdAt),
          user: {
            id: peer.id,
            name: peer.name,
            email: resolveVisibleEmail({
              targetUserId: peer.id,
              targetEmail: peer.email,
              targetEmailDisplayMode: peer.emailDisplayMode,
              viewerUserId: session.id,
              viewerRole: session.role,
            }),
            image: peer.image,
            bio: peer.bio,
            followerCount: peer._count.followers,
            followingCount: peer._count.following,
          },
        };
      }),
    };

    const validated = FriendRequestsListResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[api/friend-requests] Invalid GET DTO:', validated.error);
      return NextResponse.json(
        { error: 'Failed to fetch friend requests', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);
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

  // Rate limit
  const rl = await checkRateLimit(getClientIdentifier(request, session.id), 'social');
  if (!rl.success) return rateLimitedResponse(rl);

  try {
    const json = await request.json();
    const parsed = FriendRequestBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    const { userId } = parsed.data;

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

    const payload = {
      success: true as const,
      request: {
        id: friendRequest.id,
        senderId: friendRequest.senderId,
        receiverId: friendRequest.receiverId,
        status: friendRequest.status,
        createdAt: toIsoString(friendRequest.createdAt),
        updatedAt: toIsoString(friendRequest.updatedAt),
      },
    };

    const validated = FriendRequestCreateResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[api/friend-requests] Invalid POST DTO:', validated.error);
      return NextResponse.json(
        { error: 'Failed to send friend request', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);
  } catch (error: any) {
    console.error('[api/friend-requests] Error:', error);
    return NextResponse.json({ error: 'Failed to send friend request' }, { status: 500 });
  }
}
