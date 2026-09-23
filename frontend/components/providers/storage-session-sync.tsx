'use client';
/** @fileOverview Refresh storage context after account changes without remounting the application. @stability stable */
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useEdgeStore } from '@/lib/edgestore';

export default function StorageSessionSync() {
  const { data, status } = useSession();
  const { reset, state } = useEdgeStore();
  const identity = `${data?.user?.id ?? 'anonymous'}:${data?.user?.role ?? 'GUEST'}`;
  const previous = useRef(identity);
  useEffect(() => {
    // Finish the initial context request before refreshing it. Overlapping
    // requests could otherwise install the old account's cookie last.
    if (status === 'loading' || state.loading || previous.current === identity) return;
    previous.current = identity;
    void reset().catch(() => { console.error('[storage] Could not refresh upload context'); });
  }, [identity, reset, status, state.loading]);
  return null;
}
