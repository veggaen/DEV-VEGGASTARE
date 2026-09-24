/** @fileOverview Display-budget to whole-credit selection; never a payment amount. @stability stable */
import { creditsWithinBudget } from './ai-credit-purchase';

export function budgetInNokOre(text: string, fiat: string, rates: Record<string, number>, stale: boolean) {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,9}(\.\d{0,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  // NOK is the settlement currency; it needs no reference FX rate.
  const selected = fiat === 'USD' ? 1 : rates[fiat];
  const nok = rates.NOK;
  if (fiat !== 'NOK' && (stale || !Number.isFinite(selected) || selected <= 0 || !Number.isFinite(nok) || nok <= 0)) return null;
  const ore = Math.floor(amount * (fiat === 'NOK' ? 1 : selected / nok) * 100 + 1e-7);
  return Number.isSafeInteger(ore) ? ore : null;
}

export function quoteCreditBudget(text: string, fiat: string, rates: Record<string, number>, stale: boolean) {
  const ore = budgetInNokOre(text, fiat, rates, stale);
  return ore === null ? null : creditsWithinBudget(ore);
}
