"use server";

/**
 * @fileOverview DSA content report server actions.
 * @stability active
 * @keyInvariants Reports must be persisted (DSA notice-and-action).
 *   Both reporter and content owner must be notifiable.
 */

import { dbPrisma } from "@/lib/db";
import { MyLibUserIDAuth, MyLibRoleAuth } from "@/lib/user-auth";
import type { ReportContentType, ReportReason, ReportStatus } from "@/generated/prisma/client";

export interface SubmitReportResult {
  success: boolean;
  error?: string;
  reportId?: string;
}

/**
 * Submit a content report (any authenticated user).
 */
export async function submitContentReport(input: {
  contentType: ReportContentType;
  contentId: string;
  reason: ReportReason;
  description?: string;
}): Promise<SubmitReportResult> {
  const userId = await MyLibUserIDAuth();
  if (!userId) return { success: false, error: "Ikke autentisert." };

  // Basic validation
  if (!input.contentType || !input.contentId || !input.reason) {
    return { success: false, error: "Mangler påkrevde felt." };
  }

  try {
    // Prevent duplicate reports from same user on same content
    const existing = await dbPrisma.contentReport.findFirst({
      where: {
        reporterId: userId,
        contentType: input.contentType,
        contentId: input.contentId,
        status: { in: ["PENDING", "IN_REVIEW"] },
      },
    });

    if (existing) {
      return { success: false, error: "Du har allerede rapportert dette innholdet." };
    }

    const report = await dbPrisma.contentReport.create({
      data: {
        reporterId: userId,
        contentType: input.contentType,
        contentId: input.contentId,
        reason: input.reason,
        description: input.description || null,
      },
    });

    return { success: true, reportId: report.id };
  } catch (error) {
    console.error("[submitContentReport] Error:", error);
    return { success: false, error: "Kunne ikke sende rapport. Prøv igjen." };
  }
}

/**
 * Resolve a content report (admin only). Creates a ModerationAction record.
 */
export async function resolveContentReport(input: {
  reportId: string;
  action: "CONTENT_REMOVED" | "CONTENT_RESTRICTED" | "ACCOUNT_WARNING" | "ACCOUNT_SUSPENDED" | "ACCOUNT_BANNED" | "DISMISSED" | "REFERRED_TO_AUTHORITY";
  reason: string;
  targetUserId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const role = await MyLibRoleAuth();
  const userId = await MyLibUserIDAuth();
  if (!userId || (role !== "OWNER" && role !== "ADMIN")) {
    return { success: false, error: "Ingen tilgang." };
  }

  try {
    const report = await dbPrisma.contentReport.findUnique({
      where: { id: input.reportId },
    });

    if (!report) return { success: false, error: "Rapport ikke funnet." };
    if (report.status === "RESOLVED" || report.status === "DISMISSED") {
      return { success: false, error: "Rapporten er allerede behandlet." };
    }

    await dbPrisma.$transaction(async (tx) => {
      // Update report status
      const newStatus: ReportStatus = input.action === "DISMISSED" ? "DISMISSED" : "RESOLVED";
      await tx.contentReport.update({
        where: { id: input.reportId },
        data: {
          status: newStatus,
          reviewedById: userId,
          resolutionNote: input.reason,
          resolvedAt: new Date(),
        },
      });

      // Create moderation action record (DSA Art. 17)
      await tx.moderationAction.create({
        data: {
          reportId: input.reportId,
          action: input.action,
          reason: input.reason,
          targetUserId: input.targetUserId || null,
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("[resolveContentReport] Error:", error);
    return { success: false, error: "Kunne ikke behandle rapporten." };
  }
}

/**
 * Submit an appeal against a moderation decision (DSA Art. 20).
 */
export async function submitContentAppeal(input: {
  reportId: string;
  reason: string;
}): Promise<{ success: boolean; error?: string; appealId?: string }> {
  const userId = await MyLibUserIDAuth();
  if (!userId) return { success: false, error: "Ikke autentisert." };

  if (!input.reason || input.reason.trim().length < 10) {
    return { success: false, error: "Vennligst oppgi en begrunnelse (minst 10 tegn)." };
  }

  try {
    // Verify the report exists and was resolved
    const report = await dbPrisma.contentReport.findUnique({
      where: { id: input.reportId },
      include: { ModerationAction: true },
    });

    if (!report || !report.ModerationAction) {
      return { success: false, error: "Finner ingen modereringshandling å anke." };
    }

    // Only the target user (content owner) can appeal
    if (report.ModerationAction.targetUserId !== userId) {
      return { success: false, error: "Du kan bare anke avgjørelser som gjelder ditt innhold." };
    }

    // Check for existing appeal
    const existingAppeal = await dbPrisma.contentAppeal.findFirst({
      where: {
        reportId: input.reportId,
        appellantId: userId,
        status: "PENDING",
      },
    });

    if (existingAppeal) {
      return { success: false, error: "Du har allerede en ventende anke for denne avgjørelsen." };
    }

    const appeal = await dbPrisma.contentAppeal.create({
      data: {
        reportId: input.reportId,
        appellantId: userId,
        reason: input.reason.trim(),
      },
    });

    return { success: true, appealId: appeal.id };
  } catch (error) {
    console.error("[submitContentAppeal] Error:", error);
    return { success: false, error: "Kunne ikke sende anke." };
  }
}

/**
 * Get pending reports for admin moderation queue.
 */
export async function getPendingReports(page = 1, limit = 20) {
  const role = await MyLibRoleAuth();
  if (role !== "OWNER" && role !== "ADMIN") {
    return { success: false, error: "Ingen tilgang.", reports: [], total: 0 };
  }

  try {
    const [reports, total] = await Promise.all([
      dbPrisma.contentReport.findMany({
        where: { status: { in: ["PENDING", "IN_REVIEW"] } },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          Reporter: { select: { id: true, name: true, image: true } },
        },
      }),
      dbPrisma.contentReport.count({
        where: { status: { in: ["PENDING", "IN_REVIEW"] } },
      }),
    ]);

    return { success: true, reports, total };
  } catch (error) {
    console.error("[getPendingReports] Error:", error);
    return { success: false, error: "Feil ved henting av rapporter.", reports: [], total: 0 };
  }
}
