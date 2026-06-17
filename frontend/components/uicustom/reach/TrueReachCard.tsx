"use client";

/**
 * @fileOverview TrueReachCard — honest identity-trust + reach breakdown
 * (True Reach score, verification tier, 5 trust-class rings, risk discount)
 * rendered live from lib/reach.
 * @stability evolving
 *
 * Complements the existing 7-pillar behavioral radar with the IDENTITY side:
 * the True Reach score, verification tier, the 5 trust classes (each as a
 * capped progress ring), and the risk discount — all from the live engine
 * (lib/reach), so it's real, not vanity.
 *
 * Motion: transform/opacity only (GPU), spring physics, count-up, staggered
 * class rows. Respects reduced-motion. No layout thrash.
 */

import * as React from "react";
import { motion, useReducedMotion, useSpring, useTransform, animate } from "framer-motion";
import { FiShield, FiAlertTriangle, FiCheck } from "react-icons/fi";

export interface TrueReachData {
  score: number;
  riskScore: number;
  verificationTier?: string | null;
  classes: { key: string; label: string; value: number; cap: number; verified: boolean }[];
  trustTotal: number;
  trustCeiling: number;
}

function useCountUp(target: number, enabled: boolean) {
  const [val, setVal] = React.useState(enabled ? 0 : target);
  React.useEffect(() => {
    if (!enabled) { setVal(target); return; }
    const controls = animate(0, target, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, enabled]);
  return val;
}

const TIER_LABEL: Record<string, string> = {
  ANONYMOUS: "Anonymous",
  WALLET_ONLY: "Wallet only",
  WEB2_BASIC: "Basic",
  WEB3_BASIC: "Web3 basic",
  SOCIAL_BASIC: "Social",
  SOCIAL_VERIFIED: "Social verified",
  MULTI_SOCIAL: "Multi-social",
  WEB2_PAYMENT: "Payment",
  WEB3_VERIFIED: "Web3 verified",
  WEB3_PAYMENT: "Web3 payment",
  PAYMENT_VERIFIED: "Payment verified",
  PHONE_VERIFIED: "Phone verified",
  FULLY_VERIFIED: "Fully verified",
};

function ClassRing({ value, cap, delay, reduce }: { value: number; cap: number; delay: number; reduce: boolean }) {
  const pct = cap > 0 ? Math.min(1, value / cap) : 0;
  const R = 16;
  const C = 2 * Math.PI * R;
  const dash = useSpring(reduce ? pct : 0, { stiffness: 120, damping: 20 });
  React.useEffect(() => { dash.set(pct); }, [pct, dash]);
  const offset = useTransform(dash, (d) => C * (1 - d));
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0 -rotate-90">
      <circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" strokeWidth="3.5" className="text-muted/40" />
      <motion.circle
        cx="20" cy="20" r={R} fill="none" strokeWidth="3.5" strokeLinecap="round"
        className="text-brand-accent"
        stroke="currentColor"
        strokeDasharray={C}
        strokeDashoffset={reduce ? C * (1 - pct) : offset}
        transition={{ delay }}
      />
    </svg>
  );
}

export default function TrueReachCard({ data, className = "" }: { data: TrueReachData; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const score = useCountUp(data.score, !reduce);
  const trustPct = data.trustCeiling > 0 ? Math.round((data.trustTotal / data.trustCeiling) * 100) : 0;
  const tier = data.verificationTier ? (TIER_LABEL[data.verificationTier] ?? data.verificationTier) : "Anonymous";
  const hasRisk = data.riskScore > 0;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px 0px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6 backdrop-blur-sm ${className}`}
    >
      {/* Header: score + tier */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <FiShield className="h-3.5 w-3.5 text-brand-accent" /> True Reach
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight tabular-nums text-foreground">{score}</span>
            <span className="text-sm text-muted-foreground">/ 1000</span>
          </div>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-accent/10 px-2.5 py-0.5 text-xs font-medium text-brand-accent">
            <FiCheck className="h-3 w-3" /> {tier}
          </div>
        </div>
        {hasRisk && (
          <div
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
            title="Risk lowers reach honestly (e.g. disposable/unverified email)"
          >
            <FiAlertTriangle className="h-3.5 w-3.5" />
            Risk −{data.riskScore}%
          </div>
        )}
      </div>

      {/* Identity verification bar */}
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Identity verified</span>
          <span className="font-medium text-foreground tabular-nums">{trustPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-brand-accent to-emerald-400"
            initial={reduce ? false : { width: 0 }}
            whileInView={{ width: `${trustPct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
        </div>
      </div>

      {/* Trust classes — each a capped ring, honest about what's verified */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {data.classes.map((c, i) => (
          <motion.div
            key={c.key}
            className="flex items-center gap-3"
            initial={reduce ? false : { opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
          >
            <ClassRing value={c.value} cap={c.cap} delay={0.2 + i * 0.06} reduce={reduce} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {c.label}
                {c.verified && <FiCheck className="h-3 w-3 text-brand-accent" />}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {c.value} / {c.cap} pts
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/80">
        Reach reflects <span className="font-medium text-muted-foreground">verified identity</span> +
        real activity, minus risk. Stacking similar logins is capped; independent
        proofs (BankID, phone, payment) each add — so it can&apos;t be gamed.
      </p>
    </motion.div>
  );
}
