import { describe, expect, it } from 'vitest';
import { generateLetterIcon, safeLetterSource } from './token-icons';

describe('generateLetterIcon', () => {
  it('draws the first letter for an ordinary symbol', () => {
    expect(generateLetterIcon('hex')).toContain('%3EH%3C/text%3E');
  });
  it('survives a lone surrogate, control characters and an empty symbol', () => {
    expect(() => generateLetterIcon('\uD83D')).not.toThrow();
    expect(generateLetterIcon('\uD83Dxyz')).toContain('%3EX%3C/text%3E');
    expect(generateLetterIcon('\u0000​ pls')).toContain('%3EP%3C/text%3E');
    expect(generateLetterIcon('')).toContain('%3E%3F%3C/text%3E');
  });
  it('keeps a well-formed emoji as one glyph', () => {
    expect(generateLetterIcon('🚀MOON')).toContain(`%3E${encodeURIComponent('🚀')}%3C/text%3E`);
  });
});

describe('safeLetterSource', () => {
  it('removes only what cannot be drawn', () => {
    expect(safeLetterSource('\uDC00A\uD800')).toBe('A');
    expect(safeLetterSource('  Ok ')).toBe('Ok');
    expect(safeLetterSource('😀')).toBe('😀');
  });
});
