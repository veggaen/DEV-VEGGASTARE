export { calculateTax, calculateVAT, calculateEmployeeCost, calculateBracketTax, getTaxProfile } from './calculator';
export type { TaxCalculationInput, TaxBreakdown } from './calculator';
export {
  CORPORATE_TAX_RATE,
  VAT_RATES,
  VAT_REGISTRATION_THRESHOLD,
  EMPLOYER_NI_RATE,
  NI_SELF_EMPLOYED_RATE,
  NI_EMPLOYEE_RATE,
  TAX_PROFILES,
  TAX_DEADLINES,
  TAX_SOURCES,
  TAX_YEAR,
  BRACKET_TAX_2025,
  BRACKET_TAX_2026,
  PERSONAL_ALLOWANCE,
  MINIMUM_DEDUCTION_RATE,
  MINIMUM_DEDUCTION_MAX,
  DIVIDEND_UPLIFT_FACTOR,
  DIVIDEND_EFFECTIVE_RATE,
  type CompanyOrgType,
  type TaxEntityType,
} from './constants';
