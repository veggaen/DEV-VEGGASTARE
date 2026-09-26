import type { AiProvider } from '@/lib/ai-models';

export const CHAT_IMAGE_MAX_BYTES = 4_000_000;
export const CHAT_IMAGE_STORED_BYTES = 400_000;
export const CHAT_IMAGE_MAX_SIDE = 1024;
export const CHAT_IMAGE_MAX_PIXELS = 20_000_000;
export const CHAT_IMAGES_PER_MESSAGE = 2;
export const CHAT_IMAGES_PER_CONTEXT = 4;
export const CHAT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ChatImageView = { id: string; width: number; height: number };

// Reviewed 2026-09-26 against OpenAI's image-token and model price cards.
// 1024² / 32² * 1.2 = 1229 tokens (rounded up). Reserve includes 1.25x
// cache-write pricing and >2x headroom. Normalization and explicit high detail
// are mandatory. No URLs, tools, original resolution, or unreviewed models.
export function imageAllowance(provider: AiProvider, model: string) {
  if (provider !== 'OPENAI') return null;
  if (model === 'gpt-5.6-luna') return { credits: 1, reserveMicroUsd: 1000 };
  if (model === 'gpt-6-astra') return { credits: 5, reserveMicroUsd: 40_000 };
  return null;
}

/** Include the newest four images. Older text remains useful without silently
 * suggesting that an earlier image was sent to the provider this turn. */
export function imageContext<T extends { role: string; content: string; images?: ChatImageView[] }>(messages: T[]) {
  let remaining = CHAT_IMAGES_PER_CONTEXT;
  return messages.slice().reverse().map(message => {
    const original = message.role === 'user' ? message.images ?? [] : [];
    const images = original.slice(Math.max(0, original.length - remaining));
    remaining -= images.length;
    const omitted = original.length > images.length ? '\n[An older image is outside the current image context.]' : '';
    return { ...message, images, content: message.content.slice(0, 4000 - omitted.length) + omitted };
  }).reverse();
}
