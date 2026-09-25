// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { CONSENT_VISIBILITY_SCRIPT } from './consent-visibility';
import { CONSENT_STORAGE_KEY } from './telemetry-policy';
const run=()=>new Function('localStorage','document',CONSENT_VISIBILITY_SCRIPT)(localStorage,document);
afterEach(()=>{localStorage.clear();document.documentElement.removeAttribute('data-saved-consent');vi.restoreAllMocks();});
it.each([false,true])('hides a previously saved %s choice without changing it',analytics=>{
  const raw=JSON.stringify({version:1,analytics});localStorage.setItem(CONSENT_STORAGE_KEY,raw);
  const write=vi.spyOn(Storage.prototype,'setItem');run();
  expect(document.documentElement.getAttribute('data-saved-consent')).toBe('true');
  expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe(raw);expect(write).not.toHaveBeenCalled();
});
it.each([null,'broken','{}','{"version":2,"analytics":true}','{"version":1,"analytics":"true"}'])('leaves the notice visible for %s',raw=>{
  if(raw!==null)localStorage.setItem(CONSENT_STORAGE_KEY,raw);run();
  expect(document.documentElement.hasAttribute('data-saved-consent')).toBe(false);
});
it('leaves the notice visible if storage is blocked',()=>{
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked')});
  expect(run).not.toThrow();expect(document.documentElement.hasAttribute('data-saved-consent')).toBe(false);
});
