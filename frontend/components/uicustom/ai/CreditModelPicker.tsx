/** @fileOverview Accessible model sheet with server availability and visible credits. @stability experimental */
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AI_PROVIDERS, getModelDef, type AiProvider } from '@/lib/ai-models';
import type { AiCreditConfig } from '@/hooks/use-ai-credit-config';

export function AiCreditStatus({ config, error = false }: { config: AiCreditConfig | null; error?: boolean }) {
  if (error) return <button type="button" className="min-h-11 text-left text-xs text-amber-600 dark:text-amber-400" onClick={() => window.dispatchEvent(new Event('ai-credit:refresh'))}>AI availability could not load. Tap to retry.</button>;
  if (!config) return <span className="inline-flex min-h-11 items-center text-xs text-muted-foreground" role="status">Loading AI balance…</span>;
  if (!config.authenticated) return <p className="text-xs text-muted-foreground">Guest preview · limited requests. Sign in for more models.</p>;
  return <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
    <span aria-live="polite">{config.balance} {config.demo ? 'demo ' : ''}credits</span>
    <span className="[@media(max-height:500px)]:hidden">{Math.max(0, config.dailyLimit - config.dailyUsed)} sends left today</span>
    {!config.demo && <Link href="/products/cveggatinterviewcredits01" className="inline-flex min-h-11 items-center underline underline-offset-4">Buy credits</Link>}
    {(config.refundAdjustment ?? 0) > 0 && <Link href="/my-orders" className="inline-flex min-h-11 items-center text-amber-700 underline underline-offset-4 dark:text-amber-400">Refund adjustment: {config.refundAdjustment} credits</Link>}
    {config.demo && <span className="[@media(max-height:500px)]:hidden">No payment needed</span>}
  </div>;
}

export function CreditModelPicker({ provider, model, onSelect, config, byokProvider, disabled = false, error = false }: {
  provider: AiProvider; model: string; onSelect: (provider: AiProvider, model: string) => void;
  config: AiCreditConfig | null; byokProvider?: AiProvider | null; disabled?: boolean; error?: boolean;
}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const selected = config?.models.find(item => item.provider === provider && item.model === model);
  const label = selected?.label || getModelDef(provider, model)?.label || model;
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild>
      <button type="button" disabled={disabled} aria-label={`Choose AI model: ${label}`} className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-lg border border-border px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
        <span className="truncate">{label}</span><span aria-hidden="true" className="shrink-0">⌄</span>
      </button>
    </SheetTrigger>
    <SheetContent side="bottom" accessibleTitle="Choose AI model" accessibleDescription="Choose a model and review its credit cost before sending."
      className="z-[150] mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 [@media(max-height:500px)]:max-h-[96dvh] [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:p-3">
      <div className="shrink-0 space-y-2 pr-10"><h2 className="text-lg font-semibold">Choose AI model</h2><AiCreditStatus config={config} error={error} /></div>
      <label className="block shrink-0 text-sm">Search models
        <input value={search} onChange={event => setSearch(event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-base" placeholder="Model or provider" />
      </label>
      <div className="min-h-0 overflow-y-auto overscroll-contain" data-ai-model-scroll>
        {!config && !error && <p role="status" className="py-4 text-sm text-muted-foreground">Loading model availability…</p>}
        {AI_PROVIDERS.map(group => {
          const ownKey = byokProvider === group.value || config?.savedProviders.includes(group.value);
          const funded = config?.models.filter(item => item.provider === group.value) ?? [];
          const models = [...funded, ...group.models.filter(item => !funded.some(f => f.model === item.value)).map(item => ({
            provider: group.value, model: item.value, label: item.label, credits: 0, available: false,
          }))].filter(item => `${group.label} ${item.label}`.toLowerCase().includes(search.toLowerCase()));
          if (!models.length) return null;
          return <section key={group.value} className="py-3"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
            <div className="space-y-1">{models.map(item => {
              const available = Boolean(item.available || ownKey), active = item.provider === provider && item.model === model;
              return <button key={item.model} type="button" disabled={!available} aria-pressed={active}
                onClick={() => { onSelect(item.provider, item.model); setOpen(false); }}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-45 ${active ? 'border-primary bg-primary/10' : 'border-transparent enabled:hover:bg-muted'}`}>
                <span className="min-w-0 break-words">{item.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{ownKey ? 'Your key' : !item.available ? 'Own key required' : item.credits ? `${item.credits} credits` : 'Free'}</span>
              </button>;
            })}</div>
          </section>;
        })}
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">Flat credits per message. Failed generations are refunded. Daily limits apply; your own key bills your provider directly.</p>
    </SheetContent>
  </Sheet>;
}
