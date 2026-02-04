import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSystemPulse, ensureSystemAccount, SYSTEM_ACCOUNT } from "@/lib/system-account";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!GITHUB_WEBHOOK_SECRET || !signature) {
    console.error("[GITHUB_WEBHOOK] Missing secret or signature");
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

/**
 * Parse commit message into a user-friendly pulse format
 */
function formatCommitAsPulse(commits: GitHubCommit[], repo: string): { title: string; content: string } {
  // Get the main commit (most recent)
  const mainCommit = commits[0];
  if (!mainCommit) {
    return {
      title: "Platform Update",
      content: "We've pushed some updates to improve your experience!"
    };
  }

  // Parse conventional commit format: type(scope): message
  const conventionalMatch = mainCommit.message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)/);
  
  let title: string;
  let emoji: string;
  let description: string;

  if (conventionalMatch) {
    const [, type, , message] = conventionalMatch;
    const firstLine = message.split("\n")[0];
    
    // Map commit types to user-friendly titles and emojis
    const typeMap: Record<string, { emoji: string; prefix: string }> = {
      feat: { emoji: "✨", prefix: "New Feature" },
      fix: { emoji: "🐛", prefix: "Bug Fix" },
      perf: { emoji: "⚡", prefix: "Performance Improvement" },
      docs: { emoji: "📚", prefix: "Documentation Update" },
      style: { emoji: "💄", prefix: "Style Update" },
      refactor: { emoji: "♻️", prefix: "Code Improvement" },
      test: { emoji: "✅", prefix: "Testing Update" },
      chore: { emoji: "🔧", prefix: "Maintenance" },
      ci: { emoji: "🚀", prefix: "Deployment Update" },
      build: { emoji: "📦", prefix: "Build Update" },
    };

    const typeInfo = typeMap[type.toLowerCase()] || { emoji: "🔄", prefix: "Update" };
    emoji = typeInfo.emoji;
    title = `${typeInfo.prefix}: ${capitalizeFirst(firstLine)}`;
    description = firstLine;
  } else {
    // Non-conventional commit, use as-is
    const firstLine = mainCommit.message.split("\n")[0];
    emoji = "🔄";
    title = `Platform Update`;
    description = firstLine;
  }

  // Build the content
  const lines: string[] = [];
  lines.push(`Hey Veggat community! ${emoji}\n`);
  lines.push(`We've just deployed some updates:\n`);
  
  // Add main change
  lines.push(`**${description}**\n`);
  
  // If multiple commits, summarize them
  if (commits.length > 1) {
    lines.push(`\nThis update includes ${commits.length} changes to make your experience better.`);
  }
  
  lines.push(`\n---`);
  lines.push(`*Deployed automatically from our development pipeline*`);

  return {
    title,
    content: lines.join("\n"),
  };
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

interface GitHubCommit {
  id: string;
  message: string;
  author: {
    name: string;
    email: string;
    username?: string;
  };
  timestamp: string;
  url: string;
}

interface GitHubPushEvent {
  ref: string;
  before: string;
  after: string;
  repository: {
    name: string;
    full_name: string;
  };
  pusher: {
    name: string;
    email: string;
  };
  commits: GitHubCommit[];
  head_commit: GitHubCommit | null;
}

// POST /api/webhooks/github - Handle GitHub push events
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");

    // Verify webhook signature in production
    if (process.env.NODE_ENV === "production") {
      if (!verifySignature(payload, signature)) {
        console.error("[GITHUB_WEBHOOK] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Only process push events
    if (event !== "push") {
      return NextResponse.json({ message: `Ignored event: ${event}` }, { status: 200 });
    }

    const data: GitHubPushEvent = JSON.parse(payload);

    // Only process pushes to main branch
    if (data.ref !== "refs/heads/main") {
      return NextResponse.json({ message: "Ignored non-main branch push" }, { status: 200 });
    }

    // Skip if no commits
    if (!data.commits || data.commits.length === 0) {
      return NextResponse.json({ message: "No commits in push" }, { status: 200 });
    }

    // Skip automated/bot commits
    const headCommit = data.head_commit || data.commits[0];
    if (
      headCommit.message.includes("[skip-pulse]") ||
      headCommit.message.includes("[bot]") ||
      headCommit.message.toLowerCase().startsWith("merge")
    ) {
      return NextResponse.json({ message: "Skipped automated commit" }, { status: 200 });
    }

    // Ensure system account exists
    await ensureSystemAccount();

    // Format commit as user-friendly pulse
    const { title, content } = formatCommitAsPulse(data.commits, data.repository.name);

    // Create the system pulse
    const result = await createSystemPulse({
      title,
      content,
      tags: ["update", "changelog", "automated"],
      postedByUserId: SYSTEM_ACCOUNT.id, // System posts on its own behalf
    });

    console.log(`[GITHUB_WEBHOOK] Created pulse for ${data.commits.length} commits, notified ${result.notificationCount} users`);

    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
      notifiedUsers: result.notificationCount,
      message: `Pulse created: ${title}`,
    });
  } catch (error) {
    console.error("[GITHUB_WEBHOOK] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "GitHub webhook endpoint ready",
    configured: !!GITHUB_WEBHOOK_SECRET,
  });
}
