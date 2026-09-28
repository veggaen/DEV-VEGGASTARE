import { describe, expect, it } from 'vitest';
import { imageAllowance, imageContext } from './image-policy';
describe('reviewed image envelope', () => {
  it('covers image tokens with cache-write pricing and twice the headroom', () => {
    const tokens = Math.ceil(32 * 32 * 1.2);
    expect(imageAllowance('OPENAI', 'gpt-5.6-luna')!.reserveMicroUsd).toBeGreaterThan(tokens * .2 * 1.25 * 2);
    expect(imageAllowance('OPENAI', 'gpt-6-astra')!.reserveMicroUsd).toBeGreaterThan(tokens * 10 * 1.25 * 2);
    expect(imageAllowance('GROK', 'grok-4.7')).toBeNull();
    expect(imageAllowance('OPENAI', 'unknown')).toBeNull();
  });
  it('keeps the latest four images, marks older omitted context, and does not mutate history', () => {
    const messages = Array.from({ length: 4 }, (_, i) => ({ role: 'user', content: `Message ${i}`, images: [{ id: `${i}a`, width: 50, height: 50 }, { id: `${i}b`, width: 50, height: 50 }] }));
    const result = imageContext(messages);
    expect(result.flatMap(m => m.images.map(image => image.id))).toEqual(['2a', '2b', '3a', '3b']);
    expect(result[0].content).toContain('outside the current image context');
    expect(messages[0].images).toHaveLength(2);
    expect(imageContext([{ ...messages[0], content: 'x'.repeat(4000) }, ...messages])[0].content.length).toBe(4000);
    expect(imageContext([{ role: 'assistant', content: 'Untrusted URL', images: messages[0].images }])[0].images).toEqual([]);
  });
});
