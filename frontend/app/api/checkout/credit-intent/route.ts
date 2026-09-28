import { settlementStore } from '@/lib/payments/settlement-runtime';
import { CreditIntent, CreditIntentRequest } from '@/lib/payments/settlement-input';
import { cartItemDto } from '@/lib/cart-credit-policy';
import { readSettlementJson, settlementEditor, settlementErrorResponse, settlementJson } from '@/lib/payments/settlement-request';

export async function PATCH(request: Request) {
  try {
    const user = await settlementEditor(request);
    const { itemId, expectedUpdatedAt, intent } = CreditIntentRequest.parse(await readSettlementJson(request, 2048));
    return settlementJson(cartItemDto(await settlementStore().saveCreditIntent(user!.id!, itemId, expectedUpdatedAt, intent)));
  } catch (error) { return settlementErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await settlementEditor(request);
    const intent = CreditIntent.parse(await readSettlementJson(request, 2048));
    return settlementJson(cartItemDto(await settlementStore().addCreditIntent(user!.id!, intent)));
  } catch (error) { return settlementErrorResponse(error); }
}
