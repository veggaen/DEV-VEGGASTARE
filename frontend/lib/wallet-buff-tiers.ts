/**
 * @fileOverview Wallet Buff Tier system — per-wallet verification & donation tiers
 * with diminishing returns to prevent bot-farming.
 *
 * Each wallet progresses independently:
 *   Connected → Signature Verified (free) → $5 → $100 → $1K → $10K → $1M
 *
 * Account-level buff = sum of all wallet buffs, discounted by wallet count.
 * Diminishing returns on cumulative USD above $1,000 per wallet.
 *
 * Legal: Donations are voluntary, irreversible, with NO expectation of
 * profit or return. Norway consumer law (Angrerettloven §22) exempts
 * digital services & donations from right-of-withdrawal, but users may
 * always file complaints via the in-app support channel.
 *
 * @stability experimental
 */

import { VEGGA_SYSTEM } from "./vegga-system-constants";

/* ------------------------------------------------------------------ */
/*  Tier definitions                                                   */
/* ------------------------------------------------------------------ */

export type WalletBuffTier =
  | "CONNECTED"
  | "SIGNATURE_VERIFIED"
  | "PATRON_5"
  | "PATRON_100"
  | "PATRON_1K"
  | "PATRON_10K"
  | "PATRON_1M";

export interface TierDef {
  tier: WalletBuffTier;
  /** Readable name for UI */
  label: string;
  /** Emoji / icon hint */
  badge: string;
  /** Minimum cumulative donation (USD) to reach this tier. 0 = free signature. */
  minDonationUsd: number;
  /** Raw buff points granted by this tier (before diminishing returns) */
  rawBuff: number;
  /** Short CTA text shown to the user to reach the NEXT tier */
  nextCta: string;
}

