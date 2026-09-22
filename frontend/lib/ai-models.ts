/**
 * @fileOverview Shared AI model/provider catalog for the landing chat widget and poll builder.
 * Defines providers, models, capabilities, and key auto-detection.
 * @stability stable
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiProvider = "VERCEL" | "OPENAI" | "OPENROUTER" | "ANTHROPIC" | "GOOGLE" | "GROK" | "GROQ";

export type AiModelCapability =
  | "vision"
  | "tools"
  | "reasoning"
  | "fast"
  | "cheap"
  | "flagship"
  | "coding"
  | "long-context";

export type AiModelGroup = "recommended" | "standard" | "legacy";

export interface AiModelOption {
  /** Model ID sent to the API */
  value: string;
  /** Display name */
  label: string;
  /** Short description / subtitle */
  description?: string;
  /** Default model for this provider */
  isDefault?: boolean;
  capabilities?: AiModelCapability[];
  group?: AiModelGroup;
  /** Supports extended thinking / reasoning mode */
  supportsThinking?: boolean;
  /** Context window size label (e.g. "128K") */
  contextSize?: string;
}

export type AiProviderTier = "free" | "premium" | "byok-only";

export interface AiProviderDef {
  value: AiProvider;
  label: string;
  emoji: string;
  /** One-line tagline for the provider list */
  tagline: string;
  /** Direct URL to get an API key */
  getKeyUrl: string;
  /** Whether this provider has a free tier via platform keys */
  freeAvailable: boolean;
  /**
   * Cost tier for the model selector UI.
   * - "free": available to everyone (platform key, no cost to user)
   * - "premium": available via purchased credits or BYOK
   * - "byok-only": user must supply their own key
   */
  tier: AiProviderTier;
  /** Short pricing note */
  pricingNote: string;
  models: AiModelOption[];
}

// ─── Capability badges ────────────────────────────────────────────────────────

export const CAPABILITY_BADGES: Record<
  AiModelCapability,
  { label: string; color: string; tip: string }
