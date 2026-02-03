'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ClientErrorRecord = {
  ts?: string;
  message?: string;
  name?: string | null;
  digest?: string | null;
  stack?: string | null;
  href?: string | null;
  pathname?: string | null;
  userAgent?: string | null;
  theme?: 'light' | 'dark' | 'system' | null;
  consent?: unknown;
  meta?: unknown;
};

export default function DevClientErrorsPage() {
  const [records, setRecords] = React.useState<ClientErrorRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [limit, setLimit] = React.useState(150);

  const fetchRecords = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/client-errors?limit=${encodeURIComponent(String(limit))}`, {
        cache: 'no-store',
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setRecords([]);
        setError(json?.message || 'Failed to load error records');
        return;
      }

      setRecords(Array.isArray(json.records) ? json.records : []);
    } catch (e) {
      setRecords([]);
      setError(e instanceof Error ? e.message : 'Failed to load error records');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  React.useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;

    return records.filter((r) => {
      const haystack = [r.message, r.name, r.digest, r.pathname, r.href]
        .filter(Boolean)
        .join(' | ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [records, query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Client Error Logs</h1>
          <p className="text-sm text-muted-foreground">
            Reads local NDJSON from <span className="font-mono">.error-logs/client-errors.ndjson</span> (dev only)
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Limit</label>
            <Input
              value={String(limit)}
              onChange={(e) => setLimit(Number.parseInt(e.target.value || '0', 10) || 150)}
              className="h-9 w-[110px]"
              inputMode="numeric"
            />
          </div>
          <Button variant="outline" onClick={fetchRecords} className="h-9">
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by message, digest, path…"
          className="h-10"
        />
        <div className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${filtered.length} shown / ${records.length} loaded`}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((r, idx) => (
          <details
            key={`${r.ts ?? 'no-ts'}-${idx}`}
            className="rounded-xl border border-border bg-white/70 p-4 shadow-sm shadow-black/[0.03] dark:bg-white/[0.04]"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {r.message || '(no message)'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{r.ts ? new Date(r.ts).toLocaleString() : 'Unknown time'}</span>
                    {r.pathname && <span className="truncate">{r.pathname}</span>}
                    {r.digest && <span className="font-mono">digest: {r.digest}</span>}
                    {r.name && <span className="font-mono">{r.name}</span>}
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground sm:mt-0">
                  Theme: <span className="font-mono">{r.theme ?? 'n/a'}</span>
                </div>
              </div>
            </summary>

            <div className="mt-3 grid gap-3">
              {r.href && (
                <div className="text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground/80">URL</div>
                  <div className="break-all font-mono">{r.href}</div>
                </div>
              )}

              {r.stack && (
                <div className="text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground/80">Stack</div>
                  <pre className="mt-1 max-h-[360px] overflow-auto rounded-lg border border-border bg-zinc-50/80 p-3 text-[11px] leading-4 text-zinc-800 dark:bg-black/20 dark:text-zinc-100">
{r.stack}
                  </pre>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                <div className="font-semibold text-foreground/80">Raw</div>
                <pre className="mt-1 max-h-[240px] overflow-auto rounded-lg border border-border bg-zinc-50/80 p-3 text-[11px] leading-4 text-zinc-800 dark:bg-black/20 dark:text-zinc-100">
{JSON.stringify(r, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-white/70 p-8 text-sm text-muted-foreground dark:bg-white/[0.04]">
            No records found.
          </div>
        )}
      </div>
    </div>
  );
}
