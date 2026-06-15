/**
 * @fileOverview Single source of truth for SaaS pricing tiers.
 *   Drives the public /pricing storefront (Phase 1) and is reused by the
 *   Stripe checkout / entitlement logic (Phase 2-3). Stripe price IDs are
 *   read from env so the same config works across test/live without code
 *   changes; until those env vars are set, a tier simply has no priceId and
 *   its CTA falls back to the BYOK / contact path.
 * @stability active
 */

export type BillingPeriod = "monthly" | "yearly";

export type PlanCta =
  | { kind: "signup" }            // free — just create an account
  | { kind: "byok" }             // bring-your-own-key — link to settings/keys
  | { kind: "subscribe" }        // paid — Stripe Checkout (wired in Phase 3)
  | { kind: "contact" };         // enterprise — email

export interface PlanPrice {
  /** Amount in the smallest currency unit (øre for NOK). 0 = free. */
  amount: number;
  currency: "NOK";
  /** Stripe Price ID for this period, resolved from env at module load. */
  priceId?: string;
}

export interface Plan {
  id: "free" | "byok" | "pro" | "enterprise";
  name: string;
  tagline: string;
  /** Highlighted as the recommended tier. */
  featured?: boolean;
  /** Per-period pricing. Free/BYOK use only `monthly` with amount 0. */
  price: Record<BillingPeriod, PlanPrice>;
  features: string[];
  cta: PlanCta;
  ctaLabel: string;
}

/** Yearly is billed at 10× monthly (≈2 months free) — keep in sync with Stripe. */
export const YEARLY_DISCOUNT_MONTHS = 2;

const PRO_MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY;
const PRO_YEARLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY;

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Everything you need to start.",
    price: {
      monthly: { amount: 0, currency: "NOK" },
      yearly: { amount: 0, currency: "NOK" },
    },
    features: [
      "Daily free AI chat (platform keys)",
      "Live polls & Pulse feed",
      "Marketplace browsing & buying",
      "Progressive verification tiers",
    ],
    cta: { kind: "signup" },
    ctaLabel: "Get started",
  },
  {
    id: "byok",
    name: "BYOK",
    tagline: "Bring your own AI key. No limits, no cost to you.",
    price: {
      monthly: { amount: 0, currency: "NOK" },
      yearly: { amount: 0, currency: "NOK" },
    },
    features: [
      "Unlimited AI — your key, your quota",
      "All 6 providers (GPT, Claude, Gemini, …)",
      "Keys encrypted at rest (AES-256-GCM)",
      "Everything in Free",
    ],
    cta: { kind: "byok" },
    ctaLabel: "Add your key",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Premium AI on us — no keys to manage.",
    featured: true,
    price: {
      monthly: { amount: 9900, currency: "NOK", priceId: PRO_MONTHLY_PRICE_ID },
      yearly: { amount: 99000, currency: "NOK", priceId: PRO_YEARLY_PRICE_ID },
    },
    features: [
      "GPT-4o & Claude on platform keys",
      "Higher daily generation limits",
      "Priority AI throughput",
      "Everything in BYOK",
    ],
    cta: { kind: "subscribe" },
    ctaLabel: "Subscribe to Pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For companies running on VeggaStare.",
    price: {
      monthly: { amount: 0, currency: "NOK" },
      yearly: { amount: 0, currency: "NOK" },
    },
    features: [
      "Company accounts & warehouses",
      "Bring shipping & order fulfilment",
      "Seller payment routing (Stripe, Vipps, crypto)",
      "Custom integrations & support",
    ],
    cta: { kind: "contact" },
    ctaLabel: "Talk to us",
  },
];

/** Format an øre amount as a Norwegian-kroner string, e.g. 9900 → "99 kr". */
export function formatNok(amountInOre: number): string {
  if (amountInOre === 0) return "0 kr";
  const kr = amountInOre / 100;
  const rounded = Number.isInteger(kr) ? kr.toString() : kr.toFixed(2);
  return `${rounded} kr`;
}

/** Effective monthly price for a yearly plan (yearly ÷ 12), formatted. */
export function effectiveMonthly(plan: Plan, period: BillingPeriod): string {
  const amount = period === "yearly" ? plan.price.yearly.amount / 12 : plan.price.monthly.amount;
  return formatNok(Math.round(amount));
}
