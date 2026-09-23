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
  title: "Pricing — Veggat",
  description:
    "Explore Veggat for free. Available premium AI uses prepaid credits; personal API keys bill your own provider. Daily safety limits apply.",
  openGraph: {
    title: "Pricing — Veggat",
    description:
      "A free demo, one-time AI credit packs, and encrypted personal API keys.",
  },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "What does “bring your own key” mean?",
    a: "Add your own API key from any of six AI providers (OpenAI, Anthropic, Google, Groq, Grok, OpenRouter). Your provider bills usage directly. We do not debit platform credits; daily account and rate limits still apply. Keys are encrypted at rest and decrypted only on the server.",
  },
  {
    q: "Do I need a subscription to sell or buy in the shop?",
    a: "No subscription is required. Digital products and AI credit packs are individual purchases. Shipping and other experimental integrations are not part of the reviewer purchase path.",
  },
  {
    q: "Which payment methods are supported?",
    a: "The reviewer checkout uses PayPal when configured. Demo checkout is free and never opens a payment provider. Other payment methods and recurring subscriptions are not offered in this showcase.",
  },
  {
    q: "How do AI limits work?",
    a: "Model costs are shown before sending. A successful premium message spends its quoted credits; failed generations refund reserved credits. Normal accounts have a 20-attempt daily limit, demo accounts five, and the platform has an independent spending fuse.",
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
            Explore the demo without a card. Choose a one-time credit pack for available
            premium models, or connect a personal key billed by your provider.
            Clear costs and daily safety limits — no recurring subscription.
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
