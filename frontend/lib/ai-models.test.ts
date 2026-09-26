/** @fileOverview Catalog identity and platform-spend regression checks. @stability stable */
import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, getModelDef } from './ai-models';
import { FUNDED_AI_MODELS, fundedModel, MAX_AI_INPUT_BYTES, MAX_AI_OUTPUT_TOKENS } from './ai-chat/credit-policy';

describe('reviewed chat model catalog', () => {
  it.each(AI_PROVIDERS)('$value has unique API ids and exactly one default', provider => {
    expect(new Set(provider.models.map(model => model.value)).size).toBe(provider.models.length);
    expect(provider.models.filter(model => model.isDefault)).toHaveLength(1);
    for (const model of provider.models) expect(model.value).toMatch(/^[A-Za-z0-9_./:-]{1,120}$/);
  });
  it.each(FUNDED_AI_MODELS)('funded $provider/$model exists in the visible catalog', model => {
    expect(getModelDef(model.provider, model.model)).toBeDefined();
  });
  it.each(['grok-4.5', 'grok-4.6'])('%s is separately priced and conservatively reserved', model => {
    const quote = fundedModel('GROK', model)!;
    expect(quote.credits).toBe(8);
    expect(quote.reserveMicroUsd).toBeGreaterThanOrEqual(2 * ((MAX_AI_INPUT_BYTES + 512) * 2 + MAX_AI_OUTPUT_TOKENS * 6));
  });
  it('catalog additions do not implicitly authorize platform spending', () => {
    for (const [provider, model] of [['OPENAI', 'gpt-6-sol'], ['OPENAI', 'gpt-6-luna'], ['ANTHROPIC', 'claude-fable-5-1'], ['ANTHROPIC', 'claude-opus-5-5'], ['ANTHROPIC', 'claude-sonnet-5']] as const) {
      expect(getModelDef(provider, model)).toBeDefined();
      expect(fundedModel(provider, model)).toBeUndefined();
    }
  });
});