> = {
  vision:         { label: "Vision",    color: "bg-blue-500/15 text-blue-400 border-blue-500/20",       tip: "Supports image inputs" },
  tools:          { label: "Tools",     color: "bg-amber-500/15 text-amber-400 border-amber-500/20",    tip: "Function calling & tool use" },
  reasoning:      { label: "Reasoning", color: "bg-purple-500/15 text-purple-400 border-purple-500/20", tip: "Chain-of-thought reasoning" },
  fast:           { label: "Fast",      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", tip: "Optimised for speed" },
  cheap:          { label: "Cheap",     color: "bg-lime-500/15 text-lime-400 border-lime-500/20",       tip: "Very low cost per token" },
  flagship:       { label: "Flagship",  color: "bg-violet-500/15 text-violet-400 border-violet-500/20", tip: "Top-tier model from this provider" },
  coding:         { label: "Code",      color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",       tip: "Optimised for code generation" },
  "long-context": { label: "Long ctx",  color: "bg-orange-500/15 text-orange-400 border-orange-500/20", tip: "Extended context window" },
};

// ─── Provider + Model catalog ─────────────────────────────────────────────────

export const AI_PROVIDERS: AiProviderDef[] = [
  {
    value: "VERCEL",
    label: "Vercel AI Gateway",
    emoji: "▲",
    tagline: "Fast hosted preview with no API key required",
    getKeyUrl: "https://vercel.com/ai-gateway",
    freeAvailable: true,
    tier: "free",
    pricingNote: "Free preview",
    models: [
      { value: "inclusionai/ling-3.0-flash-fin-free", label: "Ling 3.0 Flash", description: "Fast free preview model routed by Vercel", isDefault: true, capabilities: ["fast", "reasoning"], group: "recommended" },
    ],
  },
  {
    value: "GOOGLE",
    label: "Google Gemini",
    emoji: "🔷",
    tagline: "Lightning-fast with surprising capability",
    getKeyUrl: "https://aistudio.google.com/apikey",
    freeAvailable: true,
    tier: "free",
    pricingNote: "Free preview",
    models: [
      { value: "gemini-2.5-flash-lite",  label: "Gemini 2.5 Flash-Lite", description: "Reliable, low-latency model for the free showcase", isDefault: true, capabilities: ["fast", "cheap"], group: "recommended", contextSize: "1M" },
      { value: "gemini-3.8-flash",       label: "Gemini 3.8 Flash",      description: "Latest stable Flash model — fast and highly capable", capabilities: ["flagship", "fast", "vision", "tools", "reasoning"], group: "recommended", contextSize: "1M" },
      { value: "gemini-3.7-flash",       label: "Gemini 3.7 Flash",      description: "Stable previous-generation Flash model",                              capabilities: ["fast", "vision", "tools"],                          group: "recommended", contextSize: "1M" },
      { value: "gemini-3.6-flash",       label: "Gemini 3.6 Flash",      description: "Balanced stable model for everyday tasks",                            capabilities: ["fast", "vision", "tools"],                          group: "standard",    contextSize: "1M" },
      { value: "gemini-3.5-flash-lite",  label: "Gemini 3.5 Flash-Lite", description: "Lowest-latency option for simple tasks",                              capabilities: ["fast", "cheap"],                                    group: "standard",    contextSize: "1M" },
    ],
  },
  {
    value: "GROQ",
    label: "Groq",
    emoji: "⚡",
    tagline: "Blazing-fast open models on custom hardware",
    getKeyUrl: "https://console.groq.com/keys",
    freeAvailable: true,
    tier: "free",
    pricingNote: "Free with sign-in, subject to daily limits",
    models: [
      { value: "openai/gpt-oss-20b",      label: "GPT-OSS 20B",               description: "Fast, cost-efficient open-weight model", isDefault: true, capabilities: ["fast", "cheap", "reasoning", "tools"], group: "recommended", contextSize: "128K" },
      { value: "openai/gpt-oss-120b",     label: "GPT-OSS 120B",              description: "Large open-weight reasoning model",                       capabilities: ["reasoning", "tools"],                  group: "recommended", contextSize: "128K" },
      { value: "qwen/qwen3.8-27b",        label: "Qwen 3.8 27B",               description: "Current multilingual reasoning model",                    capabilities: ["fast", "reasoning", "tools"],          group: "standard",    contextSize: "128K" },
    ],
  },
  {
    value: "OPENAI",
    label: "OpenAI",
    emoji: "🧠",
    tagline: "GPT-5.6 frontier models for every workload",
    getKeyUrl: "https://platform.openai.com/api-keys",
    freeAvailable: false,
    tier: "premium",
    pricingNote: "Credits or BYOK",
    models: [
      { value: "gpt-5.6-luna",   label: "GPT-5.6 Luna",           description: "Fast, cost-sensitive GPT-5.6 model",                 isDefault: true, capabilities: ["fast", "cheap", "vision", "tools", "reasoning"], group: "recommended", contextSize: "1M", supportsThinking: true },
      { value: "gpt-5.6-terra",  label: "GPT-5.6 Terra",          description: "Balanced intelligence and cost",                                      capabilities: ["flagship", "vision", "tools", "reasoning"],        group: "recommended", contextSize: "1M", supportsThinking: true },
      { value: "gpt-5.6-sol",    label: "GPT-5.6 Sol",            description: "Frontier model for complex professional work",                       capabilities: ["flagship", "vision", "tools", "reasoning", "coding"], group: "recommended", contextSize: "1M", supportsThinking: true },
      { value: "gpt-4.1",        label: "GPT-4.1",                description: "Reliable and cost-effective",                                       capabilities: ["vision", "tools"],                          group: "standard",    contextSize: "128K" },
      { value: "gpt-4.1-mini",   label: "GPT-4.1 Mini",           description: "Smaller, faster, cheaper",                                         capabilities: ["fast", "cheap", "vision", "tools"],         group: "standard",    contextSize: "128K" },
      { value: "gpt-4o",         label: "GPT-4o",                 description: "Previous multimodal flagship",                                      capabilities: ["vision", "tools"],                          group: "standard",    contextSize: "128K" },
      { value: "gpt-4o-mini",    label: "GPT-4o Mini",            description: "Affordable and quick",                                              capabilities: ["fast", "cheap", "vision"],                  group: "legacy",      contextSize: "128K" },
      { value: "o4-mini",        label: "o4 Mini",                description: "Reasoning-focused, compact",                                        capabilities: ["reasoning", "tools"],                       group: "standard",    contextSize: "128K", supportsThinking: true },
    ],
  },
  {
    value: "ANTHROPIC",
    label: "Anthropic",
    emoji: "🎭",
    tagline: "Claude — thoughtful, nuanced, and capable",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    freeAvailable: false,
    tier: "premium",
    pricingNote: "Credits or BYOK",
    models: [
      { value: "claude-sonnet-4-6",            label: "Claude Sonnet 4.6", description: "Reliable balance of intelligence, speed, and cost", isDefault: true, capabilities: ["flagship", "vision", "tools", "coding", "reasoning"], group: "recommended", contextSize: "200K", supportsThinking: true },
      { value: "claude-opus-4-8",              label: "Claude Opus 4.8",   description: "Advanced reasoning for ambitious work",                                     capabilities: ["flagship", "vision", "tools", "reasoning", "coding"], group: "recommended", contextSize: "200K", supportsThinking: true },
      { value: "claude-haiku-4-5-20251001",    label: "Claude Haiku 4.5",  description: "Fast and lightweight",                                                       capabilities: ["fast", "cheap", "tools"],                            group: "standard",    contextSize: "200K" },
    ],
  },
  {
    value: "GROK",
    label: "Grok (xAI)",
    emoji: "🚀",
    tagline: "Real-time knowledge with a unique perspective",
    getKeyUrl: "https://console.x.ai",
    freeAvailable: false,
    tier: "premium",
    pricingNote: "Credits or BYOK",
    models: [
      { value: "grok-4.7",     label: "Grok 4.7",            description: "xAI's current flagship for chat and code", isDefault: true, capabilities: ["flagship", "vision", "tools", "reasoning", "coding"], group: "recommended", contextSize: "500K", supportsThinking: true },
    ],
  },
  {
    value: "OPENROUTER",
    label: "OpenRouter",
    emoji: "🌐",
    tagline: "One key, every model — unified API gateway",
    getKeyUrl: "https://openrouter.ai/keys",
    freeAvailable: false,
    tier: "byok-only",
    pricingNote: "Pay-per-use, many free models",
    models: [
      { value: "openai/gpt-4o",                            label: "GPT-4o (via OR)",             description: "OpenAI model routed via OpenRouter",   isDefault: true, capabilities: ["vision", "tools"],            group: "recommended", contextSize: "128K" },
      { value: "openai/gpt-4o-mini",                       label: "GPT-4o Mini (via OR)",        description: "Affordable OpenAI via OpenRouter",                      capabilities: ["fast", "cheap", "vision"],    group: "standard",    contextSize: "128K" },
      { value: "anthropic/claude-sonnet-4.6",               label: "Claude Sonnet 4.6 (via OR)",  description: "Anthropic routed via OpenRouter",                       capabilities: ["flagship", "vision", "tools"],group: "recommended", contextSize: "200K" },
      { value: "google/gemini-3.8-flash",                   label: "Gemini 3.8 Flash (via OR)",   description: "Google model via OpenRouter",                            capabilities: ["flagship", "vision", "fast"], group: "standard",    contextSize: "1M"   },
      { value: "meta-llama/llama-3.3-70b-instruct",         label: "Llama 3.3 70B (via OR)",      description: "Meta open model via OpenRouter",                         capabilities: ["fast"],                       group: "standard",    contextSize: "128K" },
    ],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getProviderDef(provider: AiProvider): AiProviderDef | undefined {
  return AI_PROVIDERS.find((p) => p.value === provider);
}

export function getDefaultModel(provider: AiProvider): AiModelOption | undefined {
  const prov = getProviderDef(provider);
  return prov?.models.find((m) => m.isDefault) ?? prov?.models[0];
}

export function getModelDef(provider: AiProvider, modelId: string): AiModelOption | undefined {
  return getProviderDef(provider)?.models.find((m) => m.value === modelId);
}

/** Detect provider from API key prefix */
export function inferProviderFromApiKey(input: string): AiProvider | null {
  const key = input.trim();
  const lower = key.toLowerCase();
  if (!lower) return null;
  if (lower.startsWith("gsk_"))     return "GROQ";
  if (lower.startsWith("sk-or-"))   return "OPENROUTER";
  if (lower.startsWith("sk-ant-"))  return "ANTHROPIC";
  if (lower.startsWith("xai-"))     return "GROK";
  if (key.startsWith("AIza"))       return "GOOGLE";
  if (lower.startsWith("sk-proj-") || lower.startsWith("sk-")) return "OPENAI";
  return null;
}
