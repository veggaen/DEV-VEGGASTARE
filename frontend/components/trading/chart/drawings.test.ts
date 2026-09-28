import { describe, expect, it } from 'vitest';
import { TOOLS, TOOL_GROUPS, formatDuration, pointsNeeded } from './drawings';

describe('drawing tools', () => {
  it('needs the right number of clicks per tool', () => {
    expect(pointsNeeded('hline')).toBe(1);
    expect(pointsNeeded('avwap')).toBe(1);
    expect(pointsNeeded('text')).toBe(1);
    expect(pointsNeeded('measure')).toBe(2);
    expect(pointsNeeded('long')).toBe(2);
    expect(pointsNeeded('channel')).toBe(3);
  });
  it('lists every non-cursor tool in a known group', () => {
    const groups = new Set(TOOL_GROUPS.map((g) => g.id));
    for (const t of TOOLS) if (t.id !== 'cursor') expect(groups.has(t.group!)).toBe(true);
  });
  it('formats durations like a chart', () => {
    expect(formatDuration(450 * 86_400_000)).toBe('450d');
    expect(formatDuration(3 * 86_400_000 + 4 * 3_600_000)).toBe('3d 4h');
    expect(formatDuration(2 * 3_600_000 + 15 * 60_000)).toBe('2h 15m');
    expect(formatDuration(5 * 60_000)).toBe('5m');
  });
});
