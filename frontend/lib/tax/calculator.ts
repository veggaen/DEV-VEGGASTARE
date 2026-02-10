/**
 * Norwegian Tax Calculator — 2025/2026 Rules
 *
 * Computes estimated tax liabilities for all Norwegian company types.
 * DISCLAIMER: Preview/estimation only. Not tax advice.
 */

import {
  CORPORATE_TAX_RATE,
  FINANCIAL_SECTOR_TAX_RATE,
  BRACKET_TAX_2026,
  ORDINARY_INCOME_TAX_RATE,
  NI_SELF_EMPLOYED_RATE,
  NI_EMPLOYEE_RATE,
  EMPLOYER_NI_RATE,
  PERSONAL_ALLOWANCE,
  MINIMUM_DEDUCTION_RATE,
  MINIMUM_DEDUCTION_MAX,
  MINIMUM_DEDUCTION_MIN,
  DIVIDEND_UPLIFT_FACTOR,
  VAT_RATES,
  TAX_PROFILES,
  type CompanyOrgType,
} from './constants';

// ─── Input Types ──────────────────────────────────────────────

export interface TaxCalculationInput {
  orgType: CompanyOrgType;
  period: string;                // "2026" or "2026-01"
  grossIncome: number;           // Total revenue (ex. VAT)
  totalExpenses: number;         // Deductible business expenses
  totalSalariesPaid: number;     // Gross salaries to employees
  employeeCount: number;
  ownerSalary?: number;          // For AS: owner's salary from company
  dividendsPaid?: number;        // For AS: dividends distributed
  partnerShares?: number;        // For ANS/DA: number of equal partners
  memberAllocations?: number;    // For SA: patronage dividends
  isFinancialSector?: boolean;
  vatCollected?: number;         // VAT received on sales
  vatPaid?: number;              // VAT paid on purchases
}

// ─── Output Types ─────────────────────────────────────────────

export interface TaxBreakdown {
  // Income
  grossIncome: number;
  totalExpenses: number;
  netProfit: number;

  // Corporate tax (AS, SA, NUF)
  corporateTax: number;
  corporateTaxRate: number;

  // Personal tax (ENK, ANS, DA)
  ordinaryIncomeTax: number;
  bracketTax: number;
  bracketTaxDetails: { bracket: string; amount: number; rate: number }[];
  nationalInsurance: number;
  personalAllowance: number;
  minimumDeduction: number;

  // Employer costs
  employerNI: number;
  totalEmployerCosts: number;

  // Dividends (AS)
  dividendTax: number;

  // VAT
  vatOwed: number;
  vatCollected: number;
  vatPaid: number;

  // Totals
  totalTaxLiability: number;
  effectiveTaxRate: number;

  // Meta
  orgType: CompanyOrgType;
  period: string;
  disclaimer: string;
}

// ─── Calculator Functions ─────────────────────────────────────

/**
 * Calculate bracket tax (trinnskatt) on personal income
 */
export function calculateBracketTax(income: number): {
  total: number;
  details: { bracket: string; amount: number; rate: number }[];
} {
  let total = 0;
  const details: { bracket: string; amount: number; rate: number }[] = [];

  for (const bracket of BRACKET_TAX_2026) {
    if (income <= bracket.from) break;
    if (bracket.rate === 0) continue;

    const taxableInBracket = Math.min(income, bracket.to) - bracket.from;
    const tax = taxableInBracket * bracket.rate;
    total += tax;
    details.push({
      bracket: `NOK ${bracket.from.toLocaleString('nb-NO')} – ${bracket.to === Infinity ? '∞' : `NOK ${bracket.to.toLocaleString('nb-NO')}`}`,
      amount: Math.round(tax),
      rate: bracket.rate,
    });
  }

  return { total: Math.round(total), details };
}

/**
 * Calculate minimum deduction (minstefradrag)
 */
export function calculateMinimumDeduction(grossSalary: number): number {
  const deduction = grossSalary * MINIMUM_DEDUCTION_RATE;
  return Math.round(Math.min(Math.max(deduction, MINIMUM_DEDUCTION_MIN), MINIMUM_DEDUCTION_MAX));
}

/**
 * Calculate employer's NI contribution (arbeidsgiveravgift)
 */
export function calculateEmployerNI(totalSalaries: number): number {
  return Math.round(totalSalaries * EMPLOYER_NI_RATE);
}

/**
 * Calculate ENK (Sole Proprietorship) tax — pass-through
 */
