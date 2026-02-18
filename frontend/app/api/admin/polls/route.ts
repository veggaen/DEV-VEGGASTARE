/**
 * @fileOverview Admin polls management API — pending reviews + scheduled polls
 * @stability stable
 *
 * GET  /api/admin/polls              — list polls with optional reviewStatus filter
 * GET  /api/admin/polls?tab=scheduled — list scheduled poll templates
 * PATCH /api/admin/polls             — approve/reject a poll
 */

import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { z } from "zod";

const LOG_PREFIX = "[api/admin/polls]";

export const dynamic = "force-dynamic";

// ─── Auth guard ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const user = await MyLibUserAuth();
  if (!user?.id || (user.role !== "ADMIN" && user.role !== "OWNER")) {
    return null;
  }
  return user;
}

// ─── GET — List polls or scheduled templates ─────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab");

  if (tab === "scheduled") {
    const templates = await dbPrisma.scheduledPoll.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        Creator: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        cronExpression: t.cronExpression,
        promptTemplate: t.promptTemplate,
        targetFeedId: t.targetFeedId,
        isActive: t.isActive,
        autoPublish: t.autoPublish,
        lastRunAt: t.lastRunAt?.toISOString() ?? null,
        nextRunAt: t.nextRunAt?.toISOString() ?? null,
        createdBy: t.createdBy,
        creator: {
          id: t.Creator.id,
          name: t.Creator.name,
          email: t.Creator.email,
          image: t.Creator.image,
        },
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  }

  // Default: list polls with reviewStatus filter
  const statusFilter = searchParams.get("status") ?? "PENDING_REVIEW";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const where = statusFilter === "ALL"
    ? {}
    : { reviewStatus: statusFilter as "PENDING_REVIEW" | "APPROVED" | "REJECTED" };

  const [polls, total] = await Promise.all([
    dbPrisma.advancedPoll.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        Creator: { select: { id: true, name: true, email: true, image: true } },
        _count: { select: { Questions: true, Responses: true } },
      },
    }),
    dbPrisma.advancedPoll.count({ where }),
  ]);

  return NextResponse.json({
    polls: polls.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      type: p.type,
      reviewStatus: p.reviewStatus,
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
      reviewedBy: p.reviewedBy,
      totalResponses: p.totalResponses,
      questionCount: p._count.Questions,
      responseCount: p._count.Responses,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      creator: {
        id: p.Creator.id,
        name: p.Creator.name,
        email: p.Creator.email,
        image: p.Creator.image,
      },
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ─── PATCH — Approve/Reject a poll ───────────────────────────────────────────

const PatchSchema = z.object({
  pollId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
});

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const { pollId, action } = parsed.data;

  const poll = await dbPrisma.advancedPoll.findUnique({ where: { id: pollId } });
  if (!poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
  const now = new Date();

  const updated = await dbPrisma.advancedPoll.update({
    where: { id: pollId },
    data: {
      reviewStatus: newStatus,
      reviewedAt: now,
      reviewedBy: user.id,
      publishedAt: action === "APPROVE" ? (poll.publishedAt ?? now) : poll.publishedAt,
    },
  });

  console.log(`${LOG_PREFIX} Poll ${pollId} ${newStatus} by ${user.email ?? user.id}`);

  return NextResponse.json({
    success: true,
    poll: {
      id: updated.id,
      reviewStatus: updated.reviewStatus,
      reviewedAt: updated.reviewedAt?.toISOString(),
      reviewedBy: updated.reviewedBy,
    },
  });
}

// ─── POST — Create a scheduled poll template ─────────────────────────────────

const CreateScheduledSchema = z.object({
  cronExpression: z.string().min(5).max(100),
  promptTemplate: z.string().min(10).max(2000),
  targetFeedId: z.string().optional(),
  autoPublish: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = CreateScheduledSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const { cronExpression, promptTemplate, targetFeedId, autoPublish } = parsed.data;

  const template = await dbPrisma.scheduledPoll.create({
    data: {
      cronExpression,
      promptTemplate,
      targetFeedId: targetFeedId ?? null,
      autoPublish,
      isActive: true,
      createdBy: user.id!,
    },
  });

  console.log(`${LOG_PREFIX} Scheduled poll template ${template.id} created by ${user.email ?? user.id}`);

  return NextResponse.json({ success: true, template }, { status: 201 });
}

// ─── DELETE — Remove a scheduled poll template ───────────────────────────────

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get("id");

  if (!templateId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const exists = await dbPrisma.scheduledPoll.findUnique({ where: { id: templateId } });
  if (!exists) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await dbPrisma.scheduledPoll.delete({ where: { id: templateId } });
  console.log(`${LOG_PREFIX} Scheduled poll template ${templateId} deleted by ${user.email ?? user.id}`);

  return NextResponse.json({ success: true });
}
