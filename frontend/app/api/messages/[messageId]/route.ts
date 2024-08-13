import { dbPrisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request, { params }: { params: { messageId: string } }) {
  const session = await MyLibUserAuth();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { content } = await req.json();
  const userId = session.id;

  try {
    const message = await dbPrisma.message.findUnique({
      where: { id: params.messageId },
    });

    if (!message) {
      return NextResponse.json({ message: 'Message not found' }, { status: 404 });
    }

    if (message.senderId !== userId && session.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const updatedMessage = await dbPrisma.message.update({
      where: { id: params.messageId },
      data: {
        content,
        editedAt: new Date(),
      },
    });

    // Trigger Pusher event for editing
    await pusherServer.trigger(`ConversationChannel_${message.conversationId}`, 'edit-message', {
      messageId: updatedMessage.id,
      content: updatedMessage.content,
      editedAt: updatedMessage.editedAt,
    });

    return NextResponse.json(updatedMessage, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error updating message' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { messageId: string } }) {
  const session = await MyLibUserAuth();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;

  try {
    const message = await dbPrisma.message.findUnique({
      where: { id: params.messageId },
    });

    if (!message) {
      return NextResponse.json({ message: 'Message not found' }, { status: 404 });
    }

    if (message.senderId !== userId && session.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await dbPrisma.message.delete({
      where: { id: params.messageId },
    });

    // Trigger Pusher event for deleting
    await pusherServer.trigger(`ConversationChannel_${message.conversationId}`, 'delete-message', {
      messageId: message.id,
    });

    return NextResponse.json({ message: 'Message deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting message' }, { status: 500 });
  }
}