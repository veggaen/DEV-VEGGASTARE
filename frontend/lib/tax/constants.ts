/**
 * Norwegian Tax Constants — 2025/2026 Rules
 * Sources: Skatteetaten, Statsbudsjettet 2026, Smartepenger
 *
 * NOTE: This is for PREVIEW/ESTIMATION only — not tax advice.
 * Users should consult Skatteetaten or a tax professional.
 */

// ─── Corporate Tax ─────────────────────────────────────────────
export const CORPORATE_TAX_RATE = 0.22; // 22% on worldwide profits
export const FINANCIAL_SECTOR_TAX_RATE = 0.25; // 25% for banks/finance

// ─── Personal Income Tax (Bracket Tax / Trinnskatt) 2026 ──────
// Progressive brackets on personal income (lønnsinntekt / næringsinntekt)
export const BRACKET_TAX_2026 = [
  { from: 0,       to: 208_050, rate: 0 },
  { from: 208_050, to: 292_850, rate: 0.017 },  // 1.7%
  { from: 292_850, to: 670_000, rate: 0.040 },  // 4.0%
  { from: 670_000, to: 937_900, rate: 0.136 },  // 13.6%
  { from: 937_900, to: 1_350_000, rate: 0.166 }, // 16.6%
  { from: 1_350_000, to: Infinity, rate: 0.176 }, // 17.6%
];

// ─── Ordinary Income Tax ──────────────────────────────────────
export const ORDINARY_INCOME_TAX_RATE = 0.22; // Flat 22% on "alminnelig inntekt"

// ─── National Insurance (Trygdeavgift) 2026 ───────────────────
export const NI_EMPLOYEE_RATE = 0.078;   // 7.8% on salary
export const NI_SELF_EMPLOYED_RATE = 0.108; // 10.8% on business income (down from 10.9% in 2025)
export const NI_EMPLOYER_RATE = 0.141;   // 14.1% employer contribution

// ─── Personal Allowance (Personfradrag) 2026 ──────────────────
export const PERSONAL_ALLOWANCE = 114_950; // NOK (approx ~4% up from 2025)
export const MINIMUM_DEDUCTION_RATE = 0.46; // 46% of income
export const MINIMUM_DEDUCTION_MAX = 116_300; // Max minstefradrag 2026
export const MINIMUM_DEDUCTION_MIN = 31_800;  // Min minstefradrag

// ─── Dividend Tax ─────────────────────────────────────────────
export const DIVIDEND_UPLIFT_FACTOR = 1.72; // Oppjusteringsfaktor
export const DIVIDEND_EFFECTIVE_RATE = 0.22 * 1.72; // ≈ 37.84%

// ─── VAT Rates (MVA/Merverdiavgift) ──────────────────────────
export const VAT_RATES = {
  STANDARD: 0.25,      // 25% — general rate
  FOOD: 0.15,          // 15% — food/beverages
  TRANSPORT: 0.12,     // 12% — transport, hotels, cinema
  CULTURE: 0.12,       // 12% (was 6% for some — now merged in recent updates)
  LOW: 0.12,           // 12% — general reduced rate
  ZERO: 0,             // 0% — exports, newspapers, books, electric vehicles
} as const;

export const VAT_REGISTRATION_THRESHOLD = 50_000; // NOK turnover → must register for MVA

// ─── Employer Obligations ─────────────────────────────────────
export const EMPLOYER_NI_RATE = 0.141; // Arbeidsgiveravgift 14.1%
// Zone reductions exist (0–14.1%) but default to highest

// ─── Key Deadlines ────────────────────────────────────────────
export const TAX_DEADLINES = {
  ANNUAL_RETURN: '05-31',          // May 31 — Skattemelding
  ADVANCE_TAX_Q1: '03-15',        // First advance payment
  ADVANCE_TAX_Q2: '05-15',
  ADVANCE_TAX_Q3: '09-15',
  ADVANCE_TAX_Q4: '11-15',
  A_MELDING_MONTHLY: 'every-5th', // By 5th of following month
  VAT_BIMONTHLY: 'every-other-month-10th', // By 10th, bimonthly
} as const;

// ─── Company Type Tax Profiles ────────────────────────────────
export type CompanyOrgType = 'ENK' | 'AS' | 'ANS' | 'DA' | 'SA' | 'FORENING' | 'NUF' | 'OTHER';

