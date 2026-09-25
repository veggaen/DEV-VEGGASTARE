import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MEDIA_MODELS, MediaRequest, imageCostMicroUsd, mediaPricingReviewed, videoResultUrl } from './policy';
import { creditSaleEconomics } from '@/lib/ai-credit-purchase';
describe('media request and exposure policy', () => {
  it('accepts only bounded text and fixed server options', () => {
    const input = { requestId: randomUUID(), kind: 'IMAGE', prompt: 'A quiet lake' };
    expect(MediaRequest.safeParse(input).success).toBe(true);
    for (const extra of [{ credits: 0 }, { model: 'expensive' }, { n: 10 }, { duration: 90 }, { image: 'https://localhost' }, { prompt: '🌄'.repeat(251) }])
      expect(MediaRequest.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it('fails closed when the price review expires', () => {
    expect(mediaPricingReviewed(Date.parse('2026-09-25'))).toBe(true);
    expect(mediaPricingReviewed(Date.parse('2026-10-24'))).toBe(false);
  });
  it('covers fixed image text/output costs without assuming cached tokens', () => {
    expect(imageCostMicroUsd({ input_tokens: 1000, output_tokens: 196, input_tokens_details: { image_tokens: 0, text_tokens: 1000 } })).toBe(10880);
    expect(() => imageCostMicroUsd({})).toThrow('MEDIA_COST_REVIEW');
    expect(() => imageCostMicroUsd({ input_tokens: 10, output_tokens: 196, input_tokens_details: { image_tokens: 1, text_tokens: 9 } })).toThrow();
  });
  it.each(['http://vidgen.x.ai/a','https://vidgen.x.ai.evil.test/a','https://evil.test/a','https://u:p@vidgen.x.ai/a','https://vidgen.x.ai:444/a','http://127.0.0.1/a'])('rejects unsafe media URL %s', value => expect(() => videoResultUrl(value)).toThrow());
  it('accepts only the documented provider media host', () => expect(videoResultUrl('https://vidgen.x.ai/a/video.mp4?signature=example')).toContain('vidgen.x.ai'));
  it.each([10,100,500,1000,10000])('preserves the conservative sale margin at %i credits', amount => {
    expect(creditSaleEconomics(amount, Object.values(MEDIA_MODELS)).eligible).toBe(true);
  });
});
