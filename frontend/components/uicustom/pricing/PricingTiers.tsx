"use client";

/**
 * @fileOverview Interactive pricing grid for the public /pricing storefront.
 *   Monthly/yearly toggle, glass tier cards, brand-accent glow on the featured
 *   tier, framer-motion whileInView stagger, and a pointer-tracking spotlight on
 *   each card. Respects prefers-reduced-motion. CTAs route by plan.cta.kind;
 *   the Stripe "subscribe" path is wired in Phase 3 (here it links to /pricing
 *   anchor so the surface is complete and non-broken until then).
 * @stability active
 */

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLANS,
  type BillingPeriod,
  type Plan,
  effectiveMonthly,
  formatNok,
  YEARLY_DISCOUNT_MONTHS,
} from "./plans-config";

/** Watches Tailwind's `dark` class so we can pick the right accent RGB. */
function useIsDark() {
  const [isDark, setIsDark] = React.useState(true);
  React.useEffect(() => {
    const check = () => document.documentElement.classList.contains("dark");
    setIsDark(check());
    const obs = new MutationObserver(() => setIsDark(check()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function ctaHref(plan: Plan): string {
  switch (plan.cta.kind) {
    case "signup":
      return "/auth/register";
    case "byok":
      return "/settings#ai-keys";
    case "subscribe":
      // Phase 3 wires this to a Stripe Checkout server action; until then the
      // CTA points at account billing so the flow is never a dead end.
      return "/account/billing";
    case "contact":
      return "/info#contact";
  }
}

// ── Billing period toggle ────────────────────────────────────────────────────

function PeriodToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Billing period"
      className="relative inline-flex items-center rounded-full border border-border bg-muted/40 p-1 text-sm"
    >
      {(["monthly", "yearly"] as const).map((p) => {
        const active = period === p;
        return (
          <button
            key={p}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className={cn(
              "relative z-10 rounded-full px-4 py-1.5 font-medium transition-colors",
              active ? "text-brand-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="period-pill"
                className="absolute inset-0 -z-10 rounded-full bg-brand-accent"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            {p === "monthly" ? "Monthly" : "Yearly"}
            {p === "yearly" && (
              <span
                className={cn(
                  "ml-1.5 text-xs font-semibold",
                  active ? "text-brand-accent-foreground/80" : "text-emerald-500 dark:text-emerald-400",
                )}
              >
                −{YEARLY_DISCOUNT_MONTHS}mo
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Single tier card ─────────────────────────────────────────────────────────

function TierCard({
  plan,
  period,
  index,
  accentRgb,
}: {
  plan: Plan;
  period: BillingPeriod;
  index: number;
  accentRgb: string;
}) {
  const reduceMotion = useReducedMotion();
  const cardRef = React.useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
    cardRef.current.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const isFree = plan.price[period].amount === 0;
  const priceLabel = isFree ? "Free" : formatNok(plan.price[period].amount);

  return (
    <motion.div
      ref={cardRef}
      onPointerMove={onMove}
      initial={reduceMotion ? undefined : { opacity: 0, y: 28 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px 0px" }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border p-6 backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-300",
        plan.featured
          ? "border-brand-accent/45 bg-card/70 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)]"
          : "border-border bg-card/50 hover:border-brand-accent/30",
      )}
      style={{ willChange: "transform, opacity" }}
    >
      {/* Pointer-tracking spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(420px circle at var(--mx, 50%) var(--my, 0%), rgba(${accentRgb}, 0.10), transparent 45%)`,
        }}
      />

      {plan.featured && (
        <span className="absolute right-4 top-4 rounded-full bg-brand-accent px-2.5 py-0.5 text-xs font-semibold text-brand-accent-foreground">
          Most popular
        </span>
      )}

      <div className="relative">
        <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
        <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>

        <div className="mt-5 flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight text-foreground">{priceLabel}</span>
          {!isFree && (
            <span className="text-sm text-muted-foreground">
              /{period === "yearly" ? "yr" : "mo"}
            </span>
          )}
        </div>
        {!isFree && period === "yearly" && (
          <p className="mt-1 text-xs text-muted-foreground">
            {effectiveMonthly(plan, "yearly")}/mo billed yearly
          </p>
        )}

        <Link
          href={ctaHref(plan)}
          className={cn(
            "mt-6 flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98]",
            plan.featured
              ? "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-hover shadow-lg shadow-[hsl(var(--brand-accent))]/20"
              : "border border-border bg-background/60 text-foreground hover:border-brand-accent/40 hover:bg-muted/50",
          )}
        >
          {plan.ctaLabel}
        </Link>

        <ul className="mt-6 space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Check
                className="mt-0.5 size-4 shrink-0 text-brand-accent"
                strokeWidth={2.5}
                aria-hidden
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

// ── Exported grid ────────────────────────────────────────────────────────────

export default function PricingTiers() {
  const [period, setPeriod] = React.useState<BillingPeriod>("monthly");
  const isDark = useIsDark();
  // emerald-400 in dark, sky-500 in light — matches the rest of the brand system.
  const accentRgb = isDark ? "52, 211, 153" : "14, 165, 233";

  return (
    <div className="flex flex-col items-center">
      <PeriodToggle period={period} onChange={setPeriod} />

      <div className="mt-10 grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan, i) => (
          <TierCard key={plan.id} plan={plan} period={period} index={i} accentRgb={accentRgb} />
        ))}
      </div>

      <p className="mt-8 max-w-2xl text-center text-xs text-muted-foreground">
        Prices in NOK incl. VAT where applicable. Cancel anytime. BYOK keys are
        encrypted at rest and never leave the server. Shop purchases support
        Stripe, Vipps, Klarna, PayPal and crypto.
      </p>
    </div>
  );
}
