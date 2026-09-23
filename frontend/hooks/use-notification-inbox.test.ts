/** @vitest-environment jsdom */
/** @fileOverview Inbox writes stay truthful under failure, repetition and read-only demos. @stability stable */
import React, { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useNotificationInbox } from './use-notification-inbox';
const mocks = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('sonner', () => ({ toast: mocks }));
let root: Root, container: HTMLDivElement, state: ReturnType<typeof useNotificationInbox>;
let requests: { url: string; method: string; resolve: (response: Response) => void }[];
let changeFilter: (archived: boolean) => void;
function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const [archived, setArchived] = useState(false);
  const value = useNotificationInbox({ userId: 'qa', refreshInterval: 0, readOnly, archived });
  useEffect(() => { state = value; changeFilter = setArchived; }, [value]); return null;
}
const row = { id: 'a', type: 'SYSTEM', title: 'Update', message: 'Saved', isRead: false, isArchived: false, createdAt: new Date(), groupCount: 1 };
const data = (isRead = false) => ({ notifications: [{ ...row, isRead }], unreadCount: isRead ? 0 : 1, nextCursor: null });
const respond = async (index: number, body: unknown, status = 200) => act(async () => { requests[index].resolve(new Response(JSON.stringify(body), { status })); });
async function mount(readOnly = false) {
  const cache = new Map();
  await act(async () => { root.render(React.createElement(SWRConfig, { value: { provider: () => cache, dedupingInterval: 0 } }, React.createElement(Harness, { readOnly }))); });
}
beforeEach(() => {
  requests = []; mocks.error.mockReset(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => new Promise<Response>(resolve => { requests.push({ url, method: options?.method ?? 'GET', resolve }); })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it('keeps failure distinct from an empty inbox', async () => {
  await mount(); await respond(0, {}, 503); expect(state.isError).toBe(true); expect(state.isLoading).toBe(false);
  await act(async () => { void state.refresh(); }); await respond(1, data()); expect(state.isError).toBe(false); expect(state.notifications).toHaveLength(1);
});
it('does not optimistically erase an unread row when the server rejects a write', async () => {
  await mount(); await respond(0, data());
  await act(async () => { void state.markAsRead('a'); }); expect(state.pending).toBe(true); expect(state.unreadCount).toBe(1);
  await respond(1, {}, 403); expect(mocks.error).toHaveBeenCalled(); expect(state.unreadCount).toBe(1); expect(state.notifications[0].isRead).toBe(false);
  await respond(2, data()); expect(state.pending).toBe(false);
});
it('locks repeated writes synchronously and reconciles with the server once', async () => {
  await mount(); await respond(0, data());
  await act(async () => { void state.markAsRead('a'); void state.markAsRead('a'); }); expect(requests.filter(r => r.method === 'PATCH')).toHaveLength(1);
  await respond(1, {}); await respond(2, data(true)); expect(state.unreadCount).toBe(0); expect(state.notifications[0].isRead).toBe(true);
});
it('never sends a demo mutation', async () => {
  await mount(true); await respond(0, data());
  await act(async () => { await state.markAsRead('a'); await state.markAllAsRead(); await state.archiveNotification('a'); });
  expect(requests).toHaveLength(1); expect(state.unreadCount).toBe(1);
});
it('revalidates a recently visited filter after restoring a notification in another tab', async () => {
  await mount(); await respond(0, { ...data(), notifications: [], unreadCount: 0 });
  await act(async () => { changeFilter(true); }); await respond(1, { ...data(), notifications: [{ ...row, isArchived: true }] });
  await act(async () => { void state.updateNotification('a', { isArchived: false }); });
  await respond(2, {}); await respond(3, { ...data(), notifications: [] });
  await act(async () => { changeFilter(false); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(requests).toHaveLength(5); expect(requests[4].url).toContain('archived=false');
  await respond(4, data()); expect(state.notifications[0].id).toBe('a');
});