function calculateENK(input: TaxCalculationInput): TaxBreakdown {
  const netProfit = input.grossIncome - input.totalExpenses - input.totalSalariesPaid;
  const employerNI = calculateEmployerNI(input.totalSalariesPaid);

  // Owner's business income = net profit (taxed personally)
  const businessIncome = Math.max(0, netProfit);

  // Ordinary income tax: 22% on (business income - personal allowance)
  const taxableOrdinary = Math.max(0, businessIncome - PERSONAL_ALLOWANCE);
  const ordinaryIncomeTax = Math.round(taxableOrdinary * ORDINARY_INCOME_TAX_RATE);

  // Bracket tax on business income
  const { total: bracketTax, details: bracketTaxDetails } = calculateBracketTax(businessIncome);

  // National insurance: 10.8% on business income
  const nationalInsurance = Math.round(businessIncome * NI_SELF_EMPLOYED_RATE);

  // VAT
  const vatOwed = Math.round((input.vatCollected ?? 0) - (input.vatPaid ?? 0));

  const totalTaxLiability = ordinaryIncomeTax + bracketTax + nationalInsurance + employerNI;

  return {
    grossIncome: input.grossIncome,
    totalExpenses: input.totalExpenses,
    netProfit,
    corporateTax: 0,
    corporateTaxRate: 0,
    ordinaryIncomeTax,
    bracketTax,
    bracketTaxDetails,
    nationalInsurance,
    personalAllowance: PERSONAL_ALLOWANCE,
    minimumDeduction: 0,
    employerNI,
    totalEmployerCosts: input.totalSalariesPaid + employerNI,
    dividendTax: 0,
    vatOwed,
    vatCollected: input.vatCollected ?? 0,
    vatPaid: input.vatPaid ?? 0,
    totalTaxLiability,
    effectiveTaxRate: input.grossIncome > 0 ? totalTaxLiability / input.grossIncome : 0,
    orgType: 'ENK',
    period: input.period,
    disclaimer: 'Estimat basert på 2026-regler. Ikke skatterådgivning. Kontakt Skatteetaten for endelige tall.',
  };
}

/**
 * Calculate AS (Private Limited) tax — corporate + dividends
 */
function calculateAS(input: TaxCalculationInput): TaxBreakdown {
  const netProfit = input.grossIncome - input.totalExpenses - input.totalSalariesPaid;
  const employerNI = calculateEmployerNI(input.totalSalariesPaid);

  // Corporate tax: 22% (or 25% financial) on net profit
  const taxRate = input.isFinancialSector ? FINANCIAL_SECTOR_TAX_RATE : CORPORATE_TAX_RATE;
  const corporateTax = Math.round(Math.max(0, netProfit) * taxRate);

  // Owner salary personal tax (if owner takes salary)
  const ownerSalary = input.ownerSalary ?? 0;
  const minDeduction = calculateMinimumDeduction(ownerSalary);
  const taxableOwnerIncome = Math.max(0, ownerSalary - minDeduction - PERSONAL_ALLOWANCE);
  const ordinaryIncomeTax = Math.round(taxableOwnerIncome * ORDINARY_INCOME_TAX_RATE);
  const { total: bracketTax, details: bracketTaxDetails } = calculateBracketTax(ownerSalary);
  const ownerNI = Math.round(ownerSalary * NI_EMPLOYEE_RATE);

  // Dividend tax: ~37.84% effective on distributed dividends
  const dividends = input.dividendsPaid ?? 0;
  const dividendTax = Math.round(dividends * DIVIDEND_UPLIFT_FACTOR * ORDINARY_INCOME_TAX_RATE);

  const vatOwed = Math.round((input.vatCollected ?? 0) - (input.vatPaid ?? 0));

  const totalTaxLiability = corporateTax + ordinaryIncomeTax + bracketTax + ownerNI + dividendTax + employerNI;

  return {
    grossIncome: input.grossIncome,
    totalExpenses: input.totalExpenses,
    netProfit,
    corporateTax,
    corporateTaxRate: taxRate,
    ordinaryIncomeTax,
    bracketTax,
    bracketTaxDetails,
    nationalInsurance: ownerNI,
    personalAllowance: PERSONAL_ALLOWANCE,
    minimumDeduction: minDeduction,
    employerNI,
    totalEmployerCosts: input.totalSalariesPaid + employerNI,
    dividendTax,
    vatOwed,
    vatCollected: input.vatCollected ?? 0,
    vatPaid: input.vatPaid ?? 0,
    totalTaxLiability,
    effectiveTaxRate: input.grossIncome > 0 ? totalTaxLiability / input.grossIncome : 0,
    orgType: 'AS',
    period: input.period,
    disclaimer: 'Estimat basert på 2026-regler. Ikke skatterådgivning. Kontakt Skatteetaten for endelige tall.',
  };
}

