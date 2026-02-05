import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const LinkSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
});

type RouteParams = {
  params: Promise<{ pollId: string }>;
};

/**
 * POST /api/advanced-polls/[pollId]/link
 * Link an existing advanced poll to a conversation
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { pollId } = await params;

    const currentUser = await MyLibUserAuth();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = LinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { conversationId } = parsed.data;

    // Find the poll
    const poll = await dbPrisma.advancedPoll.findUnique({
      where: { id: pollId },
      select: { id: true, creatorId: true, conversationId: true },
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    // Check ownership (only creator, admin, or owner can link)
    if (
      poll.creatorId !== currentUser.id &&
      currentUser.role !== "ADMIN" &&
      currentUser.role !== "OWNER"
    ) {
      return NextResponse.json(
        { error: "Only the poll creator can link it" },
        { status: 403 }
      );
    }

    // Check if already linked
    if (poll.conversationId) {
      return NextResponse.json(
        { error: "Poll is already linked to a conversation" },
        { status: 400 }
      );
    }

    // Verify the conversation exists and belongs to the user
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (
      conversation.userId !== currentUser.id &&
      currentUser.role !== "ADMIN" &&
      currentUser.role !== "OWNER"
    ) {
      return NextResponse.json(
        { error: "Can only link to your own conversations" },
        { status: 403 }
      );
    }

    // Link the poll to the conversation
    const updatedPoll = await dbPrisma.advancedPoll.update({
      where: { id: pollId },
      data: { conversationId },
    });

    return NextResponse.json({
      success: true,
      pollId: updatedPoll.id,
      conversationId: updatedPoll.conversationId,
    });
  } catch (error) {
    console.error("[advanced-polls/link] Error:", error);
    return NextResponse.json(
      { error: "Failed to link poll" },
      { status: 500 }
    );
  }
}
