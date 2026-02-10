/**
 * Norwegian Tax Constants — 2025 Tax Year
 *
 * All rates are from official Skatteetaten sources for the 2025 income year.
 * See TAX_SOURCES below for direct links to each rate page.
 *
 * NOTE: This is for PREVIEW/ESTIMATION only — not tax advice.
 * Users should consult Skatteetaten or a tax professional.
 */

// ─── Tax Year ──────────────────────────────────────────────────
export const TAX_YEAR = 2025;

// ─── Official Source URLs ──────────────────────────────────────
export const TAX_SOURCES = {
  BRACKET_TAX: 'https://www.skatteetaten.no/en/rates/bracket-tax/',
  GENERAL_INCOME: 'https://www.skatteetaten.no/en/rates/general-income/',
  NATIONAL_INSURANCE: 'https://www.skatteetaten.no/en/rates/national-insurance-contributions/',
  EMPLOYER_NI: 'https://www.skatteetaten.no/en/rates/employers-national-insurance-contributions/',
  PERSONAL_ALLOWANCE: 'https://www.skatteetaten.no/en/rates/personal-allowance/',
  MINIMUM_DEDUCTION: 'https://www.skatteetaten.no/en/rates/minimum-standard-deduction/',
  DIVIDEND_UPLIFT: 'https://www.skatteetaten.no/en/rates/factor-for-upward-adjustment-of-gainloss-or-dividend-on-shares/',
  VAT: 'https://www.skatteetaten.no/en/rates/value-added-tax/',
  CRYPTO_TAX: 'https://www.skatteetaten.no/en/person/taxes/get-the-taxes-right/virtual-assets/',
  ALL_RATES: 'https://www.skatteetaten.no/en/rates/',
  SKATTELOVEN: 'https://lovdata.no/dokument/NL/lov/1999-03-26-14',
  MVA_LOVEN: 'https://lovdata.no/dokument/NL/lov/2009-06-19-58',
  COMPANY_REGISTRATION: 'https://www.brreg.no/en/',
  AS_RULES: 'https://lovdata.no/dokument/NL/lov/1997-06-13-44',
  PARTNERSHIP_RULES: 'https://lovdata.no/dokument/NL/lov/1985-06-21-83',
  ALTINN_TAXES: 'https://www.altinn.no/en/start-and-run-business/taxation/',
} as const;

// ─── Corporate Tax ─────────────────────────────────────────────
export const CORPORATE_TAX_RATE = 0.22; // 22% on worldwide profits
export const FINANCIAL_SECTOR_TAX_RATE = 0.25; // 25% for banks/finance

// ─── Personal Income Tax (Bracket Tax / Trinnskatt) 2025 ──────
// Source: https://www.skatteetaten.no/en/rates/bracket-tax/
// Progressive brackets on personal income (lønnsinntekt / næringsinntekt)
export const BRACKET_TAX_2025 = [
  { from: 0,         to: 226_100,   rate: 0 },
  { from: 226_100,   to: 318_300,   rate: 0.017 },  // Step 1: 1.7%
  { from: 318_300,   to: 725_050,   rate: 0.040 },  // Step 2: 4.0%
  { from: 725_050,   to: 980_100,   rate: 0.137 },  // Step 3: 13.7%
  { from: 980_100,   to: 1_467_200, rate: 0.168 },  // Step 4: 16.8%
  { from: 1_467_200, to: Infinity,  rate: 0.178 },  // Step 5: 17.8%
];

// Keep alias for backward compatibility
export const BRACKET_TAX_2026 = BRACKET_TAX_2025;

// ─── Ordinary Income Tax ──────────────────────────────────────
// Source: https://www.skatteetaten.no/en/rates/general-income/
export const ORDINARY_INCOME_TAX_RATE = 0.22; // Flat 22% on "alminnelig inntekt"

// ─── National Insurance (Trygdeavgift) 2025 ───────────────────
// Source: https://www.skatteetaten.no/en/rates/national-insurance-contributions/
export const NI_EMPLOYEE_RATE = 0.076;   // 7.6% on salary (age 17-69)
export const NI_SELF_EMPLOYED_RATE = 0.108; // 10.8% on business income
export const NI_EMPLOYER_RATE = 0.141;   // 14.1% employer contribution (Zone I)
export const NI_PENSION_RATE = 0.051;    // 5.1% on pension income

// ─── Personal Allowance (Personfradrag) 2025 ──────────────────
// Source: https://www.skatteetaten.no/en/rates/personal-allowance/
export const PERSONAL_ALLOWANCE = 108_550; // NOK — Class 1

