'use client';
import { useEffect, useState } from 'react';
import { useUiPreferences } from '@/components/providers/ui-preferences';
import { readStoredSettlementQuote, type SettlementQuote } from '@/lib/payments/settlement-quote';
import { settlementRequest, settlementFailureMessage, SettlementClientError } from '@/lib/payments/settlement-client';
import { DEFAULT_PURCHASE_CREDITS } from '@/lib/ai-credit-purchase';

type Row = { id: string; quantity: number; updatedAt?: string; creditAmount?: number; creditSpendMinor?: number | null; creditSpendCurrency?: string | null; product: { id: string } };
const changedBasketMessage = 'Your basket changed in another tab. Refresh your saved basket.';
export function useCartSettlement(items: Row[], paused = false) {
  const { prefs } = useUiPreferences(), currency = prefs.preferredFiatCurrency;
  const key = JSON.stringify([currency, items.map(item => [item.id, item.updatedAt, item.quantity, item.creditAmount, item.creditSpendMinor, item.creditSpendCurrency, item.product.id])]);
  const [result, setResult] = useState<{ key: string; quote: SettlementQuote; token: string } | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (paused) return;
    const controller = new AbortController(); let active = true;
    setLoading(true); setError('');
    if (!items.length) { setResult(null); setLoading(false); return; }
    const timer = setTimeout(async () => {
      try {
        const body = await settlementRequest('/api/checkout/quote', { currency }, controller.signal);
        const quote = readStoredSettlementQuote(body.quote);
        if (quote.currency !== currency || Date.parse(quote.expiresAt) <= Date.now() || typeof body.token !== 'string' || !body.token || body.token.length > 16384 ||
            quote.lines.length !== items.length || quote.lines.some(line => {
              const item = items.find(item => item.product.id === line.productId);
              if (!item || item.quantity !== line.quantity) return true;
              if (line.kind !== 'AI_CREDITS') return false;
              return item.creditSpendMinor != null
                ? line.selection !== 'spend' || item.creditSpendMinor !== line.amountMinor || item.creditSpendCurrency !== quote.currency
                : line.selection !== 'credits' || line.credits !== (item.creditAmount ?? DEFAULT_PURCHASE_CREDITS);
            })) throw new SettlementClientError(changedBasketMessage);
        if (active) setResult({ key, quote, token: body.token });
      } catch (failure) { if (active) { setResult(null); setError(settlementFailureMessage(failure)); } }
      finally { if (active) setLoading(false); }
    }, 150);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  // Key is the complete server-cart revision and selected currency, not object identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, paused, retry]);
  useEffect(() => {
    if (!result || paused) return;
    const timer = setTimeout(() => { setResult(null); setError('This price expired. Refresh the price before continuing.'); }, Math.max(0, Date.parse(result.quote.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [result, paused]);
  const sameRevision = result?.key === key;
  const ready = !loading && !error && sameRevision;
  // Pausing a submitted order preserves its quote, never a different basket/currency.
  const visible = sameRevision && (ready || paused);
  return { quote: visible ? result?.quote ?? null : null, token: visible ? result?.token : undefined,
    ready, loading, error, needsCartRefresh: error === changedBasketMessage, refresh: () => setRetry(n => n + 1) };
}
