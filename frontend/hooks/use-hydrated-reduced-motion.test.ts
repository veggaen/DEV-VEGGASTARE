// @vitest-environment jsdom
/** @fileOverview Motion preference must not invalidate server markup. @stability stable */
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useHydratedReducedMotion } from './use-hydrated-reduced-motion';

function preference(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return matches; },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  })));
  return { listeners, change(value: boolean) { matches = value; listeners.forEach(listener => listener()); } };
}
function Probe() {
  return React.createElement('p', null, useHydratedReducedMotion() ? 'Motion off' : 'Motion on');
}
afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });

it.each([false, true])('hydrates with preference %s without replacing server elements', async initial => {
  const media = preference(initial);
  const container = document.createElement('div');
  container.innerHTML = renderToString(React.createElement(Probe));
  document.body.append(container);
  const original = container.firstChild;
  expect(container.textContent).toBe('Motion on');
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => { root = hydrateRoot(container, React.createElement(Probe), { onRecoverableError: error => errors.push(error) }); });
  expect(container.firstChild).toBe(original);
  expect(container.textContent).toBe(initial ? 'Motion off' : 'Motion on');
  expect(errors).toEqual([]);
  await act(async () => media.change(!initial));
  expect(container.textContent).toBe(initial ? 'Motion on' : 'Motion off');
  await act(async () => root!.unmount());
  expect(media.listeners.size).toBe(0);
});
