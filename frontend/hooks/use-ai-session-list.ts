"use client";
/** @fileOverview Abortable, private conversation navigation with honest loading/error states. @stability experimental */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SessionRailResponse, conversationListError, type ShellSession } from '@/lib/ai-chat/session-list';

const MAX_LOADED = 250;
export function useAiSessionList(isLoggedIn: boolean, query: string) {
  const key = query.trim();
  const [state, setState] = useState<{ key: string; sessions: ShellSession[] | null; cursor: string | null; loading: boolean; error: string | null }>({ key, sessions: null, cursor: null, loading: isLoggedIn, error: null });
  const request = useRef<AbortController | null>(null);
  const version = useRef(0);
  const cancel = useCallback(() => { ++version.current; request.current?.abort(); }, []);
  const load = useCallback(async (cursor?: string) => {
    if (!isLoggedIn) return;
    request.current?.abort();
    const controller = new AbortController(), current = ++version.current;
    request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    setState(previous => ({ key, sessions: previous.key === key ? previous.sessions : null, cursor: previous.key === key ? previous.cursor : null, loading: true, error: null }));
    try {
      const params = new URLSearchParams({ limit: '50', view: 'rail' });
      if (key) params.set('q', key);
      if (cursor) params.set('cursor', cursor);
      const response = await fetch(`/api/ai-chat/sessions?${params}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(conversationListError(response.status));
      const parsed = SessionRailResponse.safeParse(await response.json().catch(() => null));
      if (!parsed.success || (cursor && parsed.data.nextCursor === cursor)) throw new Error('The conversation response was incomplete. Please retry.');
      if (current === version.current) setState(previous => {
        const rows = cursor ? [...(previous.sessions ?? []), ...parsed.data.sessions] : parsed.data.sessions;
        return { key, sessions: [...new Map(rows.map(row => [row.id, row])).values()].slice(0, MAX_LOADED), cursor: parsed.data.nextCursor, loading: false, error: null };
      });
    } catch (error) {
      if (current === version.current) setState(previous => ({ ...previous, loading: false, error: controller.signal.aborted ? 'Loading took too long. Please retry.' : error instanceof Error ? error.message : 'Conversations could not be loaded. Please retry.' }));
    } finally { window.clearTimeout(timer); }
  }, [isLoggedIn, key]);
  useEffect(() => {
    // Initial load is immediate; search waits briefly without ever flashing an empty state.
    const timer = window.setTimeout(() => void load(), key ? 200 : 0);
    return () => { window.clearTimeout(timer); cancel(); };
  }, [load, key, cancel]);
  const refresh = useCallback(() => { void load(); }, [load]);
  useEffect(() => {
    window.addEventListener('ai-chat:sessions-changed', refresh);
    return () => window.removeEventListener('ai-chat:sessions-changed', refresh);
  }, [refresh]);
  const update = useCallback((id: string, title?: string) => {
    // A pending read must not restore a row/title that was just changed successfully.
    cancel();
    setState(previous => ({ ...previous, loading: false, sessions: previous.sessions?.flatMap(row => row.id !== id ? [row] : title === undefined ? [] : [{ ...row, title }]) ?? null }));
    refresh();
  }, [refresh, cancel]);
  const current = state.key === key;
  return {
    sessions: current ? state.sessions : null,
    loading: isLoggedIn && (!current || state.loading),
    error: current ? state.error : null,
    hasMore: current && !!state.cursor,
    capped: (state.sessions?.length ?? 0) >= MAX_LOADED,
    loadMore: () => { if (current && state.cursor && !state.loading) void load(state.cursor); },
    refresh, update,
  };
}
