import { fetchUserManyDetails } from '@/data/user';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import {
  ConversationType,
  ConversationVisibility,
  ReplyPermission
} from '@prisma/client';

const LOG_PREFIX = '[api/conversations]';

export async function POST(req: Request) {
  const session = await MyLibUserAuth();

  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized ID' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      participants = [],
      type = 'PRIVATE_DM',
      visibility = 'PARTICIPANTS',
      replyPermission = 'PARTICIPANTS',
      tags = [],
      allowedRoles = [],
      customViewers = [],
      initialMessage,
      initialImageUrl,
      pollQuestion, // Used for title fallback if no title/message provided
    } = body;

    // Validate type
    const validTypes: ConversationType[] = ['PUBLIC_THREAD', 'PRIVATE_DM', 'GROUP', 'RESTRICTED'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ message: 'Invalid conversation type' }, { status: 400 });
    }

    // Validate visibility
    const validVisibilities: ConversationVisibility[] = ['PUBLIC', 'PARTICIPANTS', 'ROLE_BASED', 'CUSTOM'];
    if (!validVisibilities.includes(visibility)) {
      return NextResponse.json({ message: 'Invalid visibility' }, { status: 400 });
    }

    // Validate replyPermission
    const validReplyPerms: ReplyPermission[] = ['EVERYONE', 'PARTICIPANTS', 'MENTIONED', 'MODS_ONLY', 'CREATOR_ONLY'];
    if (!validReplyPerms.includes(replyPermission)) {
      return NextResponse.json({ message: 'Invalid reply permission' }, { status: 400 });
    }

    // Process participants - can be user IDs or emails
    let participantIds: string[] = [];

    if (Array.isArray(participants) && participants.length > 0) {
      const participantData = await Promise.all(
        participants.map(async (participant: string) => {
          // Check if participant is an email or a user ID
          const user = await dbPrisma.user.findFirst({
            where: {
              OR: [
                { email: { equals: participant, mode: 'insensitive' } },
                { id: participant }
              ],
            },
            select: { id: true },
          });
          return user ? user.id : null;
        })
      );
      participantIds = participantData.filter((id): id is string => id !== null);
    }

    // For PUBLIC_THREAD, creator is not automatically a participant
    // For DM/GROUP/RESTRICTED, add creator to participants
    let allParticipants: string[];
    if (type === 'PUBLIC_THREAD') {
      allParticipants = participantIds;
    } else {
      allParticipants = Array.from(new Set([...participantIds, userId]));

      // For DM and GROUP, we need at least 2 participants
      if ((type === 'PRIVATE_DM' || type === 'GROUP') && allParticipants.length < 2) {
        return NextResponse.json({ message: 'At least one other participant is required' }, { status: 400 });
      }
    }

    // Generate title if not provided
    let finalTitle = title?.trim() || '';
    if (!finalTitle) {
      // Use first ~50 chars of initial message as title if provided
      const trimmedMessage = typeof initialMessage === 'string' ? initialMessage.trim() : '';
      const trimmedPollQuestion = typeof pollQuestion === 'string' ? pollQuestion.trim() : '';

      if (trimmedMessage) {
        finalTitle = trimmedMessage.slice(0, 50);
        if (trimmedMessage.length > 50) finalTitle += '...';
      } else if (trimmedPollQuestion) {
        // Use poll question as title if no message provided
        finalTitle = trimmedPollQuestion.slice(0, 50);
        if (trimmedPollQuestion.length > 50) finalTitle += '...';
      } else if (type === 'PUBLIC_THREAD') {
        finalTitle = 'New Thread';
      } else if (participantIds.length > 0) {
        // Fetch participant names for auto-title
        const participantUsers = await dbPrisma.user.findMany({
          where: { id: { in: participantIds } },
          select: { name: true },
        });
        const names = participantUsers.map(u => u.name).filter(Boolean);
        if (type === 'PRIVATE_DM') {
          finalTitle = `Chat with ${names.join(', ') || 'user'}`;
        } else {
          finalTitle = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
        }
      } else {
        finalTitle = `New ${type.replace('_', ' ').toLowerCase()}`;
      }
    }

    console.log(LOG_PREFIX, `Creating ${type} conversation: "${finalTitle}" with ${allParticipants.length} participants`);

    const conversation = await dbPrisma.conversation.create({
      data: {
        title: finalTitle,
        description: description?.trim() || null,
        userId,
        participants: allParticipants,
        type,
        visibility,
        replyPermission,
        tags: Array.isArray(tags) ? tags : [],
        allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : [],
        customViewers: Array.isArray(customViewers) ? customViewers : [],
      },
    });

    // Create initial message if provided (for any conversation type)
    const messageContent = typeof initialMessage === 'string' ? initialMessage.trim() : '';
    const messageImageUrl = typeof initialImageUrl === 'string' ? initialImageUrl : null;

    // Create message if there's content or an image
    if (messageContent || messageImageUrl) {
      await dbPrisma.message.create({
        data: {
          content: messageContent || '', // Content can be empty if there's an image
          imageUrl: messageImageUrl,
          senderId: userId,
          conversationId: conversation.id,
        },
      });

      // Update reply count for the initial message
      await dbPrisma.conversation.update({
        where: { id: conversation.id },
        data: {
          replyCount: 1,
          lastActivityAt: new Date(),
        },
      });

      console.log(LOG_PREFIX, `Created initial message for conversation ${conversation.id}${messageImageUrl ? ' (with image)' : ''}`);
    }

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating conversation:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error creating conversation', error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await MyLibUserAuth();

  // Parse query params
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') || 'mine'; // 'mine' | 'public' | 'all'
  const sort = searchParams.get('sort') || 'recent'; // 'recent' | 'reach' | 'active' | 'replies'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const cursor = searchParams.get('cursor') || undefined;

  // For public feed, authentication is optional
  const userId = session?.id;
  const userRole = session?.role;

  try {
    let whereClause: Record<string, unknown>;

    if (filter === 'public') {
      // Public conversations - anyone can see
      whereClause = { visibility: 'PUBLIC' };
    } else if (filter === 'mine' && userId) {
      // User's conversations (created by or participant in)
      whereClause = {
        OR: [
          { userId },
          { participants: { has: userId } },
        ],
      };
    } else if (filter === 'all' && userId) {
      // All conversations the user can access (using permission helper logic inline)
      if (userRole === 'OWNER' || userRole === 'ADMIN') {
        // Admins see everything
        whereClause = {};
      } else {
        whereClause = {
          OR: [
            { visibility: 'PUBLIC' },
            { userId },
            { participants: { has: userId } },
            {
              AND: [
                { visibility: 'ROLE_BASED' },
                { allowedRoles: { has: userRole } },
              ],
            },
            {
              AND: [
                { visibility: 'CUSTOM' },
                { customViewers: { has: userId } },
              ],
            },
          ],
        };
      }
    } else if (!userId) {
      // Not authenticated - only show public
      whereClause = { visibility: 'PUBLIC' };
    } else {
      whereClause = {};
    }

    // Build orderBy based on sort parameter
    // "Reach over followers" philosophy: prioritize actual engagement over vanity metrics
    type OrderByField = { [key: string]: 'asc' | 'desc' };
    let orderBy: OrderByField[];

    switch (sort) {
      case 'reach':
        // Richard's insight: "reach count" over "follower count"
        // Sort by actual views and unique engagement, not just reply count
        orderBy = [
          { isPinned: 'desc' },
          { viewCount: 'desc' },
          { uniqueRepliers: 'desc' },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'active':
        // Most recently active (last message/interaction)
        orderBy = [
          { isPinned: 'desc' },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'replies':
        // Most discussed (reply count)
        orderBy = [
          { isPinned: 'desc' },
          { replyCount: 'desc' },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'recent':
      default:
        // Most recently created
        orderBy = [
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ];
        break;
    }

    const conversations = await dbPrisma.conversation.findMany({
      where: whereClause,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        user: {
          select: { id: true, name: true, image: true },
        },
        poll: {
          select: { id: true }, // Just check if poll exists
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy,
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    // Extract all participant IDs from all conversations
    const allParticipantIds = Array.from(
      new Set(conversations.flatMap((conversation) => conversation.participants as string[]))
    );

    // Fetch details for all participants
    const users = await fetchUserManyDetails(allParticipantIds);

    // Add participant details to each conversation
    const conversationsWithUserDetails = conversations.map((conversation) => {
      const participantDetails = (conversation.participants as string[]).map((id) =>
        users.find((user) => user.id === id)
      ).filter(Boolean);

      return {
        ...conversation,
        participantDetails, // Keep original participants array, add details separately
        lastMessage: conversation.messages[0] || null,
        messageCount: conversation._count.messages,
        hasPoll: !!conversation.poll, // Boolean indicator for poll existence
      };
    });

    // Return with next cursor for pagination
    const nextCursor = conversations.length === limit
      ? conversations[conversations.length - 1]?.id
      : null;

    return NextResponse.json({
      conversations: conversationsWithUserDetails,
      nextCursor,
    }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching conversations:', error);

    if (error instanceof Error) {
      return NextResponse.json({ message: 'Error fetching conversations', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Unknown error occurred' }, { status: 500 });
  }
}