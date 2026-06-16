/**
 * Reach Engine — class-based identity trust + risk + True Reach.
 *
 * Implements docs/REACH_AND_VERIFICATION_DESIGN.md §2 (trust classes), §5 (risk),
 * §6 (True Reach). Pure, deterministic, dependency-free → fully unit-testable.
 *
 * Core principle (anti-exploit AND completeness-rewarding):
 *  - Trust is grouped into INDEPENDENT classes, each capped.
 *  - Diminishing returns applies ONLY WITHIN a class (Sybil defense: farming many
 *    cheap correlated socials can't rival one strong proof).
 *  - Across classes everything sums → verifying ALL methods = the maximum, by
 *    construction.
 *
 * All weights/caps live in REACH_CONFIG so they're tunable in one place.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Config — every magic number lives here (design §2, §5, §6).
// ─────────────────────────────────────────────────────────────────────────────

export const REACH_CONFIG = {
  /** Per-class caps. trust = Σ min(cap, sum-of-methods-in-class). */
  classCaps: {
    governmentEid: 100, // BankID
    bankPhone: 70, // Vipps, SMS phone
    payment: 40, // card, web3 spend
    social: 35, // Google/GitHub/Discord/verified-email (diminishing inside)
    walletProvenance: 25, // signed wallet + source bonus
  },

  /** Raw method points (pre-cap). */
  methodPoints: {
    bankid: 100,
    bankidBiometric: 110, // slightly higher; still capped at governmentEid cap
    vipps: 70,
    phone: 35,
    bothBankPhoneBonus: 10, // small bonus if a user has BOTH vipps + phone
    cardPayment: 30,
    web3Spend: 25,
    google: 20,
    github: 20,
    discord: 12,
    emailVerified: 8,
    // wallet provenance
    walletSignedBase: 10,
    walletKycBonus: 15, // custodial/KYC source (Coinbase etc.)
    walletHistoryBonus: 8, // meaningful on-chain age/history
  },

  /** Diminishing-returns multipliers applied to the 1st,2nd,3rd… item WITHIN a class. */
  intraClassDecay: [1, 0.6, 0.3, 0.15] as const,

  /** Risk: each flag adds points to a 0–100 risk score. */
  riskPoints: {
    disposableEmail: 55,
    unverifiedEmailOnly: 25, // unverified email AND no strong signal
    freshAnonWalletOnly: 35, // brand-new anon wallet as sole identity
    velocityFlag: 20, // many accounts/IP, rapid actions
  },

  /** True Reach weighting. */
  trueReach: {
    wTrust: 0.55,
    wBehavior: 0.45,
    /** how hard risk discounts the final number (0..1) */
    riskPenaltyK: 0.6,
    /** normalization ceilings (a "very high" raw value → ~1.0) */
    trustNorm: 270, // = sum of all class caps (the ceiling)
    behaviorNorm: 5000,
    /** final display scale */
    outputScale: 1000,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletSignal {
  verified: boolean;
  /** 'kyc' (custodial/exchange), 'neutral' (self-custody w/ history), 'fresh' (new/anon) */
  riskTier?: "kyc" | "neutral" | "fresh";
  hasHistory?: boolean;
}

export interface ReachInputs {
  // government eID
  bankidVerified?: boolean;
  bankidBiometric?: boolean;
  // bank / phone
  vippsVerified?: boolean;
  phoneVerified?: boolean;
  // payment
  hasCardPayment?: boolean;
  hasWeb3Spend?: boolean;
  // social / email
  hasGoogle?: boolean;
  hasGithub?: boolean;
  hasDiscord?: boolean;
  emailVerified?: boolean;
  // wallets (best one used; multiple wallets don't multiply provenance)
  wallets?: WalletSignal[];
  // risk
  emailDisposable?: boolean;
  emailPresentButUnverified?: boolean;
  velocityFlag?: boolean;
  // behavior (already-computed in the app)
  behaviorReach?: number;
}

export interface TrustBreakdown {
  governmentEid: number;
  bankPhone: number;
  payment: number;
  social: number;
  walletProvenance: number;
  total: number;
}

export interface ReachResult {
  trust: TrustBreakdown;
  riskScore: number; // 0–100
  trueReach: number; // scaled integer
  /** human-readable component contributions for the honest display */
  components: {
    trustNormalized: number;
    behaviorNormalized: number;
    riskPenalty: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Sum a list of point values with intra-class diminishing returns, then cap. */
function classScore(points: number[], cap: number): number {
  const sorted = [...points].filter((p) => p > 0).sort((a, b) => b - a); // strongest first
  const decay = REACH_CONFIG.intraClassDecay;
  let sum = 0;
  sorted.forEach((p, i) => {
    const mult = decay[i] ?? decay[decay.length - 1];
    sum += p * mult;
  });
  return Math.min(cap, Math.round(sum));
}

// ─────────────────────────────────────────────────────────────────────────────
// Trust (design §2)
// ─────────────────────────────────────────────────────────────────────────────

export function computeTrust(input: ReachInputs): TrustBreakdown {
  const P = REACH_CONFIG.methodPoints;
  const C = REACH_CONFIG.classCaps;

  // Government eID — single strongest value (biometric or standard).
  const govPoints: number[] = [];
  if (input.bankidVerified) govPoints.push(input.bankidBiometric ? P.bankidBiometric : P.bankid);
  const governmentEid = classScore(govPoints, C.governmentEid);

  // Bank/phone — Vipps and SMS phone; small bonus if both (independent confirmations).
  const bankPoints: number[] = [];
  if (input.vippsVerified) bankPoints.push(P.vipps);
  if (input.phoneVerified) bankPoints.push(P.phone);
  if (input.vippsVerified && input.phoneVerified) bankPoints.push(P.bothBankPhoneBonus);
  const bankPhone = classScore(bankPoints, C.bankPhone);

  // Payment.
  const payPoints: number[] = [];
  if (input.hasCardPayment) payPoints.push(P.cardPayment);
  if (input.hasWeb3Spend) payPoints.push(P.web3Spend);
  const payment = classScore(payPoints, C.payment);

  // Social/email — diminishing returns INSIDE this class (Sybil defense).
  const socialPoints: number[] = [];
  if (input.hasGoogle) socialPoints.push(P.google);
  if (input.hasGithub) socialPoints.push(P.github);
  if (input.hasDiscord) socialPoints.push(P.discord);
  if (input.emailVerified) socialPoints.push(P.emailVerified);
  const social = classScore(socialPoints, C.social);

  // Wallet provenance — best single wallet (don't multiply across many wallets).
  let walletProvenance = 0;
  if (input.wallets && input.wallets.length > 0) {
    const best = input.wallets
      .filter((w) => w.verified)
      .map((w) => {
        let pts = P.walletSignedBase;
        if (w.riskTier === "kyc") pts += P.walletKycBonus;
        if (w.hasHistory) pts += P.walletHistoryBonus;
        return pts;
      })
      .sort((a, b) => b - a)[0] ?? 0;
    walletProvenance = Math.min(C.walletProvenance, best);
  }

  const total = governmentEid + bankPhone + payment + social + walletProvenance;
  return { governmentEid, bankPhone, payment, social, walletProvenance, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk (design §5)
// ─────────────────────────────────────────────────────────────────────────────

export function computeRisk(input: ReachInputs, trust: TrustBreakdown): number {
  const R = REACH_CONFIG.riskPoints;
  let risk = 0;
  if (input.emailDisposable) risk += R.disposableEmail;

  const hasStrongSignal = trust.total - trust.social > 0 || trust.social > REACH_CONFIG.methodPoints.emailVerified;
  if (input.emailPresentButUnverified && !hasStrongSignal) risk += R.unverifiedEmailOnly;

  const onlyFreshWallet =
    trust.total === trust.walletProvenance &&
    trust.walletProvenance > 0 &&
    (input.wallets ?? []).every((w) => w.riskTier === "fresh" || !w.hasHistory);
  if (onlyFreshWallet) risk += R.freshAnonWalletOnly;

  if (input.velocityFlag) risk += R.velocityFlag;

  return clamp(Math.round(risk), 0, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// True Reach (design §6)
// ─────────────────────────────────────────────────────────────────────────────

export function computeReach(input: ReachInputs): ReachResult {
  const T = REACH_CONFIG.trueReach;
  const trust = computeTrust(input);
  const riskScore = computeRisk(input, trust);

  const trustNormalized = clamp(trust.total / T.trustNorm, 0, 1);
  const behaviorNormalized = clamp((input.behaviorReach ?? 0) / T.behaviorNorm, 0, 1);
  const riskPenalty = (riskScore / 100) * T.riskPenaltyK;

  const blended = T.wTrust * trustNormalized + T.wBehavior * behaviorNormalized;
  const trueReach = Math.round(blended * (1 - riskPenalty) * T.outputScale);

  return {
    trust,
    riskScore,
    trueReach,
    components: { trustNormalized, behaviorNormalized, riskPenalty },
  };
}
