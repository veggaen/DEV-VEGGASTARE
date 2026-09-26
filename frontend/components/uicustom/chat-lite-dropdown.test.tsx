// @vitest-environment jsdom
/** @fileOverview No stale private rows across account switches, closure or navigation. @stability stable */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const identity = vi.hoisted(() => ({ user: { id: 'a' } as { id: string } | null, pathname: '/conversations' }));
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => identity.user }));
vi.mock('next/navigation', () => ({ usePathname: () => identity.pathname }));
vi.mock('next/link', () => ({ default: ({ children, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => <a {...props}>{children}</a> }));
import { ChatLiteDropdown } from './chat-lite-dropdown';
let root: Root, host: HTMLDivElement;
const requests: { resolve: (response: Response) => void; signal: AbortSignal }[] = [];
beforeEach(() => {
  identity.user = { id: 'a' }; identity.pathname = '/conversations'; requests.length = 0;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise<Response>(resolve => requests.push({ resolve, signal: options.signal }))));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const render = () => act(async () => root.render(<ChatLiteDropdown />));
const toggle = () => act(async () => (host.querySelector('[aria-label="Messages"]') as HTMLButtonElement).click());
const settle = (index: number, title: string) => act(async () => requests[index].resolve(new Response(JSON.stringify({ conversations: [{ id: title, title, type: 'GROUP', updatedAt: '2026-09-26', participantDetails: [], lastMessage: null }] }))));
it('fetches only when opened and aborts on close; late rows cannot reappear', async () => {
  await render(); expect(requests).toHaveLength(0); await toggle(); expect(requests).toHaveLength(1);
  await toggle(); expect(requests[0].signal.aborted).toBe(true); await settle(0, 'Old private row');
  await toggle(); expect(document.body.textContent).not.toContain('Old private row');
  await settle(1, 'Current row'); expect(document.body.textContent).toContain('Current row');
});
it('clears loaded rows immediately when the account changes', async () => {
  await render(); await toggle(); await settle(0, 'Account A row'); expect(document.body.textContent).toContain('Account A row');
  identity.user = { id: 'b' }; await render(); expect(document.body.textContent).not.toContain('Account A row');
  await toggle(); await settle(1, 'Account B row'); expect(document.body.textContent).toContain('Account B row');
});
it('ignores an earlier account response arriving after the next account response', async () => {
  await render(); await toggle(); identity.user = { id: 'b' }; await render(); expect(requests[0].signal.aborted).toBe(true);
  await toggle(); await settle(1, 'Account B row'); await settle(0, 'Secret from A');
  expect(document.body.textContent).not.toContain('Secret from A'); expect(document.body.textContent).toContain('Account B row');
});
it('discards rows on sign-out and closes on navigation', async () => {
  await render(); await toggle(); await settle(0, 'Private row'); identity.pathname = '/products'; await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull(); await toggle(); await settle(1, 'Private row');
  identity.user = null; await render(); expect(document.body.textContent).not.toContain('Private row'); expect(host.querySelector('button')).toBeNull();
});
it('shows a recoverable error, not an empty inbox, for malformed data', async () => {
  await render(); await toggle(); await act(async () => requests[0].resolve(new Response('{}')));
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load messages');
  expect(document.body.textContent).not.toContain('No conversations yet');
});
it('shows sign-in recovery for revoked access', async () => {
  await render(); await toggle(); await act(async () => requests[0].resolve(new Response('{}', { status: 403 })));
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Sign in again');
});
it('turns a stalled request into a retry state after a bounded wait', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise<Response>((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Aborted'))))));
  await render(); await toggle();
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load messages');
});
