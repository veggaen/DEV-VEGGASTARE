/** @vitest-environment jsdom */
/** @fileOverview Voice capability detection must preserve server markup during hydration. @stability stable */
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDictation } from './useDictation';

let root: Root | undefined;
let container: HTMLDivElement;
function Harness() {
  const { supported } = useDictation({ onResult: () => {} });
  return React.createElement('div', null, supported ? React.createElement('button', null, 'Voice typing') : null);
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('MediaRecorder', undefined);
  vi.stubGlobal('SpeechRecognition', undefined);
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  vi.stubGlobal('fetch', vi.fn());
  container = document.createElement('div'); document.body.append(container);
  container.innerHTML = renderToString(React.createElement(Harness));
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; container.remove(); vi.unstubAllGlobals();
});

it.each(['MediaRecorder', 'webkitSpeechRecognition', null])('hydrates safely with client capability %s', async capability => {
  if (capability) vi.stubGlobal(capability, class {});
  const recover = vi.fn();
  expect(container.querySelector('button')).toBeNull();
  await act(async () => { root = hydrateRoot(container, React.createElement(Harness), { onRecoverableError: recover }); });
  expect(recover).not.toHaveBeenCalled();
  expect(Boolean(container.querySelector('button'))).toBe(Boolean(capability));
  // Feature detection alone never records audio or calls transcription APIs.
  expect(fetch).not.toHaveBeenCalled();
});
