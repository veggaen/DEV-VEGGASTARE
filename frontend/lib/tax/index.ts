export { calculateTax, calculateVAT, calculateEmployeeCost, calculateBracketTax, getTaxProfile } from './calculator';
export type { TaxCalculationInput, TaxBreakdown } from './calculator';
export {
  CORPORATE_TAX_RATE,
  VAT_RATES,
  VAT_REGISTRATION_THRESHOLD,
  EMPLOYER_NI_RATE,
  NI_SELF_EMPLOYED_RATE,
  TAX_PROFILES,
  TAX_DEADLINES,
  BRACKET_TAX_2026,
  type CompanyOrgType,
} from './constants';
