// @vitest-environment jsdom
/** @fileOverview Both telemetry SDKs require consent, including events after revocation. @stability stable */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const sdk=vi.hoisted(()=>({ analytics:vi.fn(), speed:vi.fn() }));
vi.mock('@vercel/analytics/next',()=>({Analytics:(props:unknown)=>{sdk.analytics(props); return <div data-sdk="analytics"/>;}}));
vi.mock('@vercel/speed-insights/next',()=>({SpeedInsights:(props:unknown)=>{sdk.speed(props); return <div data-sdk="speed"/>;}}));
import SiteTelemetry from './site-telemetry';
import { CONSENT_CHANGED_EVENT, CONSENT_STORAGE_KEY } from '@/lib/telemetry-policy';
let host:HTMLDivElement, root:Root;
beforeEach(()=>{
  vi.clearAllMocks(); localStorage.clear();
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  host=document.createElement('div'); document.body.append(host); root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const setConsent=async(analytics:boolean,event=CONSENT_CHANGED_EVENT)=>{await act(async()=>{
  localStorage.setItem(CONSENT_STORAGE_KEY,JSON.stringify({version:1,analytics})); window.dispatchEvent(new Event(event));
});};
it('does not mount either SDK without opt-in',async()=>{
  await act(async()=>root.render(<SiteTelemetry/>)); await setConsent(false);
  expect(sdk.analytics).not.toHaveBeenCalled();expect(sdk.speed).not.toHaveBeenCalled();
});
it('mounts both on opt-in and blocks retained SDK callbacks immediately after revocation',async()=>{
  await act(async()=>root.render(<SiteTelemetry/>)); await setConsent(true);
  expect(host.querySelectorAll('[data-sdk]')).toHaveLength(2);
  const callbacks=[sdk.analytics.mock.lastCall![0].beforeSend,sdk.speed.mock.lastCall![0].beforeSend];
  for(const send of callbacks) expect(send({url:'https://www.veggat.com/checkout/receipt/private-id?token=secret',type:'pageview'})).toEqual({url:'https://www.veggat.com/checkout/receipt/[id]',type:'pageview'});
  await setConsent(false);expect(host.querySelectorAll('[data-sdk]')).toHaveLength(0);
  for(const send of callbacks) expect(send({url:'https://www.veggat.com/pulse'})).toBeNull();
});
it('honors cross-tab storage changes',async()=>{
  await act(async()=>root.render(<SiteTelemetry/>));await setConsent(true,'storage');expect(host.querySelectorAll('[data-sdk]')).toHaveLength(2);
  await setConsent(false,'storage');expect(host.querySelectorAll('[data-sdk]')).toHaveLength(0);
});