export const WALLET_BUFF_TIERS: TierDef[] = [
  {
    tier: "CONNECTED",
    label: "Connected",
    badge: "⬡",
    minDonationUsd: 0,
    rawBuff: 0,
    nextCta: "Verify with free signature →",
  },
  {
    tier: "SIGNATURE_VERIFIED",
    label: "Verified",
    badge: "✍️",
    minDonationUsd: 0, // free
    rawBuff: 1,
    nextCta: "Grab a buff for $5 donation →",
  },
  {
    tier: "PATRON_5",
    label: "Patron",
    badge: "⭐",
    minDonationUsd: 5,
    rawBuff: 3,
    nextCta: "Upgrade for $100 donation →",
  },
  {
    tier: "PATRON_100",
    label: "Super Patron",
    badge: "💎",
    minDonationUsd: 100,
    rawBuff: 8,
    nextCta: "Upgrade for $1K donation →",
  },
  {
    tier: "PATRON_1K",
    label: "Elite",
    badge: "🔥",
    minDonationUsd: 1_000,
    rawBuff: 15,
    nextCta: "Upgrade for $10K donation →",
  },
  {
    tier: "PATRON_10K",
    label: "Legend",
    badge: "👑",
    minDonationUsd: 10_000,
    rawBuff: 22,
    nextCta: "Ascend for $1M donation →",
  },
  {
    tier: "PATRON_1M",
    label: "Whale",
    badge: "🐋",
    minDonationUsd: 1_000_000,
    rawBuff: 30, // max
    nextCta: "Max tier reached",
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Get the TierDef for a given tier key */
export function getTierDef(tier: WalletBuffTier): TierDef {
  return WALLET_BUFF_TIERS.find((t) => t.tier === tier) ?? WALLET_BUFF_TIERS[0];
}

/** Determine a wallet's tier from its verification + cumulative donation */
export function resolveWalletTier(
  signatureVerified: boolean,
  donationTotalUsd: number,
): WalletBuffTier {
  if (!signatureVerified) return "CONNECTED";

  // Walk tiers from highest to lowest
  for (let i = WALLET_BUFF_TIERS.length - 1; i >= 0; i--) {
    const t = WALLET_BUFF_TIERS[i];
    if (t.tier === "CONNECTED") continue;
    if (t.tier === "SIGNATURE_VERIFIED") return "SIGNATURE_VERIFIED";
    if (donationTotalUsd >= t.minDonationUsd) return t.tier;
  }
  return "SIGNATURE_VERIFIED";
}

/** Get the next tier def (the tier ABOVE the given one), or null if at max */
export function getNextTier(current: WalletBuffTier): TierDef | null {
  const idx = WALLET_BUFF_TIERS.findIndex((t) => t.tier === current);
  if (idx === -1 || idx >= WALLET_BUFF_TIERS.length - 1) return null;
  return WALLET_BUFF_TIERS[idx + 1];
}

/* ------------------------------------------------------------------ */
/*  Diminishing returns math                                           */
/* ------------------------------------------------------------------ */

/**
 * Per-wallet buff with diminishing returns above $1,000.
 *
 * Below $1K: linear scaling (rawBuff of tier)
 * Above $1K: logarithmic — each additional dollar contributes less.
 *
 * Formula for the high-end bonus:
 *   bonus = rawBuff + log₂(1 + extraUsd / 1000) × 2
 *
 * This means:
 *   $1K   → 15 + 0    = 15.0
 *   $10K  → 22 + ~6.6 = 28.6
 *   $1M   → 30 + ~20  = 50
 *   $2M   → 30 + ~21  = 51   (barely more than $1M)
 *   $10M  → 30 + ~26  = 56   (still very slight gain)
 */
export function walletBuff(tier: WalletBuffTier, donationTotalUsd: number): number {
  const def = getTierDef(tier);
  const base = def.rawBuff;

  if (donationTotalUsd <= 1_000) return base;

  // Diminishing returns above $1K
  const extraUsd = donationTotalUsd - 1_000;
  const logBonus = Math.log2(1 + extraUsd / 1_000) * 2;
  return base + logBonus;
}

/**
 * Account-level aggregate buff from all wallets.
 *
 * Each wallet contributes its full buff, but wallets are sorted highest-first
 * and each subsequent wallet is discounted:
 *   Wallet 1: 100%
 *   Wallet 2: 40%
 *   Wallet 3: 16%
 *   Wallet N: 100% × 0.4^(N-1)
 *
 * This prevents bots from scaling linearly by connecting many wallets.
 */
export function accountBuffFromWallets(
  walletBuffs: number[],
): number {
  const sorted = [...walletBuffs].sort((a, b) => b - a);
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    const discount = Math.pow(0.4, i); // 1.0, 0.4, 0.16, 0.064, ...
    total += sorted[i] * discount;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Free-signature bot nerf.
 *
 * Returns a multiplier (0..1) for the free-signature buff based on
 * how many wallets a single account has signature-verified.
 *
 * 1st wallet: 1.0×   (full)
 * 2nd wallet: 0.5×
 * 3rd wallet: 0.25×
 * 4th+:       0.1×   (floor)
 *
 * This means 10 sig-verified wallets give ~2.85 buff, not 10.
 */
export function signatureNerfMultiplier(sigVerifiedWalletIndex: number): number {
  if (sigVerifiedWalletIndex <= 0) return 1;
  if (sigVerifiedWalletIndex === 1) return 0.5;
  if (sigVerifiedWalletIndex === 2) return 0.25;
  return 0.1;
}

/* ------------------------------------------------------------------ */
/*  Donation target addresses                                          */
/* ------------------------------------------------------------------ */

/** System wallet addresses that receive donations */
export const DONATION_ADDRESSES = {
  evm: VEGGA_SYSTEM.wallets.evm,
  solana: VEGGA_SYSTEM.wallets.solana,
  bitcoin: VEGGA_SYSTEM.wallets.bitcoin,
} as const;

/* ------------------------------------------------------------------ */
/*  UI helpers                                                         */
/* ------------------------------------------------------------------ */

/** Tier badge color classes for Tailwind */
export function tierColorClasses(tier: WalletBuffTier): {
  bg: string;
  text: string;
  border: string;
} {
  switch (tier) {
    case "CONNECTED":
      return { bg: "bg-zinc-500/10", text: "text-zinc-500", border: "border-zinc-300 dark:border-zinc-700" };
    case "SIGNATURE_VERIFIED":
      return { bg: "bg-sky-500/10 dark:bg-emerald-500/10", text: "text-sky-600 dark:text-emerald-400", border: "border-sky-500/50 dark:border-emerald-500/50" };
    case "PATRON_5":
      return { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/50" };
    case "PATRON_100":
      return { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/50" };
    case "PATRON_1K":
      return { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/50" };
    case "PATRON_10K":
      return { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/50" };
    case "PATRON_1M":
      return { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/50" };
  }
}
