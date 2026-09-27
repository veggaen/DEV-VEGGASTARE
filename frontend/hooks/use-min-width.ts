/**
 * @fileOverview `(min-width)` media query as a React subscription. False on the
 *               server and during hydration, so overlays gated on it never
 *               render into server markup.
 * @stability stable
 */
'use client';

import { useSyncExternalStore } from 'react';

export function useMinWidth(px: number) {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(`(min-width:${px}px)`);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(`(min-width:${px}px)`).matches,
    () => false,
  );
}