/**
 * Calculate ANS/DA (Partnership) tax — pass-through to partners
 */
function calculatePartnership(input: TaxCalculationInput, orgType: 'ANS' | 'DA'): TaxBreakdown {
  const netProfit = input.grossIncome - input.totalExpenses - input.totalSalariesPaid;
  const employerNI = calculateEmployerNI(input.totalSalariesPaid);
  const partners = input.partnerShares ?? 1;

  // Each partner's share of profit
  const perPartnerProfit = Math.max(0, netProfit / partners);

  // Per-partner tax (same as ENK personal tax)
  const taxableOrdinary = Math.max(0, perPartnerProfit - PERSONAL_ALLOWANCE);
  const perPartnerOrdinary = Math.round(taxableOrdinary * ORDINARY_INCOME_TAX_RATE);
  const { total: perPartnerBracket, details: bracketTaxDetails } = calculateBracketTax(perPartnerProfit);
  const perPartnerNI = Math.round(perPartnerProfit * NI_SELF_EMPLOYED_RATE);

  // Scale to total (all partners combined)
  const ordinaryIncomeTax = perPartnerOrdinary * partners;
  const bracketTax = perPartnerBracket * partners;
  const nationalInsurance = perPartnerNI * partners;

  const vatOwed = Math.round((input.vatCollected ?? 0) - (input.vatPaid ?? 0));
  const totalTaxLiability = ordinaryIncomeTax + bracketTax + nationalInsurance + employerNI;

  return {
    grossIncome: input.grossIncome,
    totalExpenses: input.totalExpenses,
    netProfit,
    corporateTax: 0,
    corporateTaxRate: 0,
    ordinaryIncomeTax,
    bracketTax,
    bracketTaxDetails: bracketTaxDetails.map(d => ({ ...d, bracket: `Per partner: ${d.bracket}` })),
    nationalInsurance,
    personalAllowance: PERSONAL_ALLOWANCE * partners,
    minimumDeduction: 0,
    employerNI,
    totalEmployerCosts: input.totalSalariesPaid + employerNI,
    dividendTax: 0,
    vatOwed,
    vatCollected: input.vatCollected ?? 0,
    vatPaid: input.vatPaid ?? 0,
    totalTaxLiability,
    effectiveTaxRate: input.grossIncome > 0 ? totalTaxLiability / input.grossIncome : 0,
    orgType,
    period: input.period,
    disclaimer: `Estimat for ${partners} partner(e). Basert på 2026-regler. Ikke skatterådgivning.`,
  };
}

/**
 * Calculate SA (Cooperative) tax
 */
function calculateSA(input: TaxCalculationInput): TaxBreakdown {
  const allocations = input.memberAllocations ?? 0;
  const taxableProfit = input.grossIncome - input.totalExpenses - input.totalSalariesPaid - allocations;
  const employerNI = calculateEmployerNI(input.totalSalariesPaid);

  const corporateTax = Math.round(Math.max(0, taxableProfit) * CORPORATE_TAX_RATE);
  const vatOwed = Math.round((input.vatCollected ?? 0) - (input.vatPaid ?? 0));
  const totalTaxLiability = corporateTax + employerNI;

  return {
    grossIncome: input.grossIncome,
    totalExpenses: input.totalExpenses + allocations,
    netProfit: taxableProfit,
    corporateTax,
    corporateTaxRate: CORPORATE_TAX_RATE,
    ordinaryIncomeTax: 0,
    bracketTax: 0,
    bracketTaxDetails: [],
    nationalInsurance: 0,
    personalAllowance: 0,
    minimumDeduction: 0,
    employerNI,
    totalEmployerCosts: input.totalSalariesPaid + employerNI,
    dividendTax: 0,
    vatOwed,
    vatCollected: input.vatCollected ?? 0,
    vatPaid: input.vatPaid ?? 0,
    totalTaxLiability,
    effectiveTaxRate: input.grossIncome > 0 ? totalTaxLiability / input.grossIncome : 0,
    orgType: 'SA',
    period: input.period,
    disclaimer: 'Estimat med fradrag for medlemsallokeringer. Basert på 2026-regler.',
  };
}

/**
 * Calculate FORENING (Association) tax
 */
