// @vitest-environment jsdom
/** @fileOverview Web3 neutral loading, deliberate confirmation and uncertain outcomes. @stability stable */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ data: undefined as boolean | undefined, isError: false, fetch: vi.fn(), refresh: vi.fn(), cache: vi.fn(), retry: vi.fn() }));
vi.mock('@/hooks/use-web3-mode', () => ({ useWeb3Mode: () => ({ data: m.data, isError: m.isError, refetch: m.retry }) }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated', data: { user: { id: 'qa-owner' } }, update: m.refresh }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ setQueryData: m.cache }) }));
import { Web3ModeControl } from './web3-mode-control';
let host: HTMLDivElement, root: Root;
beforeEach(async () => {
  vi.resetAllMocks(); m.data = undefined; m.isError = false; m.refresh.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', m.fetch); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Web3ModeControl />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = async () => { await act(async () => root.render(<Web3ModeControl />)); };
function button(name: string) { const result = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent) === name); if (!result) throw new Error(`Missing ${name}`); return result; }
const click = async (name: string) => { await act(async () => button(name).click()); };
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const open = async () => { m.data = true; await render(); await click('Toggle Web3 mode'); };
it('never presents loading as a disabled Web3 setting', () => {
  expect(document.querySelector('[role="switch"]')).toBeNull(); expect(host.textContent).toBe('Loading…'); expect(m.fetch).not.toHaveBeenCalled();
});
it('read failure exposes Retry without claiming off', async () => {
  m.isError = true; await render(); await click('Retry Web3 settings'); expect(m.retry).toHaveBeenCalledTimes(1); expect(document.querySelector('[role="switch"]')).toBeNull();
});
it('opening and cancelling do not send any mutation or email request', async () => {
  await open(); expect(document.querySelector('[role="dialog"]')).not.toBeNull(); expect(m.fetch).not.toHaveBeenCalled();
  expect(document.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
  expect(document.querySelector('[role="switch"]')?.getAttribute('data-state')).toBe('checked');
  await click('Cancel'); expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(m.fetch).not.toHaveBeenCalled();
});
it('requires explicit confirmation and keeps saved state until acknowledgement', async () => {
  await open(); m.fetch.mockResolvedValue(response({ twoFactor: true })); await click('Confirm disable');
  expect(JSON.parse(m.fetch.mock.calls[0][1].body)).toEqual({ enabled: false, expectedEnabled: true });
  expect(document.querySelector('input[name="web3ModeCode"]')).not.toBeNull(); expect(m.cache).not.toHaveBeenCalled();
  await click('Cancel'); expect(m.refresh).not.toHaveBeenCalled();
});
it('acknowledged change updates cache without altering any wallet', async () => {
  await open(); m.fetch.mockResolvedValue(response({ success: true, web3ModeEnabled: false })); await click('Confirm disable');
  expect(m.cache).toHaveBeenCalledWith(['web3-mode', 'qa-owner'], false); expect(m.refresh).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(host.textContent).toContain('Web3 disabled.');
});
it('ordinary rejection remains actionable and cancellable', async () => {
  await open(); m.fetch.mockResolvedValue(response({ error: 'Please retry later.' }, 429)); await click('Confirm disable');
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('Please retry later.'); await click('Cancel'); expect(m.cache).not.toHaveBeenCalled();
});
it.each(['network','malformed','server','conflict'])('uncertain %s result never auto-retries or claims success', async kind => {
  await open();
  if (kind === 'network') m.fetch.mockRejectedValue(new Error('Offline'));
  if (kind === 'malformed') m.fetch.mockResolvedValue(response({ success: true }));
  if (kind === 'server') m.fetch.mockResolvedValue(response({ error: 'Refresh settings.' }, 503));
  if (kind === 'conflict') m.fetch.mockResolvedValue(response({ error: 'Refresh settings.' }, 409));
  await click('Confirm disable'); expect(button('Reload settings')).toBeTruthy(); expect(m.fetch).toHaveBeenCalledTimes(1); expect(m.cache).not.toHaveBeenCalled();
});
