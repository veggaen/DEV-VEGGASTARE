"use server";

/**
 * @fileOverview GDPR account deletion server actions (Art. 17 — right to erasure).
 * @stability active
 * @keyInvariants Schedules deletion 30 days out (grace period). User can cancel.
 *   Actual deletion cascades through all user-related data.
 *   Order data retained for 5 years per bokføringsloven.
 */

import { dbPrisma } from "@/lib/db";
import { MyLibUserIDAuth } from "@/lib/user-auth";

export interface AccountDeletionResult {
  success: boolean;
  error?: string;
  scheduledFor?: string;
  requestId?: string;
}

/**
 * Request account deletion. Creates a 30-day grace period request.
 * The user can cancel during this period.
 */
export async function requestAccountDeletion(
  reason?: string
): Promise<AccountDeletionResult> {
  const userId = await MyLibUserIDAuth();
  if (!userId) return { success: false, error: "Ikke autentisert." };

  try {
    // Check if there's already a pending request
    const existing = await dbPrisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "PROCESSING"] },
        cancelledAt: null,
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Du har allerede en ventende slettingsforespørsel (planlagt ${existing.scheduledFor.toLocaleDateString("nb-NO")}).`,
      };
    }

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 30);

    const request = await dbPrisma.accountDeletionRequest.create({
      data: {
        userId,
        reason: reason || null,
        scheduledFor,
        status: "PENDING",
      },
    });

    return {
      success: true,
      scheduledFor: scheduledFor.toISOString(),
      requestId: request.id,
    };
  } catch (error) {
    console.error("[requestAccountDeletion] Error:", error);
    return { success: false, error: "Kunne ikke opprette slettingsforespørsel." };
  }
}

/**
 * Cancel a pending account deletion request during the grace period.
 */
export async function cancelAccountDeletion(): Promise<{
  success: boolean;
  error?: string;
}> {
  const userId = await MyLibUserIDAuth();
  if (!userId) return { success: false, error: "Ikke autentisert." };

  try {
    const pending = await dbPrisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: "PENDING",
        cancelledAt: null,
      },
    });

    if (!pending) {
      return { success: false, error: "Ingen ventende slettingsforespørsel funnet." };
    }

    await dbPrisma.accountDeletionRequest.update({
      where: { id: pending.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[cancelAccountDeletion] Error:", error);
    return { success: false, error: "Kunne ikke kansellere slettingsforespørselen." };
  }
}

/**
 * Execute account deletion. Should only be called by a cron job or admin
 * after the 30-day grace period. Cascading delete removes most data.
 * Order data is anonymised (not deleted) to comply with bokføringsloven.
 */
export async function executeAccountDeletion(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const request = await dbPrisma.accountDeletionRequest.findUnique({
      where: { id: requestId },
      include: { User: { select: { id: true, email: true } } },
    });

    if (!request || request.status !== "PENDING") {
      return { success: false, error: "Ugyldig eller allerede behandlet forespørsel." };
    }

    if (new Date() < request.scheduledFor) {
      return { success: false, error: "Karensperioden er ikke utløpt ennå." };
    }

    const userId = request.userId;

    await dbPrisma.$transaction(async (tx) => {
      // 1. Anonymise orders (retain for bookkeeping, strip PII)
      await tx.order.updateMany({
        where: { userId },
        data: {
          shippingName: "[slettet]",
          shippingAddress: "[slettet]",
          shippingCity: "[slettet]",
          shippingPostalCode: "[slettet]",
          shippingPhone: "[slettet]",
          // Keep: totalAmount, currency, status, items for bookkeeping
        },
      });

      // 2. Delete user (cascading deletes handle most relations due to onDelete: Cascade)
      await tx.user.delete({ where: { id: userId } });

      // 3. Mark request as completed
      await tx.accountDeletionRequest.update({
        where: { id: requestId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("[executeAccountDeletion] Error:", error);

    // Mark as failed
    try {
      await dbPrisma.accountDeletionRequest.update({
        where: { id: requestId },
        data: { status: "FAILED" },
      });
    } catch { /* noop */ }

    return { success: false, error: "Sletting feilet. Kontakt support." };
  }
}
