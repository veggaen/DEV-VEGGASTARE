import { settlementStore } from '@/lib/payments/settlement-runtime';
import { CreditIntentRequest } from '@/lib/payments/settlement-input';
import { readSettlementJson, settlementEditor, settlementErrorResponse, settlementJson } from '@/lib/payments/settlement-request';

export async function PATCH(request: Request) {
  try {
    const user = await settlementEditor(request);
    const { itemId, expectedUpdatedAt, intent } = CreditIntentRequest.parse(await readSettlementJson(request, 2048));
    return settlementJson(await settlementStore().saveCreditIntent(user!.id!, itemId, expectedUpdatedAt, intent));
  } catch (error) { return settlementErrorResponse(error); }
}
