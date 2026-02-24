/**
 * @fileOverview Shared AI model/provider catalog for the landing chat widget and poll builder.
 * Defines providers, models, capabilities, and key auto-detection.
 * @stability stable
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiProvider = "OPENAI" | "OPENROUTER" | "ANTHROPIC" | "GOOGLE" | "GROK" | "GROQ";

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
    value: "GOOGLE",
    label: "Google Gemini",
    emoji: "🔷",
    tagline: "Lightning-fast with surprising capability",
    getKeyUrl: "https://aistudio.google.com/apikey",
    freeAvailable: true,
    tier: "free",
    pricingNote: "Free tier available",
    models: [
      { value: "gemini-2.5-flash",       label: "Gemini 2.5 Flash",           description: "Fast and capable — great default",   isDefault: true, capabilities: ["fast", "vision", "tools"],                  group: "recommended", contextSize: "1M" },
      { value: "gemini-2.5-pro",          label: "Gemini 2.5 Pro",             description: "Advanced reasoning and analysis",                     capabilities: ["flagship", "vision", "tools", "reasoning"],  group: "recommended", contextSize: "1M" },
      { value: "gemini-2.5-flash-lite",   label: "Gemini 2.5 Flash Lite",      description: "Ultra-fast for simple tasks",                          capabilities: ["fast", "cheap"],                              group: "standard",    contextSize: "1M" },
      { value: "gemini-2.0-flash",        label: "Gemini 2.0 Flash",           description: "Previous generation — still solid",                    capabilities: ["fast", "vision"],                             group: "legacy",      contextSize: "1M" },
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
    pricingNote: "Free tier available",
    models: [
      { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",             description: "Versatile open model — great for most tasks",  isDefault: true, capabilities: ["fast", "tools"],                group: "recommended", contextSize: "128K" },
      { value: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",              description: "Ultra-fast for quick answers",                           capabilities: ["fast", "cheap"],                 group: "standard",    contextSize: "128K" },
      { value: "mixtral-8x7b-32768",      label: "Mixtral 8x7B",              description: "MoE model with broad knowledge",                        capabilities: ["fast"],                          group: "standard",    contextSize: "32K"  },
    ],
  },
  {
    value: "OPENAI",
    label: "OpenAI",
    emoji: "🧠",
    tagline: "GPT-5.2, o4, and the latest reasoning models",
    getKeyUrl: "https://platform.openai.com/api-keys",
    freeAvailable: false,
    tier: "premium",
    pricingNote: "Credits or BYOK",
    models: [
      { value: "gpt-5.2",        label: "GPT-5.2",                description: "OpenAI's latest with breakthrough intelligence",   isDefault: true, capabilities: ["flagship", "vision", "tools", "reasoning"], group: "recommended", contextSize: "128K", supportsThinking: true },
      { value: "gpt-5.1",        label: "GPT-5.1",                description: "Powerful all-rounder",                                              capabilities: ["vision", "tools", "reasoning"],             group: "recommended", contextSize: "128K" },
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
      { value: "claude-sonnet-4-20250514",  label: "Claude Sonnet 4",    description: "Fast and intelligent — best value",        isDefault: true, capabilities: ["flagship", "vision", "tools", "coding"],    group: "recommended", contextSize: "200K" },
      { value: "claude-opus-4-20250514",    label: "Claude Opus 4",      description: "Most capable Claude — deep reasoning",                      capabilities: ["flagship", "vision", "tools", "reasoning"], group: "recommended", contextSize: "200K", supportsThinking: true },
      { value: "claude-3-5-haiku-latest",   label: "Claude 3.5 Haiku",   description: "Lightweight and fast",                                      capabilities: ["fast", "cheap"],                            group: "standard",    contextSize: "200K" },
    ],
  },
  {
    value: "GROK",
    label: "Grok (xAI)",
    emoji: "🚀",
    tagline: "Real-time knowledge with a unique perspective",
    getKeyUrl: "https://console.x.ai",
    freeAvailable: true,
    tier: "free",
    pricingNote: "Free tier available",
    models: [
      { value: "grok-3",       label: "Grok 3",              description: "xAI's flagship — real-time knowledge",   isDefault: true, capabilities: ["flagship", "vision", "tools"],    group: "recommended", contextSize: "128K" },
      { value: "grok-3-mini",  label: "Grok 3 Mini",         description: "Faster and cheaper",                                      capabilities: ["fast", "cheap"],                  group: "standard",    contextSize: "128K" },
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
      { value: "anthropic/claude-sonnet-4-20250514",        label: "Claude Sonnet 4 (via OR)",    description: "Anthropic routed via OpenRouter",                       capabilities: ["flagship", "vision", "tools"],group: "recommended", contextSize: "200K" },
      { value: "google/gemini-2.5-pro-preview",             label: "Gemini 2.5 Pro (via OR)",     description: "Google model via OpenRouter",                            capabilities: ["flagship", "vision"],         group: "standard",    contextSize: "1M"   },
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
