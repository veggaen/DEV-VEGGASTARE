import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSystemPulse, ensureSystemAccount, SYSTEM_ACCOUNT } from "@/lib/system-account";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const LOG = "[GITHUB_WEBHOOK]";

/**
 * Verify GitHub webhook signature (HMAC-SHA256)
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!GITHUB_WEBHOOK_SECRET || !signature) {
    console.error(LOG, "Missing secret or signature");
    return false;
  }
  const hmac = crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Commit type → user-friendly label ──────────────────────────────────────

const TYPE_MAP: Record<string, { emoji: string; label: string }> = {
  feat:     { emoji: "✨", label: "New Feature" },
  fix:      { emoji: "🐛", label: "Bug Fix" },
  perf:     { emoji: "⚡", label: "Performance" },
  docs:     { emoji: "📚", label: "Docs" },
  style:    { emoji: "💄", label: "Style" },
  refactor: { emoji: "♻️", label: "Refactor" },
  test:     { emoji: "✅", label: "Tests" },
  chore:    { emoji: "🔧", label: "Maintenance" },
  ci:       { emoji: "🚀", label: "CI/CD" },
  build:    { emoji: "📦", label: "Build" },
  merge:    { emoji: "🔀", label: "Deploy" },
};

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Parse a single commit message into its type and description.
 * Handles conventional commits (feat: ...) and merge commits (merge: dev -> main — ...).
 */
function parseCommitMessage(msg: string): { type: string; description: string } {
  // Merge commit: "merge: dev -> main — multi-wallet, AI gen fix, infra hardening"
  const mergeMatch = msg.match(/^merge:\s*\w+\s*->\s*\w+\s*[—\-]\s*(.+)/i);
  if (mergeMatch) return { type: "merge", description: mergeMatch[1].trim() };

  // Conventional: "feat: multi-wallet + AI generation fixes"
  const convMatch = msg.match(/^(\w+)(?:\([^)]*\))?:\s*(.+)/);
  if (convMatch) return { type: convMatch[1].toLowerCase(), description: convMatch[2].split("\n")[0].trim() };

  // Fallback
  return { type: "update", description: msg.split("\n")[0].trim() };
}

/**
 * Build a clean deploy pulse from the push event.
 * `target` is "production" (main) or "preview" (dev).
 */
function buildPulseContent(
  commits: GitHubCommit[],
  target: "production" | "preview",
): { title: string; content: string } {
  const isProduction = target === "production";
  const envLabel = isProduction ? "Production" : "Preview";
  const envEmoji = isProduction ? "🚀" : "🧪";

  // Find the "real" feature commits — skip merge commits for the list
  const featureCommits = commits.filter((c) => !c.message.toLowerCase().startsWith("merge"));
  // If the push is ONLY a merge commit, parse its description instead
  const headCommit = commits[0];
  const { type: headType, description: headDesc } = parseCommitMessage(headCommit?.message || "");

  const headInfo = TYPE_MAP[headType] || { emoji: "🔄", label: "Update" };

  // Title: concise one-liner
  const title = featureCommits.length > 0
    ? `${headInfo.emoji} ${headInfo.label}: ${capitalizeFirst(parseCommitMessage(featureCommits[0].message).description)}`
    : `${envEmoji} ${envLabel} Deploy: ${capitalizeFirst(headDesc)}`;

  // Content: clean bullet list
  const lines: string[] = [];
  lines.push(`${envEmoji} **Deployed to ${envLabel}**\n`);

  if (featureCommits.length > 0) {
    for (const c of featureCommits.slice(0, 8)) {
      const { type, description } = parseCommitMessage(c.message);
      const info = TYPE_MAP[type] || { emoji: "•", label: "" };
      lines.push(`${info.emoji} ${capitalizeFirst(description)}`);
    }
    if (featureCommits.length > 8) {
      lines.push(`\n+${featureCommits.length - 8} more changes`);
    }
  } else {
    // Merge-only push: show the merge description
    lines.push(`${headInfo.emoji} ${capitalizeFirst(headDesc)}`);
  }

  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  lines.push(`\n— VeggaSystem · ${dateStr}`);

  return { title, content: lines.join("\n") };
}

// ── Types ──────────────────────────────────────────────────────────────────

interface GitHubCommit {
  id: string;
  message: string;
  author: { name: string; email: string; username?: string };
  timestamp: string;
  url: string;
}

interface GitHubPushEvent {
  ref: string;
  before: string;
  after: string;
  repository: { name: string; full_name: string };
  pusher: { name: string; email: string };
  commits: GitHubCommit[];
  head_commit: GitHubCommit | null;
}

// ── POST handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");

    // Verify webhook signature in production
    if (process.env.NODE_ENV === "production") {
      if (!verifySignature(payload, signature)) {
        console.error(LOG, "Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Only process push events
    if (event !== "push") {
      return NextResponse.json({ message: `Ignored event: ${event}` }, { status: 200 });
    }

    const data: GitHubPushEvent = JSON.parse(payload);

    // Accept pushes to main (production) and dev (preview)
    const branchMap: Record<string, "production" | "preview"> = {
      "refs/heads/main": "production",
      "refs/heads/dev": "preview",
    };
    const target = branchMap[data.ref];
    if (!target) {
      return NextResponse.json({ message: `Ignored branch: ${data.ref}` }, { status: 200 });
    }

    // Skip if no commits
    if (!data.commits || data.commits.length === 0) {
      return NextResponse.json({ message: "No commits in push" }, { status: 200 });
    }

    // Only skip explicit opt-outs and bots — NOT merge commits
    const headCommit = data.head_commit || data.commits[0];
    if (
      headCommit.message.includes("[skip-pulse]") ||
      headCommit.message.includes("[bot]") ||
      headCommit.author?.username === "dependabot[bot]"
    ) {
      return NextResponse.json({ message: "Skipped automated commit" }, { status: 200 });
    }

    // Ensure system account exists
    await ensureSystemAccount();

    // Build clean pulse content
    const { title, content } = buildPulseContent(data.commits, target);

    // Create the system pulse
    const result = await createSystemPulse({
      title,
      content,
      tags: ["update", "changelog", target === "production" ? "production" : "preview"],
      postedByUserId: SYSTEM_ACCOUNT.id,
    });

    console.log(LOG, `[${target}] Pulse created for ${data.commits.length} commits → ${result.conversationId}`);

    return NextResponse.json({
      success: true,
      target,
      conversationId: result.conversationId,
      notifiedUsers: result.notificationCount,
      message: `Pulse created: ${title}`,
    });
  } catch (error) {
    console.error(LOG, "Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

// GET — Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "GitHub webhook endpoint ready",
    configured: !!GITHUB_WEBHOOK_SECRET,
  });
}
