"use client";

/** @fileOverview Durable, paginated paper history with retryable reads. @stability experimental */
import { useState, useEffect, useCallback, useRef } from 'react';
import { FiClock, FiRefreshCw } from 'react-icons/fi';
import { getPaperTradeHistory } from '@/actions/paper-trade';
import type { PaperHistoryRow } from '@/lib/paper/read';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 50;
const labels: Record<PaperHistoryRow['type'], string> = {
  BUY: 'Bought', SELL: 'Sold', SWAP: 'Swapped', FAUCET: 'Reset', P2P_SEND: 'Sent', P2P_RECEIVE: 'Received',
};
function amount(value: string | null) {
  if (!value) return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumSignificantDigits: 8 }) : '—';
}

export function PaperTradeHistory() {
  const [trades, setTrades] = useState<PaperHistoryRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pending, setPending] = useState<'refresh' | 'more' | null>('refresh');
  const [error, setError] = useState<string | null>(null);
  const [retryCursor, setRetryCursor] = useState<string | undefined>();
  const request = useRef(0);
  const fetchTrades = useCallback(async (cursor?: string) => {
    const id = ++request.current;
    setPending(cursor ? 'more' : 'refresh'); setError(null); setRetryCursor(cursor);
    try {
      const result = await getPaperTradeHistory({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) });
      if (request.current !== id) return;
      if (!result.success) {
        if (result.code === 'UNAUTHORIZED') { setTrades([]); setNextCursor(null); }
        setError(result.error); return;
      }
      setTrades(previous => cursor ? [...previous, ...result.data.trades.filter(row => !previous.some(p => p.id === row.id))] : result.data.trades);
      setNextCursor(result.data.nextCursor);
    } catch {
      if (request.current === id) setError('Trade history could not be loaded. Try again.');
    } finally {
      if (request.current === id) setPending(null);
    }
  }, []);
  useEffect(() => { const sequence = request; void fetchTrades(); return () => { ++sequence.current; }; }, [fetchTrades]);

  return <section aria-label="Trade history" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><FiClock aria-hidden="true" />Trade history</h2>
      <Button variant="ghost" size="icon" aria-label="Refresh trade history" disabled={!!pending} onClick={() => void fetchTrades()} className="size-11">
        <FiRefreshCw className={pending === 'refresh' ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />
      </Button>
    </header>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 text-sm">
      <p>{error}</p><Button variant="outline" onClick={() => void fetchTrades(retryCursor)} disabled={!!pending}>Retry history</Button>
    </div>}
    {pending && trades.length === 0 && <p role="status" className="p-8 text-center text-sm text-muted-foreground">Loading saved trades…</p>}
    {!error && !pending && trades.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No trades yet.</p>}
    <ol className="divide-y divide-border">
      {trades.map(trade => <li key={trade.id} data-trade-id={trade.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-sm">
        <div className="min-w-0">
          <p className="break-words font-medium">{labels[trade.type]} {trade.type === 'SELL' || trade.type === 'P2P_SEND'
            ? `${amount(trade.sellDisplayAmt)} ${trade.sellToken ?? ''}`
            : trade.type === 'SWAP' ? `${amount(trade.sellDisplayAmt)} ${trade.sellToken} → ${amount(trade.buyDisplayAmt)} ${trade.buyToken}`
            : `${amount(trade.buyDisplayAmt)} ${trade.buyToken ?? ''}`}</p>
          {(trade.type === 'BUY' || trade.type === 'SELL') && <p className="mt-1 text-xs text-muted-foreground">
            USD {amount(trade.type === 'BUY' ? trade.sellDisplayAmt : trade.buyDisplayAmt)}
          </p>}
          {trade.feeUsd != null && trade.feeUsd > 0 && <p className="mt-1 text-xs text-muted-foreground">Simulated fee USD {trade.feeUsd.toFixed(2)}</p>}
        </div>
        <time dateTime={new Date(trade.executedAt).toISOString()} className="text-right text-xs leading-5 text-muted-foreground">
          {new Date(trade.executedAt).toLocaleDateString()}<br />
          {new Date(trade.executedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </time>
      </li>)}
    </ol>
    {trades.length > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p aria-live="polite" className="text-xs text-muted-foreground">{trades.length} loaded{nextCursor ? '' : ' · End of history'}</p>
      {nextCursor && <Button variant="outline" className="min-h-11" disabled={!!pending} onClick={() => void fetchTrades(nextCursor)}>
        {pending === 'more' ? 'Loading…' : 'Load older trades'}
      </Button>}
    </footer>}
  </section>;
}
