/**
 * @fileOverview PicoClaw research sidecar client — web search + fact-checking
 * @stability experimental
 *
 * Calls the PicoClaw gateway (Go binary on Railway) for:
 *   1) researchTopic() — pre-generation web search to ground the AI in real data
 *   2) validatePoll()  — post-generation fact-checking to catch errors
 *
 * Both functions are guarded by PICOCLAW_ENABLED env var and fail gracefully
 * (return null) if the sidecar is unreachable — the poll pipeline continues
 * without research/validation in that case.
 *
 * Search budget is tracked via lib/search-budget.ts (Brave hard cap + DDG fallback).
 */

import {
  resolveSearchProvider,
  incrementBraveUsage,
  incrementDdgUsage,
} from "@/lib/search-budget";
import { notifyPicoClawDown, notifySearchBudgetExhausted } from "@/lib/admin-alerts";

// ── Config ─────────────────────────────────────────────────────────────────

const PICOCLAW_URL = process.env.PICOCLAW_URL || "";
const PICOCLAW_API_KEY = process.env.PICOCLAW_API_KEY || "";
const PICOCLAW_ENABLED = process.env.PICOCLAW_ENABLED === "true";

const RESEARCH_TIMEOUT_MS = 20_000; // 20s — must leave room for generation + validation
const VALIDATE_TIMEOUT_MS = 10_000; // 10s

// ── Types ──────────────────────────────────────────────────────────────────

export interface ResearchResult {
  /** Key facts discovered from web search */
  facts: string[];
  /** Common misconceptions about this topic */
  misconceptions: string[];
  /** Recent events/updates relevant to the topic */
  recentEvents: string[];
  /** Statistics or data points found */
  statistics: string[];
  /** Which search provider was used */
  searchProvider: "brave" | "ddg";
  /** Raw summary for injection into system prompt */
  summary: string;
}

export interface ValidationCorrection {
  questionIndex: number;
  field: "questionText" | "correctAnswer" | "explanation" | "wrongExplanation" | "deepExplanation" | "options";
  originalValue: string;
  suggestedValue: string;
  reason: string;
  confidence: number; // 0-100
}

