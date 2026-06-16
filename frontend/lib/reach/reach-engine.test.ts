import { describe, expect, it } from "vitest";
import {
  computeTrust,
  computeRisk,
  computeReach,
  REACH_CONFIG,
  type ReachInputs,
} from "./reach-engine";

const C = REACH_CONFIG.classCaps;

describe("reach-engine · trust (class-based)", () => {
  it("BankID alone hits the government-eID cap", () => {
    const t = computeTrust({ bankidVerified: true });
    expect(t.governmentEid).toBe(C.governmentEid);
    expect(t.total).toBe(C.governmentEid);
  });

  it("ANTI-SYBIL: stacking all socials caps at the social class cap", () => {
    const t = computeTrust({ hasGoogle: true, hasGithub: true, hasDiscord: true, emailVerified: true });
    expect(t.social).toBe(C.social); // capped, not 20+20+12+8=60
    expect(t.total).toBe(C.social);
  });

  it("BankID outranks any number of socials", () => {
    const bankid = computeTrust({ bankidVerified: true }).total;
    const socials = computeTrust({ hasGoogle: true, hasGithub: true, hasDiscord: true, emailVerified: true }).total;
    expect(bankid).toBeGreaterThan(socials);
  });

  it("intra-class diminishing returns: 2nd social adds less than the 1st", () => {
    const one = computeTrust({ hasGoogle: true }).social;
    const two = computeTrust({ hasGoogle: true, hasGithub: true }).social;
    const firstDelta = one;
    const secondDelta = two - one;
    expect(secondDelta).toBeLessThan(firstDelta);
    expect(secondDelta).toBeGreaterThan(0); // but still adds something
  });

  it("COMPLETENESS: verifying ALL classes reaches the ceiling (sum of caps)", () => {
    const all: ReachInputs = {
      bankidVerified: true,
      bankidBiometric: true,
      vippsVerified: true,
      phoneVerified: true,
      hasCardPayment: true,
      hasWeb3Spend: true,
      hasGoogle: true,
      hasGithub: true,
      hasDiscord: true,
      emailVerified: true,
      wallets: [{ verified: true, riskTier: "kyc", hasHistory: true }],
    };
    const t = computeTrust(all);
    const ceiling = C.governmentEid + C.bankPhone + C.payment + C.social + C.walletProvenance;
    expect(t.total).toBe(ceiling);
    expect(ceiling).toBe(REACH_CONFIG.trueReach.trustNorm);
  });

  it("CROSS-CLASS always adds: social+BankID > BankID alone", () => {
    const bankidOnly = computeTrust({ bankidVerified: true }).total;
    const both = computeTrust({ bankidVerified: true, hasGoogle: true }).total;
    expect(both).toBeGreaterThan(bankidOnly); // completeness rewarded across classes
  });

  it("wallet provenance: KYC wallet scores higher than fresh anon", () => {
    const kyc = computeTrust({ wallets: [{ verified: true, riskTier: "kyc", hasHistory: true }] }).walletProvenance;
    const fresh = computeTrust({ wallets: [{ verified: true, riskTier: "fresh" }] }).walletProvenance;
    expect(kyc).toBeGreaterThan(fresh);
  });

  it("unverified wallet contributes nothing", () => {
    const t = computeTrust({ wallets: [{ verified: false, riskTier: "kyc" }] });
    expect(t.walletProvenance).toBe(0);
  });
});

describe("reach-engine · risk", () => {
  it("disposable email adds significant risk", () => {
    const t = computeTrust({ emailVerified: true });
    const risk = computeRisk({ emailDisposable: true, emailVerified: true }, t);
    expect(risk).toBeGreaterThanOrEqual(REACH_CONFIG.riskPoints.disposableEmail);
  });

  it("a fully-verified user has zero risk", () => {
    const input: ReachInputs = { bankidVerified: true, phoneVerified: true, hasCardPayment: true };
    const t = computeTrust(input);
    expect(computeRisk(input, t)).toBe(0);
  });

  it("unverified-email-only (no strong signal) is risky; with BankID it is not", () => {
    const weak = computeTrust({ emailPresentButUnverified: true });
    expect(computeRisk({ emailPresentButUnverified: true }, weak)).toBeGreaterThan(0);

    const strong = computeTrust({ bankidVerified: true, emailPresentButUnverified: true });
    expect(computeRisk({ bankidVerified: true, emailPresentButUnverified: true }, strong)).toBe(0);
  });

  it("risk is clamped to 0–100", () => {
    const input: ReachInputs = { emailDisposable: true, velocityFlag: true, emailPresentButUnverified: true };
    const t = computeTrust(input);
    const risk = computeRisk(input, t);
    expect(risk).toBeLessThanOrEqual(100);
    expect(risk).toBeGreaterThanOrEqual(0);
  });
});

describe("reach-engine · true reach", () => {
  it("verify-all + high behavior → near the output ceiling", () => {
    const r = computeReach({
      bankidVerified: true,
      vippsVerified: true,
      phoneVerified: true,
      hasCardPayment: true,
      hasWeb3Spend: true,
      hasGoogle: true,
      hasGithub: true,
      wallets: [{ verified: true, riskTier: "kyc", hasHistory: true }],
      behaviorReach: REACH_CONFIG.trueReach.behaviorNorm,
    });
    expect(r.trueReach).toBeGreaterThan(900); // close to outputScale 1000
    expect(r.riskScore).toBe(0);
  });

  it("disposable-email user ranks BELOW the same user without it", () => {
    const base: ReachInputs = { hasGoogle: true, emailVerified: true, behaviorReach: 1000 };
    const clean = computeReach(base).trueReach;
    const risky = computeReach({ ...base, emailDisposable: true }).trueReach;
    expect(risky).toBeLessThan(clean);
  });

  it("BankID user ranks above an all-socials user (same behavior)", () => {
    const behaviorReach = 1000;
    const bankid = computeReach({ bankidVerified: true, behaviorReach }).trueReach;
    const socials = computeReach({
      hasGoogle: true, hasGithub: true, hasDiscord: true, emailVerified: true, behaviorReach,
    }).trueReach;
    expect(bankid).toBeGreaterThan(socials);
  });

  it("anonymous (no trust, no behavior) → 0", () => {
    expect(computeReach({}).trueReach).toBe(0);
  });

  it("is deterministic", () => {
    const input: ReachInputs = { bankidVerified: true, hasGoogle: true, behaviorReach: 500 };
    expect(computeReach(input)).toEqual(computeReach(input));
  });
});