export interface TaxProfile {
  orgType: CompanyOrgType;
  label: string;
  description: string;
  hasCorporateTax: boolean;
  isPassThrough: boolean;          // Profits taxed as personal income
  corporateTaxRate: number;
  ownerNiRate: number;            // NI rate for owner/partner
  limitedLiability: boolean;
  minCapital: number | null;      // NOK
  dividendTaxApplies: boolean;
  specialNotes: string;
}

export const TAX_PROFILES: Record<CompanyOrgType, TaxProfile> = {
  ENK: {
    orgType: 'ENK',
    label: 'Enkeltpersonforetak',
    description: 'Sole Proprietorship — profits are personal income',
    hasCorporateTax: false,
    isPassThrough: true,
    corporateTaxRate: 0,
    ownerNiRate: NI_SELF_EMPLOYED_RATE,
    limitedLiability: false,
    minCapital: null,
    dividendTaxApplies: false,
    specialNotes: 'Set aside ~40% of profits for taxes. Unlimited personal liability.',
  },
  AS: {
    orgType: 'AS',
    label: 'Aksjeselskap',
    description: 'Private Limited Company — 22% corporate tax',
    hasCorporateTax: true,
    isPassThrough: false,
    corporateTaxRate: CORPORATE_TAX_RATE,
    ownerNiRate: 0, // Owner is employee, pays NI via salary
    limitedLiability: true,
    minCapital: 30_000,
    dividendTaxApplies: true,
    specialNotes: 'Dividends taxed at ~37.84% effective (uplift 1.72x). Min NOK 30k capital.',
  },
  ANS: {
    orgType: 'ANS',
    label: 'Ansvarlig Selskap',
    description: 'General Partnership — joint/several liability',
    hasCorporateTax: false,
    isPassThrough: true,
    corporateTaxRate: 0,
    ownerNiRate: NI_SELF_EMPLOYED_RATE,
    limitedLiability: false,
    minCapital: null,
    dividendTaxApplies: false,
    specialNotes: 'All partners fully liable (joint and several). Profits taxed per partner share.',
  },
  DA: {
    orgType: 'DA',
    label: 'Selskap med Delt Ansvar',
    description: 'Partnership — pro rata liability',
    hasCorporateTax: false,
    isPassThrough: true,
    corporateTaxRate: 0,
    ownerNiRate: NI_SELF_EMPLOYED_RATE,
    limitedLiability: false,
    minCapital: null,
    dividendTaxApplies: false,
    specialNotes: 'Partners liable proportionally to ownership share.',
  },
  SA: {
    orgType: 'SA',
    label: 'Samvirkeforetak',
    description: 'Cooperative — 22% corporate tax with member allocation deductions',
    hasCorporateTax: true,
    isPassThrough: false,
    corporateTaxRate: CORPORATE_TAX_RATE,
    ownerNiRate: 0,
    limitedLiability: true,
    minCapital: null,
    dividendTaxApplies: false,
    specialNotes: 'Can deduct member allocations (patronage dividends). Non-profit uses may qualify for exemptions.',
  },
  FORENING: {
    orgType: 'FORENING',
    label: 'Forening',
    description: 'Association — often tax-exempt if non-profit',
    hasCorporateTax: false,
    isPassThrough: false,
    corporateTaxRate: 0,
    ownerNiRate: 0,
    limitedLiability: true,
    minCapital: null,
    dividendTaxApplies: false,
    specialNotes: 'Tax-exempt on membership fees/activities. Business income taxed at 22%.',
  },
  NUF: {
    orgType: 'NUF',
    label: 'Norskregistrert Utenlandsk Foretak',
    description: 'Foreign Branch — taxed like AS if managed in Norway',
    hasCorporateTax: true,
    isPassThrough: false,
    corporateTaxRate: CORPORATE_TAX_RATE,
    ownerNiRate: 0,
    limitedLiability: true,
    minCapital: null,
    dividendTaxApplies: false,
    specialNotes: 'If managed from Norway: 22% on NO-source income. 2026: Name must include parent name + "NUF".',
  },
  OTHER: {
    orgType: 'OTHER',
    label: 'Other',
    description: 'Generic — defaults to 22% corporate rate',
    hasCorporateTax: true,
    isPassThrough: false,
    corporateTaxRate: CORPORATE_TAX_RATE,
    ownerNiRate: 0,
    limitedLiability: false,
    minCapital: null,
    dividendTaxApplies: false,
    specialNotes: 'Review with tax advisor for specific rules.',
  },
};
