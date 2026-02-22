import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { isAdmin, isOwner, logAdminAction } from "@/lib/admin";
import { dbPrisma } from "@/lib/db";
import { AdminAction, AdminTargetType } from "@/generated/prisma/browser";

export const dynamic = "force-dynamic";

const LOG_PREFIX = "[api/admin/ai-chat/[id]]";

const patchSchema = z.object({
  action: z.enum(["suspend", "unsuspend", "delete", "flag", "restore"]),
  reason: z.string().max(500).optional(),
});

/**
 * GET /api/admin/ai-chat/[id]
 * Full conversation detail: all messages, participants, and audit log.
 * Requires ADMIN or OWNER role.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const conv = await dbPrisma.aiConversation.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
        participants: {
          select: {
            id: true,
            type: true,
            displayName: true,
            aiProvider: true,
            aiModel: true,
            responseMode: true,
            responseBrief: true,
            manualOnly: true,
            isActive: true,
            byokUserId: true,
            createdAt: true,
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
          select: {
            id: true,
            content: true,
            role: true,
            senderType: true,
            modelUsed: true,
            providerUsed: true,
            hasSensitiveData: true,
            sensitiveTypes: true,
            createdAt: true,
            participant: {
              select: { displayName: true, type: true },
            },
          },
        },
      },
    });

    if (!conv) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // Log admin view
    await logAdminAction({
      adminId: session.id,
      action: AdminAction.VIEW,
      targetType: AdminTargetType.CONVERSATION,
      targetId: id,
    });

    return NextResponse.json({ conversation: conv });
  } catch (err) {
    console.error(`${LOG_PREFIX} Error fetching conversation:`, err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/ai-chat/[id]
 * Moderate a conversation: suspend, unsuspend, flag, restore.
 * Requires ADMIN or OWNER role.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const conv = await dbPrisma.aiConversation.findUnique({
    where: { id },
    select: { id: true, creatorId: true, isSuspended: true, isDeleted: true },
  });

  if (!conv) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    let update: Record<string, unknown> = {};
    let auditAction: string;

    switch (body.action) {
      case "suspend":
        update = {
          isSuspended: true,
          suspendedReason: body.reason ?? null,
          suspendedAt: new Date(),
          suspendedBy: session.id,
        };
        auditAction = "SUSPEND";
        break;

      case "unsuspend":
        update = {
          isSuspended: false,
          suspendedReason: null,
          suspendedAt: null,
          suspendedBy: null,
        };
        auditAction = "UNSUSPEND";
        break;

      case "delete":
        update = {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: session.id,
        };
        auditAction = "DELETE";
        break;

      case "restore":
        update = {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        };
        auditAction = "RESTORE";
        break;

      case "flag":
        // Flag only writes to audit log; doesn't mutate conversation directly
        auditAction = "FLAG";
        break;
    }

    // Apply DB update if needed
    let updated = conv;
    if (Object.keys(update).length > 0) {
      updated = await dbPrisma.aiConversation.update({
        where: { id },
        data: update,
        select: { id: true, creatorId: true, isSuspended: true, isDeleted: true },
      });
    }

    // Write to our dedicated AI audit log
    await dbPrisma.aiConvAuditLog.create({
      data: {
        conversationId: id,
        actorId: session.id,
        targetUserId: conv.creatorId,
        action: auditAction,
        reason: body.reason ?? null,
      },
    });

    // Also write to the general admin audit log so it shows in the admin dashboard
    await logAdminAction({
      adminId: session.id,
      action: AdminAction.EDIT,
      targetType: AdminTargetType.CONVERSATION,
      targetId: id,
      newData: { action: body.action },
      reason: body.reason,
    });

    return NextResponse.json({ ok: true, conversation: updated });
  } catch (err) {
    console.error(`${LOG_PREFIX} Error moderating conversation:`, err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/ai-chat/[id]
 * Hard-delete conversation. OWNER role only.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id || !isOwner(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await dbPrisma.aiConversation.delete({ where: { id } });

    await logAdminAction({
      adminId: session.id,
      action: AdminAction.DELETE,
      targetType: AdminTargetType.CONVERSATION,
      targetId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${LOG_PREFIX} Error hard-deleting conversation:`, err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
