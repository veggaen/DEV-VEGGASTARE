/** @fileOverview Fast server-rendered offer cards, without unimplemented subscription claims. @stability stable */
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS } from "./plans-config";
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';

export default function PricingTiers() {
  return <div>
    <div className="grid min-w-0 gap-5 md:grid-cols-3">
      {PLANS.map(plan => <article key={plan.id} className={`relative flex min-w-0 flex-col rounded-2xl border bg-card/60 p-5 sm:p-6 md:row-span-6 md:grid md:grid-rows-subgrid md:gap-0 ${plan.featured ? "border-brand-accent/50" : "border-border"}`}>
        <h2 className="text-xl font-semibold">{plan.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{plan.tagline}</p>
        <p className="mt-6 text-2xl font-semibold tracking-tight">{plan.id === 'byok' ? plan.price : <PriceAmount amount={plan.id === 'demo' ? 0 : SHOWCASE_PRODUCTS.credits.amountOre / 100} currency="NOK" />}</p>
        <p className="mt-1 text-xs text-muted-foreground">{plan.note}</p>
        <ul className="my-6 space-y-3">
          {plan.features.map(feature => <li key={feature} className="flex gap-2 text-sm text-muted-foreground"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-accent" /><span>{feature}</span></li>)}
        </ul>
        <Link href={plan.href} className={`mt-auto inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-3 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring ${plan.featured ? "border-transparent bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-hover" : "border-border hover:bg-muted"}`}>{plan.ctaLabel}</Link>
      </article>)}
    </div>
    <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">The demo is always free. Real purchases use PayPal only when checkout is configured. No recurring plan, card, Vipps or Klarna subscription is offered here.</p>
  </div>;
}
