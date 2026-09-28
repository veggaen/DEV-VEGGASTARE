// @vitest-environment jsdom
/** @fileOverview Keep SDK error state and explicit retry rejection while handling mount failures. @stability stable */
import { afterEach, expect, test, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createEdgeStoreProvider } from '@edgestore/react';

afterEach(() => vi.unstubAllGlobals());

test('failed mount records unavailable state; failed reset rejects and later reset recovers', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Storage unavailable' }), { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Storage unavailable' }), { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ providerName: 'test-local-provider' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const { EdgeStoreProvider, useEdgeStore } = createEdgeStoreProvider();
  let current: ReturnType<typeof useEdgeStore> | undefined;
  function Probe() {
    const value = useEdgeStore();
    useEffect(() => { current = value; }, [value]);
    return null;
  }
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<EdgeStoreProvider><Probe /></EdgeStoreProvider>); });
    expect(current?.state).toEqual({ loading: false, initialized: false, error: true });
    await act(async () => { await expect(current!.reset()).rejects.toThrow(); });
    expect(current?.state.error).toBe(true);
    await act(async () => { await current!.reset(); });
    expect(current?.state).toEqual({ loading: false, initialized: true, error: false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  } finally { await act(async () => root.unmount()); }
});
