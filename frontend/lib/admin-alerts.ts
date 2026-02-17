/**
 * @fileOverview Admin alert system for platform owner notifications.
 * @stability stable
 *
 * Sends critical alerts to the platform owner via:
 * 1. Email (Resend) — for persistent record
 * 2. Console logging — always available
 *
 * Used for: Brave search budget exhaustion, cron failures, system warnings.
 */

import "server-only";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_EMAIL = process.env.PLATFORM_OWNER_EMAIL;

export type AdminAlertType =
  | "SEARCH_BUDGET_EXHAUSTED"
  | "CRON_FAILURE"
  | "PICOCLAW_DOWN"
  | "SYSTEM_WARNING";

interface AlertPayload {
  type: AdminAlertType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

const ALERT_SUBJECTS: Record<AdminAlertType, string> = {
  SEARCH_BUDGET_EXHAUSTED: "⚠️ Brave Search Budget Reached — Using DDG",
  CRON_FAILURE: "🚨 Scheduled Poll Cron Failed",
  PICOCLAW_DOWN: "🔴 PicoClaw Sidecar Unreachable",
  SYSTEM_WARNING: "⚠️ Veggat System Warning",
};

/**
 * Send an admin alert to the platform owner.
 * Fails silently if email is not configured (logs to console as fallback).
 */
export async function sendAdminAlert(payload: AlertPayload): Promise<void> {
  const { type, title, message, data } = payload;

  // Always log to console
  console.warn(`[ADMIN-ALERT] [${type}] ${title}: ${message}`, data ?? "");

  // Send email if configured
  if (!OWNER_EMAIL || !process.env.RESEND_API_KEY) {
    console.warn("[ADMIN-ALERT] Skipping email — PLATFORM_OWNER_EMAIL or RESEND_API_KEY not set.");
    return;
  }

  try {
    await resend.emails.send({
      from: "Veggat-System@veggat.com",
      to: OWNER_EMAIL,
      subject: ALERT_SUBJECTS[type] || `Veggat Alert: ${title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">${title}</h2>
          <p style="font-size: 16px; color: #333;">${message}</p>
          ${
            data
              ? `<pre style="background: #f5f5f5; padding: 16px; border-radius: 8px; font-size: 13px; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>`
              : ""
          }
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">
            Automated alert from Veggat Platform • ${new Date().toISOString()}
          </p>
        </div>
      `,
    });
  } catch (err) {
    // Email failure should never crash the calling function
    console.error("[ADMIN-ALERT] Failed to send email:", err);
  }
}

/**
 * Convenience: notify owner that Brave search budget is exhausted.
 */
export async function notifySearchBudgetExhausted(
  month: string,
  braveCount: number,
  braveLimit: number
): Promise<void> {
  await sendAdminAlert({
    type: "SEARCH_BUDGET_EXHAUSTED",
    title: "Brave Search Monthly Limit Reached",
    message: `Brave API searches hit the limit (${braveCount}/${braveLimit}) for ${month}. All research will use DuckDuckGo (free) until next month. No charges will be incurred.`,
    data: { month, braveCount, braveLimit, fallback: "DuckDuckGo" },
  });
}

/**
 * Convenience: notify owner that PicoClaw sidecar is unreachable.
 */
export async function notifyPicoClawDown(error: string): Promise<void> {
  await sendAdminAlert({
    type: "PICOCLAW_DOWN",
    title: "PicoClaw Sidecar Unreachable",
    message: `PicoClaw at ${process.env.PICOCLAW_URL || "(not configured)"} failed to respond. Poll generation will continue without web research. Error: ${error}`,
    data: { picoClawUrl: process.env.PICOCLAW_URL, error },
  });
}
