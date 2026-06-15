/**
 * @fileOverview Public SaaS storefront — /pricing.
 *   Server Component shell: SEO metadata + a story-driven header and the
 *   interactive PricingTiers grid (client). Tiers come from the single source
 *   of truth in components/uicustom/pricing/plans-config.ts. Reachable
 *   unauthenticated (added to publicRoutes); no schema or payment dependency.
 * @stability active
 */

import type { Metadata } from "next";
import Link from "next/link";
import PricingTiers from "@/components/uicustom/pricing/PricingTiers";

export const metadata: Metadata = {
  title: "Pricing — VeggaStare",
  description:
    "Start free, bring your own AI key for no limits, or go Pro for premium AI on us. One platform for SaaS, shop and crypto — by THORSEN SOFTWARE.",
  openGraph: {
    title: "Pricing — VeggaStare",
    description:
      "Start free, bring your own AI key, or go Pro. SaaS + shop, one platform.",
  },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "What does “bring your own key” mean?",
    a: "Add your own API key from any of six AI providers (OpenAI, Anthropic, Google, Groq, Grok, OpenRouter). You get unlimited AI at your provider's cost — we never charge for it, and your key is encrypted at rest and only decrypted server-side at call time.",
  },
  {
    q: "Do I need a subscription to sell or buy in the shop?",
    a: "No. The marketplace, checkout, and shipping are free to use. Subscriptions only cover premium AI usage on our platform keys.",
  },
  {
    q: "Which payment methods are supported?",
    a: "Shop purchases support Stripe (cards), Vipps, Klarna, PayPal and crypto. Pro subscriptions are billed through Stripe.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel your subscription from your account billing page at any time — access continues until the end of the period you've paid for.",
  },
];

export default function PricingPage() {
  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      <div className="relative mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <span aria-hidden className="h-2 w-2 rounded-full bg-brand-accent" />
            <span>Pricing</span>
          </div>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Pay for value, never for keys.
          </h1>
          <p className="mt-4 text-pretty text-base text-muted-foreground">
            Start free. Bring your own AI key for no limits at no cost to you —
            or go Pro and we handle the premium models for you. One platform for
            SaaS, shop and crypto.
          </p>
        </header>

        {/* ── Tiers ──────────────────────────────────────────────────────── */}
        <section className="mt-12">
          <PricingTiers />
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
            Questions, answered
          </h2>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            {FAQ.map(({ q, a }) => (
              <div
                key={q}
                className="rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-xl"
              >
                <dt className="text-sm font-semibold text-foreground">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Footer CTA ─────────────────────────────────────────────────── */}
        <section className="mx-auto mt-16 max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">
            Building something bigger?{" "}
            <Link
              href="/info#contact"
              className="font-semibold text-brand-accent underline-offset-4 hover:underline"
            >
              Talk to THORSEN SOFTWARE
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