// ─── Minimum Standard Deduction (Minstefradrag) 2025 ──────────
// Source: https://www.skatteetaten.no/en/rates/minimum-standard-deduction/
export const MINIMUM_DEDUCTION_RATE = 0.46; // 46% of salary income
export const MINIMUM_DEDUCTION_MAX = 92_000; // Upper limit for salary
export const MINIMUM_DEDUCTION_MIN = 4_000;  // Min for board members etc.
export const MINIMUM_DEDUCTION_PENSION_RATE = 0.40; // 40% of pension income
export const MINIMUM_DEDUCTION_PENSION_MAX = 73_150; // Upper limit for pension

// ─── Dividend Tax ─────────────────────────────────────────────
// Source: https://www.skatteetaten.no/en/rates/factor-for-upward-adjustment-of-gainloss-or-dividend-on-shares/
// Effective rate for 2025/2026: 37.84% (confirmed by Skatteetaten)
export const DIVIDEND_UPLIFT_FACTOR = 1.72; // Oppjusteringsfaktor
export const DIVIDEND_EFFECTIVE_RATE = 0.22 * 1.72; // ≈ 37.84%

// ─── VAT Rates (MVA/Merverdiavgift) ──────────────────────────
// Source: https://www.skatteetaten.no/en/rates/value-added-tax/
export const VAT_RATES = {
  STANDARD: 0.25,      // 25% — general rate
  FOOD: 0.15,          // 15% — food, beverages, water/wastewater
  TRANSPORT: 0.12,     // 12% — transport, hotels, cinema, sporting events
  CULTURE: 0.12,       // 12% — museums, amusement parks
  LOW: 0.12,           // 12% — general reduced rate
  ZERO: 0,             // 0% — exports, newspapers, books, electric vehicles
} as const;

export const VAT_REGISTRATION_THRESHOLD = 50_000; // NOK turnover → must register for MVA

// ─── Employer Obligations ─────────────────────────────────────
// Source: https://www.skatteetaten.no/en/rates/employers-national-insurance-contributions/
export const EMPLOYER_NI_RATE = 0.141; // Arbeidsgiveravgift 14.1% (Zone I)
// Zone II: 10.6%, Zone III: 6.4%, Zone IV: 5.1%, Zone IVa: 7.9%, Zone V: 0%

// ─── Key Deadlines ────────────────────────────────────────────
export const TAX_DEADLINES = {
  ANNUAL_RETURN: '04-30',          // April 30 — Skattemelding (standard deadline)
  ANNUAL_RETURN_SELF_EMPLOYED: '05-31', // May 31 — ENK/self-employed
  ADVANCE_TAX_Q1: '03-15',        // First advance payment
  ADVANCE_TAX_Q2: '05-15',
  ADVANCE_TAX_Q3: '09-15',
  ADVANCE_TAX_Q4: '11-15',
  A_MELDING_MONTHLY: 'every-5th', // By 5th of following month
  VAT_BIMONTHLY: 'every-other-month-10th', // By 10th, bimonthly
} as const;

// ─── Company Type Tax Profiles ────────────────────────────────
export type CompanyOrgType = 'ENK' | 'AS' | 'ANS' | 'DA' | 'SA' | 'FORENING' | 'NUF' | 'OTHER';

// Personal (non-business) type for private individuals
export type TaxEntityType = CompanyOrgType | 'PRIVATE';

export interface TaxProfile {
  orgType: TaxEntityType;
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
  sourceUrl?: string;             // Official reference
}

export const TAX_PROFILES: Record<TaxEntityType, TaxProfile> = {
  PRIVATE: {
    orgType: 'PRIVATE',
    label: 'Private Person',
    description: 'Personal income tax on salary, capital gains, and crypto',
    hasCorporateTax: false,
    isPassThrough: true,
    corporateTaxRate: 0,
    ownerNiRate: NI_EMPLOYEE_RATE,
    limitedLiability: false,
    minCapital: null,
    dividendTaxApplies: true,
    specialNotes: 'Salary: 22% income tax + 7.6% NI + bracket tax. Crypto/shares: 22% on gains (37.84% on dividends via uplift).',
    sourceUrl: TAX_SOURCES.ALL_RATES,
  },
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
    sourceUrl: TAX_SOURCES.ALTINN_TAXES,
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
    sourceUrl: TAX_SOURCES.AS_RULES,
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
    sourceUrl: TAX_SOURCES.PARTNERSHIP_RULES,
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
    sourceUrl: TAX_SOURCES.PARTNERSHIP_RULES,
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
    sourceUrl: TAX_SOURCES.SKATTELOVEN,
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
    sourceUrl: TAX_SOURCES.SKATTELOVEN,
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
    specialNotes: 'If managed from Norway: 22% on NO-source income. Name must include parent company name + "NUF".',
    sourceUrl: TAX_SOURCES.COMPANY_REGISTRATION,
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
    sourceUrl: TAX_SOURCES.ALTINN_TAXES,
  },
};