function calculateForening(input: TaxCalculationInput): TaxBreakdown {
  // Only business income is taxable — membership fees etc. are exempt
  // We assume all grossIncome here is business income (user can separate)
  const netProfit = input.grossIncome - input.totalExpenses - input.totalSalariesPaid;
  const employerNI = calculateEmployerNI(input.totalSalariesPaid);

  const corporateTax = Math.round(Math.max(0, netProfit) * CORPORATE_TAX_RATE);
  const vatOwed = Math.round((input.vatCollected ?? 0) - (input.vatPaid ?? 0));
  const totalTaxLiability = corporateTax + employerNI;

  return {
    grossIncome: input.grossIncome,
    totalExpenses: input.totalExpenses,
    netProfit,
    corporateTax,
    corporateTaxRate: CORPORATE_TAX_RATE,
    ordinaryIncomeTax: 0,
    bracketTax: 0,
    bracketTaxDetails: [],
    nationalInsurance: 0,
    personalAllowance: 0,
    minimumDeduction: 0,
    employerNI,
    totalEmployerCosts: input.totalSalariesPaid + employerNI,
    dividendTax: 0,
    vatOwed,
    vatCollected: input.vatCollected ?? 0,
    vatPaid: input.vatPaid ?? 0,
    totalTaxLiability,
    effectiveTaxRate: input.grossIncome > 0 ? totalTaxLiability / input.grossIncome : 0,
    orgType: 'FORENING',
    period: input.period,
    disclaimer: 'Foreninger er ofte skattefrie. Kun næringsinntekt beskattes. Basert på 2026-regler.',
  };
}

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Calculate Norwegian tax for any company type
 */
export function calculateTax(input: TaxCalculationInput): TaxBreakdown {
  switch (input.orgType) {
    case 'ENK':
      return calculateENK(input);
    case 'AS':
      return calculateAS(input);
    case 'ANS':
      return calculatePartnership(input, 'ANS');
    case 'DA':
      return calculatePartnership(input, 'DA');
    case 'SA':
      return calculateSA(input);
    case 'FORENING':
      return calculateForening(input);
    case 'NUF':
      // NUF managed in Norway → same as AS
      return { ...calculateAS(input), orgType: 'NUF' };
    case 'OTHER':
    default:
      // Default to AS-like treatment
      return { ...calculateAS(input), orgType: input.orgType };
  }
}

/**
 * Calculate VAT for a single transaction
 */
export function calculateVAT(
  amount: number,
  vatRate: keyof typeof VAT_RATES = 'STANDARD',
  inclusive: boolean = false
): { netAmount: number; vatAmount: number; grossAmount: number; rate: number } {
  const rate = VAT_RATES[vatRate];

  if (inclusive) {
    const netAmount = Math.round((amount / (1 + rate)) * 100) / 100;
    return {
      netAmount,
      vatAmount: Math.round((amount - netAmount) * 100) / 100,
      grossAmount: amount,
      rate,
    };
  }

  const vatAmount = Math.round(amount * rate * 100) / 100;
  return {
    netAmount: amount,
    vatAmount,
    grossAmount: Math.round((amount + vatAmount) * 100) / 100,
    rate,
  };
}

/**
 * Estimate how much an employee costs the employer (total cost)
 */
export function calculateEmployeeCost(grossSalary: number): {
  grossSalary: number;
  employerNI: number;
  totalCost: number;
  estimatedEmployeeTax: number;
  estimatedNetSalary: number;
} {
  const employerNI = Math.round(grossSalary * EMPLOYER_NI_RATE);
  const minDeduction = calculateMinimumDeduction(grossSalary);
  const taxableIncome = Math.max(0, grossSalary - minDeduction - PERSONAL_ALLOWANCE);
  const incomeTax = Math.round(taxableIncome * ORDINARY_INCOME_TAX_RATE);
  const { total: bracketTax } = calculateBracketTax(grossSalary);
  const employeeNI = Math.round(grossSalary * NI_EMPLOYEE_RATE);
  const totalEmployeeTax = incomeTax + bracketTax + employeeNI;

  return {
    grossSalary,
    employerNI,
    totalCost: grossSalary + employerNI,
    estimatedEmployeeTax: totalEmployeeTax,
    estimatedNetSalary: grossSalary - totalEmployeeTax,
  };
}

/**
 * Get tax profile info for display
 */
export function getTaxProfile(orgType: CompanyOrgType) {
  return TAX_PROFILES[orgType] ?? TAX_PROFILES.OTHER;
}
