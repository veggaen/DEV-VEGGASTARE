import { LiveBringProvider } from './client';
import { MockBringProvider } from './mock';
import type { BringProvider } from './types';

export function getBringProvider(): BringProvider {
  const mode = (process.env.BRING_MODE || '').toLowerCase();

  // Default to mock mode for template friendliness.
  if (mode === 'live') return new LiveBringProvider();
  return new MockBringProvider();
}

export * from './types';
