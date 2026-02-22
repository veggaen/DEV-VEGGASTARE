/**
 * Shared AI chat safety utilities — injection detection, sensitive data scanning,
 * HTML sanitization. Used by all AI chat API routes.
 */

import "server-only";
import { createHash } from "crypto";

// ── Prompt injection filter ────────────────────────────────────────────────
export const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(if|a|an|the)\s+/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /\<\|im_start\|\>/i,
  /\<\|system\|\>/i,
  /do\s+not\s+follow\s+(your|the)\s+(rules|instructions|guidelines)/i,
  /override\s+(your|the|system)\s+(rules|instructions|prompt)/i,
  /reveal\s+(your|the)\s+(system|hidden)\s+(prompt|instructions)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

export function checkInjection(text: string): { blocked: boolean; reason?: string } {
  const trimmed = text.trim();
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { blocked: true, reason: "Message contains disallowed patterns." };
    }
  }
  return { blocked: false };
}

// ── Sensitive data detection ───────────────────────────────────────────────
const SENSITIVE_PATTERNS = [
  { type: "email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: "phone", regex: /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g },
];

export function detectSensitiveData(text: string): {
  found: boolean;
  types: string[];
  /** hashed fingerprints for audit logging — never store the raw values */
  fingerprints: string[];
} {
  const types: string[] = [];
  const fingerprints: string[] = [];

  for (const { type, regex } of SENSITIVE_PATTERNS) {
    const matches = Array.from(text.matchAll(regex));
    if (matches.length > 0) {
      types.push(type);
      // Hash each match for audit — we track patterns without storing PII
      for (const m of matches) {
        fingerprints.push(
          createHash("sha256").update(m[0].toLowerCase()).digest("hex").slice(0, 16)
        );
      }
    }
  }

  return { found: types.length > 0, types, fingerprints };
}

// ── HTML strip (prevent UI hijacking via AI output) ────────────────────────
export function stripHtml(raw: string): string {
  return raw.replace(/<[^>]*>/g, "");
}

// ── Anonymous rate limiter (in-memory, resets on cold start) ───────────────
const ipLimits = new Map<string, { count: number; resetAt: number }>();

const ANON_LIMIT = parseInt(process.env.ANON_CHAT_LIMIT ?? "10", 10);
const ANON_MSG_MAX = parseInt(process.env.ANON_MAX_MSG_LENGTH ?? "500", 10);
const ANON_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export { ANON_MSG_MAX };

export function checkAnonRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = ipLimits.get(ip);

  if (!entry || entry.resetAt <= now) {
    ipLimits.set(ip, { count: 1, resetAt: now + ANON_WINDOW_MS });
    return { allowed: true, remaining: ANON_LIMIT - 1, resetAt: now + ANON_WINDOW_MS };
  }

  if (entry.count >= ANON_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: ANON_LIMIT - entry.count, resetAt: entry.resetAt };
}

export function getRequestIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── Gemini streaming helper ────────────────────────────────────────────────
export type ChatMessage = { role: "user" | "model"; parts: Array<{ text: string }> };

export function buildGeminiContents(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): ChatMessage[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

/** System prompts for BYOK AI participant modes */
export function buildAiParticipantSystemPrompt(opts: {
  displayName: string;
  mode: "CONTEXT_ONLY" | "DEEP_ANALYSIS";
  brief: boolean;
}): string {
  const base =
    opts.mode === "DEEP_ANALYSIS"
      ? `You are ${opts.displayName}, an AI assistant in this group conversation. Before responding, analyze the conversation from multiple angles — consider the underlying question, relevant context from your knowledge, potential implications, and any cross-references that would be helpful. Provide a well-considered response that goes beyond the immediate chat context.`
      : `You are ${opts.displayName}, an AI assistant in this group conversation. Read the conversation history carefully and provide a helpful, relevant response. Base your answer only on what has been discussed in this chat.`;

  return opts.brief
    ? `${base} Keep your response concise — 1 to 3 sentences maximum.`
    : base;
}
