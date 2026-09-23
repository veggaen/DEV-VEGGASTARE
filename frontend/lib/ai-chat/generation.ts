/** @fileOverview One metered generation boundary for direct text providers. @stability experimental */
import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { aiCreditLedger, AiCreditError } from '@/lib/ai-credit-ledger';
import { getUserAiKeyForGeneration, upsertUserAiKey } from '@/lib/ai-key-store';
import { isDemoUserId } from '@/lib/demo-policy';
import { getDefaultModel, type AiProvider } from '@/lib/ai-models';
import { boundedChatHistory, fundedModel, pricingIsReviewed, type ChatMessage } from './credit-policy';
import { streamBoundedProvider } from './provider-stream';

export function platformAiKey(provider: AiProvider, request?: Request) {
  switch (provider) {
    case 'OPENAI': return process.env.OPENAI_API_KEY ?? '';
    case 'GROK': return process.env.GROK_API_KEY ?? '';
    case 'GROQ': return process.env.GROQ_API_KEY ?? '';
    case 'GOOGLE': return process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_AI_API_KEY ?? '';
    case 'ANTHROPIC': return process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
    case 'VERCEL': return process.env.AI_GATEWAY_API_KEY || (process.env.VERCEL === '1' ? process.env.VERCEL_OIDC_TOKEN || request?.headers.get('x-vercel-oidc-token') : '') || '';
    default: return '';
  }
}

export function aiActorKey(request: Request, userId?: string) {
  if (userId) return userId;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new AiCreditError('AI_TEMPORARILY_UNAVAILABLE', 503);
  const ip = request.headers.get(process.env.VERCEL ? 'x-vercel-forwarded-for' : 'x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return createHmac('sha256', secret).update(`ai-anon:${ip}`).digest('hex');
}

export type GenerateInput = { request: Request; userId?: string; requestId?: string; provider: AiProvider; model?: string;
  messages: ChatMessage[]; systemPrompt: string; key?: { apiKey: string; remember?: boolean }; useSavedKey?: boolean;
  beforeComplete?: (text: string) => Promise<void> };

export async function generateMeteredStream(input: GenerateInput) {
  const { userId, provider, request } = input;
  const model = input.model || getDefaultModel(provider)?.value;
  if (!model) throw new AiCreditError('AI_MODEL_UNAVAILABLE', 503);
  let apiKey = input.key?.apiKey.trim() ?? '';
  let byok = Boolean(apiKey);
  if (apiKey && (!userId || isDemoUserId(userId))) throw new AiCreditError('SIGN_IN_FOR_BYOK', 403);
  if (!apiKey && userId && !isDemoUserId(userId) && provider !== 'VERCEL' && input.useSavedKey !== false) {
    // Decryption failure must NOT silently switch a BYOK customer to a charged
    // platform key. Nor may a fallback key for a different provider be used.
    const saved = await getUserAiKeyForGeneration({ userId, provider });
    if (saved?.provider === provider) { apiKey = saved.apiKey; byok = true; }
  }
  const quote = fundedModel(provider, model);
  if (!byok) {
    if (!quote || !pricingIsReviewed()) throw new AiCreditError('AI_MODEL_UNAVAILABLE', 503);
    apiKey = platformAiKey(provider, request);
    if (!apiKey) throw new AiCreditError('AI_NOT_CONFIGURED', 503);
    if (!userId && quote.credits > 0) throw new AiCreditError('AI_SIGN_IN_REQUIRED', 401);
  }
  let messages: ChatMessage[];
  try { messages = boundedChatHistory(input.messages, input.systemPrompt); }
  catch { throw new AiCreditError('AI_MESSAGE_TOO_LARGE', 413); }
  const demo = isDemoUserId(userId);
  if (demo) await aiCreditLedger.grantDemo(userId);
  const reservation = await aiCreditLedger.reserve({ userId, actorKey: aiActorKey(request, userId), requestId: input.requestId ?? randomUUID(),
    provider, model, funding: byok ? 'BYOK' : 'PLATFORM', credits: byok ? 0 : Math.max(demo ? 1 : 0, quote!.credits),
    reservedMicroUsd: byok ? 0 : quote!.reserveMicroUsd });
  if (input.key?.remember && userId && !demo && provider !== 'VERCEL') {
    // Saving is optional; a storage error must not leak the key or strand a
    // reservation. The valid one-time key still works for this request.
    await upsertUserAiKey({ userId, provider, apiKey }).catch(() => undefined);
  }
  const response = await streamBoundedProvider({ provider, model, apiKey, messages, systemPrompt: input.systemPrompt,
    signal: request.signal, beforeComplete: input.beforeComplete, settle: success => aiCreditLedger.settle(reservation.id, success) });
  const headers = new Headers(response.headers);
  headers.set('X-Ai-Cost-Tier', byok ? 'byok' : reservation.credits > 0 ? 'premium' : 'free');
  headers.set('X-Ai-Credits', String(reservation.credits));
  headers.set('X-Ai-Provider', provider); headers.set('X-Ai-Model', model);
  return new Response(response.body, { status: response.status, headers });
}

export async function generateMeteredText(input: GenerateInput) {
  const response = await generateMeteredStream(input);
  if (!response.ok) throw new AiCreditError('AI_UPSTREAM_ERROR', 502);
  const body = await response.text();
  let text = '';
  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    const item = JSON.parse(line.slice(6));
    if (item.error) throw new AiCreditError('AI_UPSTREAM_ERROR', 502);
    text += item.text ?? '';
  }
  return text;
}

export function aiErrorResponse(error: unknown) {
  const code = error instanceof AiCreditError ? error.code : 'AI_TEMPORARILY_UNAVAILABLE';
  const messages: Record<string, string> = {
    INVALID_REQUEST: 'Check your message and try again.',
    INVALID_ORIGIN: 'Please reload Veggat before sending another message.',
    LAST_MESSAGE_MUST_BE_USER: 'Write a message before sending.',
    CONVERSATION_UNAVAILABLE: 'This conversation is not available to your account.',
    AI_RATE_LIMIT: 'Too many requests. Please wait a few minutes and try again.',
    AI_CREDITS_REQUIRED: 'Not enough credits for this model. Buy credits or choose a free model.',
    AI_DAILY_LIMIT: 'Your daily AI limit has been reached. It resets at midnight UTC.',
    AI_PLATFORM_DAILY_LIMIT: 'Platform AI has reached its daily safety limit. Try tomorrow or use your own key.',
    AI_MODEL_UNAVAILABLE: 'This model is not available with platform credits. Choose another model or use your own key.',
    AI_NOT_CONFIGURED: 'This provider is not configured. Choose another provider or use your own key.',
    AI_MESSAGE_TOO_LARGE: 'This message is too long. Shorten it and try again.',
    AI_REQUEST_ALREADY_USED: 'This request was already handled. Send a new message instead of replaying it.',
    AI_SIGN_IN_REQUIRED: 'Sign in to use premium models.', SIGN_IN_FOR_BYOK: 'Use your own account to add an API key.',
  };
  return Response.json({ error: code, message: messages[code] ?? 'AI is temporarily unavailable. Please try again shortly.',
    ...(code === 'AI_CREDITS_REQUIRED' ? { buyCreditsUrl: '/products/cveggatinterviewcredits01' } : {}) },
  { status: error instanceof AiCreditError ? error.status : 503 });
}
