/** Server configuration only. The browser cannot provide rates, margin policy or signing keys. */
import 'server-only';
import { dbPrisma } from '@/lib/db';
import { FUNDED_AI_MODELS, AI_PRICING_REVIEW_BY } from '@/lib/ai-chat/credit-policy';
import { MEDIA_MODELS, MEDIA_POLICY_REVIEW_BY } from '@/lib/ai-media/policy';
import { createSettlementStore } from './settlement-store';
import { readSettlementFx } from './settlement-fx';
import { quoteSettlementCart, SettlementSelection } from './settlement-quote';
import { paypalEnvironment } from './showcase-policy';
import { paypalConfigured } from './showcase-paypal';

const models = [...FUNDED_AI_MODELS, ...Object.values(MEDIA_MODELS)];
const modelCostReviewBy = new Date(Math.min(Date.parse(AI_PRICING_REVIEW_BY), Date.parse(MEDIA_POLICY_REVIEW_BY))).toISOString();

export function settlementStore() {
  return createSettlementStore(dbPrisma, { environment: paypalEnvironment().mode,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '',
    models, modelCostReviewBy, readFx: readSettlementFx, paypalConfigured });
}

/** Public price preview only: no attestation, order, cart mutation or provider call. */
export async function estimateSettlement(input: unknown) {
  const selection = SettlementSelection.parse(input);
  const fx = await readSettlementFx(selection.currency);
  return quoteSettlementCart(selection, { fx, now: Date.now(), models, modelCostReviewBy });
}
