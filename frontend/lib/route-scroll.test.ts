/** @fileOverview Nested route scrolling, delayed fragments and cancellation boundaries. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { restoreRouteScroll } from './route-scroll';

let mutation: () => void;
let lookup: ReturnType<typeof vi.fn>;
let observe: ReturnType<typeof vi.fn>;
let disconnect: ReturnType<typeof vi.fn>;
let listeners: Map<string, () => void>;
let scroller: HTMLElement;
const anchor = () => ({ scrollIntoView: vi.fn() });
beforeEach(() => {
  vi.useFakeTimers();
  lookup = vi.fn().mockReturnValue(null);
  observe = vi.fn(); disconnect = vi.fn(); listeners = new Map();
  vi.stubGlobal('document', { getElementById: lookup });
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: () => void) { mutation = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  scroller = {
    scrollTo: vi.fn(), contains: vi.fn().mockReturnValue(true),
    addEventListener: vi.fn((event: string, fn: () => void) => listeners.set(event, fn)),
    removeEventListener: vi.fn((event: string) => listeners.delete(event)),
  } as unknown as HTMLElement;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('resets ordinary and malformed-fragment routes without a pending observer', () => {
  for (const hash of ['', '#%E0%A4%A']) restoreRouteScroll(scroller, hash)();
  expect(scroller.scrollTo).toHaveBeenCalledTimes(2);
  expect(observe).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it('decodes a present fragment and preserves its position instead of resetting it', () => {
  const target = anchor(); lookup.mockReturnValue(target);
  restoreRouteScroll(scroller, '#contact%20details');
  expect(lookup).toHaveBeenCalledWith('contact details');
  expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
  expect(scroller.scrollTo).not.toHaveBeenCalled();
  expect(observe).not.toHaveBeenCalled();
});
it('handles an anchor arriving after the shell and then disconnects exactly once', () => {
  restoreRouteScroll(scroller, '#contact');
  expect(observe).toHaveBeenCalledWith(scroller, { childList: true, subtree: true });
  const target = anchor(); lookup.mockReturnValue(target); mutation(); mutation();
  expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  expect(listeners.size).toBe(0);
});
it('does not follow matching ids outside the page scroller', () => {
  const target = anchor(); lookup.mockReturnValue(target);
  vi.mocked(scroller.contains).mockReturnValue(false);
  const cleanup = restoreRouteScroll(scroller, '#contact'); mutation(); cleanup();
  expect(target.scrollIntoView).not.toHaveBeenCalled();
});
it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])('cancels pending scrolling after %s input', event => {
  restoreRouteScroll(scroller, '#contact'); listeners.get(event)!();
  const target = anchor(); lookup.mockReturnValue(target); mutation();
  expect(target.scrollIntoView).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  expect(listeners.size).toBe(0);
});
it('bounds observation for a missing target and cleans up on navigation', () => {
  restoreRouteScroll(scroller, '#missing'); vi.advanceTimersByTime(15_000);
  const target = anchor(); lookup.mockReturnValue(target); mutation();
  expect(target.scrollIntoView).not.toHaveBeenCalled();
  expect(listeners.size).toBe(0);
  lookup.mockReturnValue(null);
  const cleanup = restoreRouteScroll(scroller, '#contact'); cleanup();
  lookup.mockReturnValue(target); mutation();
  expect(target.scrollIntoView).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
