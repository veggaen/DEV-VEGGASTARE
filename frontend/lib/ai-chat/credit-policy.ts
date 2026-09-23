/** @fileOverview Reviewed text-only model allowance and bounded generation policy. @stability experimental */
import type { AiProvider } from '@/lib/ai-models';

export const MAX_AI_INPUT_BYTES = 10_000;
export const MAX_AI_OUTPUT_TOKENS = 2048;
export const AI_PROVIDER_TIMEOUT_MS = 40_000;
// Pricing may change. Stop platform-funded calls until the allowlist is reviewed;
// BYOK remains available. Never silently spend against an unreviewed price card.
export const AI_PRICING_REVIEW_BY = '2026-10-24T00:00:00.000Z';
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type FundedModel = { provider: AiProvider; model: string; label: string; credits: number; reserveMicroUsd: number };

// Official price cards and authenticated model lists checked 2026-09-24.
// Reserve covers the complete UTF-8 input + 512 framing tokens, capped output,
// uncached/cache-write pricing and >=2x safety margin. Tools/images are excluded.
// Flat message credits are disclosed before sending, NOT metered token charges.
export const FUNDED_AI_MODELS: readonly FundedModel[] = [
  { provider: 'GOOGLE', model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', credits: 0, reserveMicroUsd: 5000 },
  { provider: 'GROQ', model: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B · Groq', credits: 0, reserveMicroUsd: 4000 },
  { provider: 'VERCEL', model: 'inclusionai/ling-3.0-flash-fin-free', label: 'Ling 3.0 Flash', credits: 0, reserveMicroUsd: 1000 },
  { provider: 'OPENAI', model: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', credits: 2, reserveMicroUsd: 15_000 },
  { provider: 'OPENAI', model: 'gpt-6-astra', label: 'GPT-6 Astra', credits: 60, reserveMicroUsd: 600_000 },
  { provider: 'GROK', model: 'grok-4.7', label: 'Grok 4.7', credits: 8, reserveMicroUsd: 80_000 },
  { provider: 'ANTHROPIC', model: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', credits: 16, reserveMicroUsd: 160_000 },
];

export function fundedModel(provider: AiProvider, model: string) {
  return FUNDED_AI_MODELS.find(item => item.provider === provider && item.model === model);
}
export function pricingIsReviewed(now = Date.now()) { return now < Date.parse(AI_PRICING_REVIEW_BY); }

/** Keep the most recent complete turns. Never truncate the last message or split
 * a Unicode character. UTF-8 bytes conservatively bound text token counts. */
export function boundedChatHistory(messages: ChatMessage[], systemPrompt: string) {
  const encoder = new TextEncoder();
  const history = messages.slice(-20);
  const size = () => encoder.encode(systemPrompt).length + history.reduce((sum, item) => sum + encoder.encode(item.content).length, 0);
  while (history.length > 1 && size() > MAX_AI_INPUT_BYTES) history.shift();
  if (!history.length || size() > MAX_AI_INPUT_BYTES) throw new Error('AI_MESSAGE_TOO_LARGE');
  return history;
}
