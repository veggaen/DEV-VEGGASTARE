import { dbPrisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { parseJsonOrError } from '@/lib/api-validate';
import { z } from 'zod';
import { MessageResponseSchema } from '@/lib/types/messages';

const isDev = process.env.NODE_ENV !== 'production';

const patchBodySchema = z
  .object({
    content: z.string().trim().max(5000).optional().nullable(),
    imageUrl: z.string().trim().max(2048).optional().nullable(),
  })
  .refine((val) => val.content !== undefined || val.imageUrl !== undefined, {
    message: 'At least one of content or imageUrl must be provided',
  });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;

  const bodyResult = await parseJsonOrError(req, patchBodySchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { content, imageUrl } = bodyResult.data;
  const userId = session.id;

  try {
    const message = await dbPrisma.message.findUnique({
      where: { id: resolvedParams.messageId },
    });

    if (!message) {
      return NextResponse.json({ message: 'Message not found' }, { status: 404 });
    }

    if (message.senderId !== userId && session.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Update the message with the new content and imageUrl
    const updatedMessage = await dbPrisma.message.update({
      where: { id: resolvedParams.messageId },
      data: {
        ...(content !== undefined && content !== null ? { content } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl ?? undefined } : {}),
        editedAt: new Date(),
      },
      include: {
        User: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    // Trigger Pusher event for editing
    await pusherServer.trigger(`ConversationChannel_${message.conversationId}`, 'edit-message', {
      messageId: updatedMessage.id,
      content: updatedMessage.content,
      imageUrl: updatedMessage.imageUrl, // Include the updated imageUrl in the Pusher event
      editedAt: updatedMessage.editedAt,
    });

    const dto = {
      id: updatedMessage.id,
      content: updatedMessage.content,
      imageUrl: updatedMessage.imageUrl ?? null,
      senderId: updatedMessage.senderId,
      conversationId: updatedMessage.conversationId,
      createdAt: updatedMessage.createdAt,
      editedAt: updatedMessage.editedAt,
      User: updatedMessage.User
        ? {
            id: updatedMessage.User.id,
            name: updatedMessage.User.name,
            image: updatedMessage.User.image ?? null,
          }
        : null,
      sender: updatedMessage.User
        ? {
            id: updatedMessage.User.id,
            name: updatedMessage.User.name,
            image: updatedMessage.User.image ?? null,
          }
        : null,
    };

    const parsed = MessageResponseSchema.safeParse(dto);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Error updating message',
          ...(isDev ? { detail: 'Invalid DTO', issues: parsed.error.issues } : {}),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error updating message', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;

  const userId = session.id;

  try {
    const message = await dbPrisma.message.findUnique({
      where: { id: resolvedParams.messageId },
    });

    if (!message) {
      return NextResponse.json({ message: 'Message not found' }, { status: 404 });
    }

    if (message.senderId !== userId && session.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await dbPrisma.message.delete({
      where: { id: resolvedParams.messageId },
    });

    // Trigger Pusher event for deleting
    await pusherServer.trigger(`ConversationChannel_${message.conversationId}`, 'delete-message', {
      messageId: message.id,
    });

    return NextResponse.json({ message: 'Message deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error deleting message', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}