export interface ValidationResult {
  /** Overall quality assessment */
  overallScore: number; // 0-100
  /** Individual corrections to apply */
  corrections: ValidationCorrection[];
  /** General feedback about the poll */
  feedback: string;
  /** Whether the poll is factually sound overall */
  factuallySound: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isPicoClawAvailable(): boolean {
  return PICOCLAW_ENABLED && !!PICOCLAW_URL && !!PICOCLAW_API_KEY;
}

/** Track internally if we've already sent a "PicoClaw down" alert this process */
let _picoClawDownAlerted = false;

async function callPicoClaw<T>(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<T | null> {
  if (!isPicoClawAvailable()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${PICOCLAW_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PICOCLAW_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`[PicoClaw] ${endpoint} returned ${res.status}:`, await res.text().catch(() => ""));
      return null;
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn(`[PicoClaw] ${endpoint} timed out after ${timeoutMs}ms`);
    } else {
      console.error(`[PicoClaw] ${endpoint} failed:`, err?.message || err);
      // Notify owner once per process if sidecar is completely unreachable
      if (!_picoClawDownAlerted) {
        _picoClawDownAlerted = true;
        notifyPicoClawDown(err?.message || "Connection failed").catch(() => {});
      }
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Research a topic using web search before AI generation.
 * Returns facts, misconceptions, recent events, and statistics to inject
 * into the system prompt for grounded, accurate poll generation.
 *
 * @param topic - The user's prompt / topic for the poll
 * @param options - Optional config (e.g. user's BYOK key for research)
 * @returns ResearchResult or null if PicoClaw is unavailable/timed out
 */
export async function researchTopic(
  topic: string,
  options?: {
    /** User's API key for research (BYOK) — overrides platform key */
    userApiKey?: string;
    /** Which provider to use for the LLM reasoning (not search) */
    provider?: string;
    /** Model override */
    model?: string;
  }
): Promise<ResearchResult | null> {
  // Determine which search provider to use (Brave vs DDG based on budget)
  const budget = await resolveSearchProvider();
  const searchProvider = budget.provider;

  const result = await callPicoClaw<{
    facts?: string[];
    misconceptions?: string[];
    recentEvents?: string[];
    statistics?: string[];
    summary?: string;
  }>("/api/research", {
    topic,
    search_provider: searchProvider,
    ...(options?.userApiKey && { api_key: options.userApiKey }),
    ...(options?.provider && { provider: options.provider }),
    ...(options?.model && { model: options.model }),
  }, RESEARCH_TIMEOUT_MS);

  if (!result) return null;

  // Track search usage
  if (searchProvider === "brave") {
    const limitHit = await incrementBraveUsage();
    if (limitHit) {
      // Budget just exhausted — notify owner asynchronously
      const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
      notifySearchBudgetExhausted(currentMonth, 900, 900).catch(() => {});
    }
  } else {
    await incrementDdgUsage().catch(() => {});
  }

  return {
    facts: result.facts || [],
    misconceptions: result.misconceptions || [],
    recentEvents: result.recentEvents || [],
    statistics: result.statistics || [],
    searchProvider,
    summary: result.summary || buildSummary(result),
  };
}

/**
 * Validate a generated poll for factual accuracy and quality.
 * Returns corrections with confidence scores — auto-apply those >80%.
 *
 * @param pollData - The generated poll JSON to validate
 * @param topic - Original user topic (for context)
 * @returns ValidationResult or null if PicoClaw is unavailable/timed out
 */
export async function validatePoll(
  pollData: Record<string, unknown>,
  topic: string
): Promise<ValidationResult | null> {
  const result = await callPicoClaw<{
    overallScore?: number;
    corrections?: Array<{
      questionIndex: number;
      field: string;
      originalValue: string;
      suggestedValue: string;
      reason: string;
      confidence: number;
    }>;
    feedback?: string;
    factuallySound?: boolean;
  }>("/api/validate", {
    poll: pollData,
    topic,
  }, VALIDATE_TIMEOUT_MS);

  if (!result) return null;

  return {
    overallScore: result.overallScore ?? 50,
    corrections: (result.corrections || []).map((c) => ({
      questionIndex: c.questionIndex,
      field: c.field as ValidationCorrection["field"],
      originalValue: c.originalValue || "",
      suggestedValue: c.suggestedValue || "",
      reason: c.reason || "",
      confidence: Math.max(0, Math.min(100, c.confidence || 0)),
    })),
    feedback: result.feedback || "",
    factuallySound: result.factuallySound ?? true,
  };
}

/**
 * Apply high-confidence corrections to poll data in-place.
 * Returns the number of corrections applied.
 *
 * @param pollData - Mutable poll data object
 * @param corrections - Array of corrections from validatePoll()
 * @param minConfidence - Minimum confidence threshold (default: 80)
 */
export function applyCorrections(
  pollData: { questions: any[] },
  corrections: ValidationCorrection[],
  minConfidence = 80
): number {
  let applied = 0;

  for (const c of corrections) {
    if (c.confidence < minConfidence) continue;
    const question = pollData.questions[c.questionIndex];
    if (!question) continue;

    if (c.field === "options") {
      // Options corrections are more complex — skip auto-apply for safety
      continue;
    }

    if (c.field in question) {
      question[c.field] = c.suggestedValue;
      applied++;
    }
  }

  return applied;
}

/**
 * Build a research context block to inject into the system prompt.
 * This gives the LLM real data to work with instead of hallucinating.
 */
export function buildResearchContext(research: ResearchResult): string {
  const sections: string[] = [];

  if (research.facts.length > 0) {
    sections.push(`### Verified Facts\n${research.facts.map((f) => `- ${f}`).join("\n")}`);
  }
  if (research.misconceptions.length > 0) {
    sections.push(`### Common Misconceptions (avoid these)\n${research.misconceptions.map((m) => `- ${m}`).join("\n")}`);
  }
  if (research.recentEvents.length > 0) {
    sections.push(`### Recent Developments\n${research.recentEvents.map((e) => `- ${e}`).join("\n")}`);
  }
  if (research.statistics.length > 0) {
    sections.push(`### Data & Statistics\n${research.statistics.map((s) => `- ${s}`).join("\n")}`);
  }

  if (sections.length === 0) return "";

  return `\n\n## RESEARCH CONTEXT (from verified web sources — use this data)\n\n${sections.join("\n\n")}\n\nIMPORTANT: Prefer the facts above over your training data. If the research contradicts your knowledge, trust the research (it's more recent). Flag any discrepancies in the deepExplanation.`;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function buildSummary(result: {
  facts?: string[];
  misconceptions?: string[];
  recentEvents?: string[];
  statistics?: string[];
}): string {
  const parts: string[] = [];
  if (result.facts?.length) parts.push(`${result.facts.length} facts found`);
  if (result.misconceptions?.length) parts.push(`${result.misconceptions.length} common misconceptions identified`);
  if (result.recentEvents?.length) parts.push(`${result.recentEvents.length} recent developments`);
  if (result.statistics?.length) parts.push(`${result.statistics.length} data points`);
  return parts.join(", ") || "No research data available.";
}

/**
 * Check if PicoClaw integration is enabled and configured.
 * Useful for conditional UI or feature flags.
 */
export function isPicoClawEnabled(): boolean {
  return isPicoClawAvailable();
}
