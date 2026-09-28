'use client';
/** @fileOverview Abortable, identity-scoped warehouse reads; refresh retains valid data. @stability stable */
import { useCallback, useEffect, useState } from 'react';
import { readWarehouseLocations, WarehouseReadError } from '@/lib/warehouse-read';
import type { WarehouseLocationDto } from '@/lib/types/warehouses';

type State = { key: string; revision: number; data: WarehouseLocationDto[] | null; error: string | null };
export function useWarehouseRead(endpoint: string, detail: boolean, identity: string | null) {
  const key = `${identity ?? ''}:${endpoint}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State>({ key, revision: -1, data: null, error: null });
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!identity) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    void readWarehouseLocations(endpoint, detail, controller.signal).then(data => {
      if (active) setState({ key, revision, data, error: null });
    }).catch(error => {
      if (active) setState(previous => ({ key, revision, data: error instanceof WarehouseReadError && error.discardSaved ? null : previous.key === key ? previous.data : null,
        error: controller.signal.aborted ? 'The request took too long. Please refresh.' : error instanceof WarehouseReadError ? error.message : 'Warehouse details could not be read. Please refresh.' }));
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [detail, endpoint, identity, key, revision]);
  useEffect(() => {
    if (!identity) return;
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 3_600_000);
    return () => window.clearInterval(interval);
  }, [identity, refresh]);
  const current = Boolean(identity) && state.key === key;
  const loading = !current || state.revision !== revision;
  return { data: current ? state.data : null, loading, error: !loading ? state.error : null, refresh };
}
