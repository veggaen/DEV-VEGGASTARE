import { z } from 'zod';
import { isPurchasableCreditAmount } from '@/lib/ai-credit-purchase';
import { SettlementCurrency } from './settlement-money';

export const CreditIntent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('spend'), currency: SettlementCurrency, amount: z.string().max(32) }).strict(),
  z.object({ type: z.literal('credits'), currency: SettlementCurrency, credits: z.number().refine(isPurchasableCreditAmount) }).strict(),
]);
export type CreditIntent = z.infer<typeof CreditIntent>;
export const CreditIntentRequest = z.object({ itemId: z.string().min(1).max(128),
  expectedUpdatedAt: z.string().datetime(), intent: CreditIntent }).strict();
export const CartQuoteRequest = z.object({ currency: SettlementCurrency }).strict();
export const QuoteToken = z.string().min(1).max(16_384);
