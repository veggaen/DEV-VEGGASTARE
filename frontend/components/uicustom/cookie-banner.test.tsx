// @vitest-environment jsdom
/** @fileOverview Consent persistence, failure and immediate dismissal regressions. @stability stable */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
import CookieBanner from './cookie-banner';
import { CONSENT_CHANGED_EVENT, CONSENT_STORAGE_KEY } from '@/lib/telemetry-policy';
let host: HTMLDivElement, root: Root;
const changed = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  window.addEventListener(CONSENT_CHANGED_EVENT, changed);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  window.removeEventListener(CONSENT_CHANGED_EVENT, changed); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
const render = async () => { await act(async () => root.render(<CookieBanner />)); };
const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent === text)!;
const click = async (text: string) => { await act(async () => button(text).click()); };
const saved = () => JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
it('keeps analytics off until a saved choice and dismisses immediately', async () => {
  await render(); expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  await click('Essential Only');
  expect(saved()).toMatchObject({version:1,necessary:true,analytics:false,marketing:false});
  expect(host.querySelector('[role=region]')).toBeNull(); expect(changed).toHaveBeenCalledTimes(1);
  expect(document.documentElement.style.getPropertyValue('--cookie-banner-offset')).toBe('0px');
});
it('allows only the optional analytics named by the button', async () => {
  await render(); await click('Allow Analytics');
  expect(saved()).toMatchObject({analytics:true,marketing:false}); expect(changed).toHaveBeenCalledTimes(1);
});
it('does not persist a custom draft until Save', async () => {
  await render(); await click('Customize'); const toggle=host.querySelector<HTMLInputElement>('input[name=analytics]')!;
  expect(toggle.checked).toBe(false); await act(async()=>toggle.click());
  expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull(); expect(changed).not.toHaveBeenCalled();
  await click('Save Preferences'); expect(saved().analytics).toBe(true);
});
it('essential-only overrides a previously opted-in draft', async () => {
  localStorage.setItem(CONSENT_STORAGE_KEY,JSON.stringify({version:1,analytics:true})); await render();
  expect(host.querySelector('[role=region]')).toBeNull();
  await act(async()=>window.dispatchEvent(new Event('veggat:cookie-consent-open')));
  expect(host.querySelector<HTMLInputElement>('input')!.checked).toBe(true);
  expect(document.activeElement).toBe(host.querySelector('h2'));
  await click('Essential Only'); expect(saved().analytics).toBe(false);
});
it.each(['broken','{"version":2,"analytics":true}','{"version":1,"analytics":"true"}'])('does not accept invalid stored choice %s',async raw=>{
  localStorage.setItem(CONSENT_STORAGE_KEY,raw); await render(); expect(button('Essential Only')).toBeDefined();
});
it('failed persistence leaves a retryable panel and does not dispatch consent',async()=>{
  await render(); const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
  await click('Allow Analytics'); expect(host.querySelector('[role=alert]')?.textContent).toContain('could not save');
  expect(host.querySelector('[role=region]')).not.toBeNull(); expect(changed).not.toHaveBeenCalled();
  write.mockRestore(); await click('Essential Only'); expect(saved().analytics).toBe(false);
});
