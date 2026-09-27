import { describe, expect, it } from 'vitest';
import { readableTint } from './color-extraction';

function lightness(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  return ((Math.max(r, g, b) + Math.min(r, g, b)) / 2) * 100;
}

describe('readableTint', () => {
  it('darkens a pale banner colour enough to read on a light surface', () => {
    const tint = readableTint('#f2e3c9', 'light'); // pale sand, the light-mode palette for a bright banner
    expect(lightness(tint)).toBeLessThanOrEqual(37);
    expect(tint).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('lightens a deep banner colour enough to read on a dark surface', () => {
    expect(lightness(readableTint('#1d2a5a', 'dark'))).toBeGreaterThanOrEqual(65);
  });
  it('leaves colours that already read alone, apart from a saturation floor', () => {
    // Hex round-tripping moves lightness by well under one point.
    expect(Math.abs(lightness(readableTint('#2b4a8f', 'light')) - lightness('#2b4a8f'))).toBeLessThan(1.5);
    expect(Math.abs(lightness(readableTint('#9fc1ff', 'dark')) - lightness('#9fc1ff'))).toBeLessThan(1.5);
  });
});
