import { dbPrisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await MyLibUserAuth();

  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;
  const { conversationId, content } = await req.json();

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized ID' }, { status: 401 });
  }

  try {
    const message = await dbPrisma.message.create({
      data: {
        content,
        senderId: userId,
        conversationId,
      },
    });

    // Trigger a Pusher event after message creation
    await pusherServer.trigger(`ConversationChannel_${conversationId}`, 'new-message', {
      conversationId,
      message: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Error sending message', error }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ message: 'Invalid conversation ID' }, { status: 400 });
  }

  try {
    // Fetch the conversation
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Fetch the messages
    const messages = await dbPrisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch users who are participants in the conversation
    const participantIds = conversation.participants as string[]; // assuming participants is an array of strings
    const users = await dbPrisma.user.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, name: true },
    });

    return NextResponse.json({ messages, users }, { status: 200 });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ message: 'Error fetching messages', error: error.message }, { status: 500 });
  }
}