import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";
import {
  ensureSystemAccount,
  canPostAsSystem,
  SYSTEM_ACCOUNT,
} from "@/lib/system-account";

// POST /api/system/initialize - Initialize system and create first update
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canPost = await canPostAsSystem(session.user.id);
    if (!canPost) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Ensure system account exists
    await ensureSystemAccount();

    // Check if first update already exists
    const existingUpdate = await db.conversation.findFirst({
      where: {
        userId: SYSTEM_ACCOUNT.id,
        tags: { has: "inaugural" },
      },
    });

    if (existingUpdate) {
      return NextResponse.json({
        success: false,
        message: "System already initialized",
        conversationId: existingUpdate.id,
      });
    }

    // Create the inaugural system update
    const firstUpdateContent = `# 🎉 Welcome to VeggaSystem!

*Posted on ${new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}*

---

Hey Veggat community! 👋

I'm **VeggaSystem**, your official source for platform updates, changelogs, and important announcements. Think of me as your friendly neighborhood changelog bot! 🤖

## What's New Today

1. **🔔 Notification System Launch** — Get real-time notifications for heartbeats, vibes, syncs, mentions, and more! Your notification bell is now live in the topbar.

2. **🤖 VeggaSystem Account** — This official system account (that's me!) will keep you updated on all the latest changes to the platform. Every time we push updates, you'll hear about it here first.

3. **📝 Blog-Style Updates** — Updates are now posted as Pulses, so you can heartbeat them, vibe them, and even leave replies. We're making changelogs social! 

4. **🛠️ Admin Tools** — Platform admins can now post updates on behalf of VeggaSystem, making it easier to communicate important changes.

5. **📣 Automatic Notifications** — Every system update automatically notifies all users, so you'll never miss important news.

## What's Coming Next

We're constantly improving Veggat. Some things on our radar:
- Real-time notification sounds
- Push notifications for mobile
- Expanded notification preferences
- More social features

---

Thanks for being part of the Veggat community! Drop a heartbeat on this pulse if you're excited about these updates! 💚

*Stay pulsing,*
**— VeggaSystem** 🚀`;

    // Create the conversation (pulse)
    const conversation = await db.conversation.create({
      data: {
        userId: SYSTEM_ACCOUNT.id,
        title: "🎉 Welcome to VeggaSystem — Notification System Launch!",
        type: "PUBLIC_THREAD",
        visibility: "PUBLIC",
        tags: ["system", "inaugural", "update", "changelog", "notifications"],
        replyPermission: "EVERYONE",
      },
    });

    // Create the message content
    await db.message.create({
      data: {
        conversationId: conversation.id,
        senderId: SYSTEM_ACCOUNT.id,
        content: firstUpdateContent,
      },
    });

    // Notify all users
    const users = await db.user.findMany({
      where: {
        id: { not: SYSTEM_ACCOUNT.id },
      },
      select: { id: true },
    });

    if (users.length > 0) {
      await db.notification.createMany({
        data: users.map((user) => ({
          userId: user.id,
          type: "MILESTONE" as const,
          title: "🎉 Welcome to VeggaSystem!",
          message: "Check out our first platform update and new notification system!",
          emoji: "🎉",
          preview: "Your notification system is now live! Tap to see what's new...",
          actorId: SYSTEM_ACCOUNT.id,
          conversationId: conversation.id,
          groupKey: `system-inaugural:${conversation.id}`,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      message: `System initialized! First update posted and ${users.length} users notified.`,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error("[SYSTEM_INITIALIZE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
