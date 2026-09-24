'use client';
/** @fileOverview A balanced purchase workspace for prepaid text-chat credits. @stability active */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, MessageSquare, Sparkles } from 'lucide-react';
import CreditAmountEditor from '@/components/checkout/credit-amount-editor';

export default function CreditProductPanel({ title, credits, onCredits, onDirtyChange, disabled, controls, actions }: {
  title: string; credits: number; onCredits: (amount: number) => void; onDirtyChange: (dirty: boolean) => void;
  disabled: boolean; controls: ReactNode; actions: ReactNode;
}) {
  return <section aria-labelledby="credit-product-title" data-credit-product className="overflow-hidden rounded-2xl border border-border bg-card">
    <header className="flex items-start gap-4 border-b border-border p-5 sm:p-7">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Sparkles aria-hidden className="size-6" /></span>
      <div className="min-w-0">
        <h1 id="credit-product-title" className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask questions, refine writing, and work through code in Veggat chat.</p>
      </div>
    </header>
    <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section aria-label="Choose your credits" className="min-w-0 p-5 sm:p-7">
        <h2 className="mb-5 text-lg font-semibold">Choose your amount</h2>
        <CreditAmountEditor value={credits} onSave={onCredits} onDirtyChange={onDirtyChange} disabled={disabled} immediate />
        <div data-credit-purchase-actions className="mt-3">{actions}</div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">One-time purchase · PayPal at checkout</p>
      </section>
      <aside aria-label="Included with your credits" className="min-w-0 border-t border-border bg-muted/20 p-5 sm:p-7 xl:border-l xl:border-t-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-5">
          <span data-credit-preview className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{credits.toLocaleString('en-US')}</span>
          <span className="text-sm text-muted-foreground">usage credits</span>
        </div>
        <h2 className="mt-5 flex items-center gap-2 text-base font-semibold"><MessageSquare aria-hidden className="size-4" />Text chat, on your terms</h2>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          {['Choose an available text model in AI chat.', 'See the credit cost before each message.', 'No subscription or automatic top-ups.'].map(text => <li key={text} className="flex items-start gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" /><span>{text}</span></li>)}
        </ul>
        <Link href="/ai" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4 focus-visible:outline-2">Explore available models<ArrowUpRight aria-hidden className="size-4" /></Link>
        <details className="mt-3 border-t border-border text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-2">Usage & delivery</summary>
          <div className="space-y-3 pb-3 text-xs leading-5 text-muted-foreground">
            <p>Credits are for text chat inside Veggat, not a ChatGPT, Claude, or Grok subscription. Provider availability is shown in the model picker. Image and video generation are not included.</p>
            <p>Your balance updates after verified payment. A failed model response releases its reserved credits.</p>
            <Link href="/terms" className="inline-flex min-h-11 items-center underline underline-offset-4">Delivery & refund terms</Link>
          </div>
        </details>
        {controls}
      </aside>
    </div>
  </section>;
}
