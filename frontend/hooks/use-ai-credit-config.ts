/** @fileOverview Refresh availability and account balance after AI requests. @stability experimental */
'use client';
import { useCallback, useEffect, useState } from 'react';
import type { AiProvider } from '@/lib/ai-models';
export type AiCreditConfig = { balance: number; refundAdjustment?: number; authenticated: boolean; demo: boolean; environment: string; dailyUsed: number; dailyLimit: number;
  savedProviders: AiProvider[]; models: { provider: AiProvider; model: string; label: string; credits: number; available: boolean }[] };
export function useAiCreditConfig(enabled = true) {
  const [config, setConfig] = useState<AiCreditConfig | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/ai-chat/config', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('CONFIG_UNAVAILABLE');
      const data = await response.json();
      if (!signal?.aborted) { setConfig(data); setError(false); }
    } catch { if (!signal?.aborted) setError(true); }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const reload = () => { void refresh(controller.signal); };
    reload(); window.addEventListener('ai-credit:refresh', reload);
    return () => { controller.abort(); window.removeEventListener('ai-credit:refresh', reload); };
  }, [enabled, refresh]);
  return { config, error, refresh };
}
