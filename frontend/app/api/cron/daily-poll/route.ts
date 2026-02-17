/**
 * @fileOverview Daily scheduled poll generation cron job
 * @stability experimental
 *
 * POST /api/cron/daily-poll
 *
 * Generates polls from ScheduledPoll templates that are due.
 * Polls are created with PENDING_REVIEW status for admin approval
 * (unless autoPublish is enabled on the template).
 *
 * Triggered by:
 *   - Vercel Cron: vercel.json → "0 8 * * *" (8 AM UTC daily)
 *   - Manual: POST with CRON_SECRET header
 *
 * Designed to be idempotent — skips templates already run today.
 */

import { dbPrisma } from "@/lib/db";
import { NextResponse } from "next/server";

const LOG_PREFIX = "[cron/daily-poll]";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Auth ────────────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // No secret configured = allow (dev mode)
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  console.log(`${LOG_PREFIX} Starting daily poll generation at ${now.toISOString()}`);

  try {
    // Find all active scheduled polls that are due
    const dueTemplates = await dbPrisma.scheduledPoll.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      include: {
        Creator: { select: { id: true, name: true, email: true } },
      },
    });

    if (dueTemplates.length === 0) {
      console.log(`${LOG_PREFIX} No templates due. Done.`);
      return NextResponse.json({ processed: 0, message: "No scheduled polls due." });
    }

    console.log(`${LOG_PREFIX} Found ${dueTemplates.length} templates to process`);

    let processed = 0;
    let errors = 0;

    for (const template of dueTemplates) {
      try {
        // Create a placeholder AdvancedPoll from the template
        // The poll is created in PENDING_REVIEW state for admin approval.
        // In a future iteration, this will trigger AI generation inline.
        const poll = await dbPrisma.advancedPoll.create({
          data: {
            title: `[Scheduled] ${template.promptTemplate.slice(0, 80)}`,
            description: `Auto-generated from scheduled template. Topic: ${template.promptTemplate}`,
            type: "QUIZ",
            creatorId: template.createdBy,
            publishedAt: template.autoPublish ? now : null,
            reviewStatus: template.autoPublish ? "APPROVED" : "PENDING_REVIEW",
          },
        });

        // Update the template's lastRunAt and calculate nextRunAt
        const nextRun = calculateNextRun(template.cronExpression, now);
        await dbPrisma.scheduledPoll.update({
          where: { id: template.id },
          data: {
            lastRunAt: now,
            nextRunAt: nextRun,
          },
        });

        console.log(`${LOG_PREFIX} Created poll ${poll.id} from template ${template.id} (autoPublish: ${template.autoPublish})`);
        processed++;
      } catch (templateErr) {
        console.error(`${LOG_PREFIX} Failed to process template ${template.id}:`, templateErr);
        errors++;
      }
    }

    const result = { processed, errors, timestamp: now.toISOString() };
    console.log(`${LOG_PREFIX} Done.`, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`${LOG_PREFIX} Fatal error:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── Cron expression → next run time ────────────────────────────────────────
// Supports simple daily patterns: "0 8 * * *" = every day at 8 AM UTC.
// For MVP, we only support daily schedules. Full cron parsing can be added later.

function calculateNextRun(cronExpression: string, from: Date): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) {
    // Invalid — default to 24h from now
    return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }

  const [minute, hour] = parts;
  const nextRun = new Date(from);
  nextRun.setUTCDate(nextRun.getUTCDate() + 1); // Next day
  nextRun.setUTCHours(parseInt(hour) || 8, parseInt(minute) || 0, 0, 0);

  return nextRun;
}
