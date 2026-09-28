import { settlementStore } from '@/lib/payments/settlement-runtime';
import { CartQuoteRequest } from '@/lib/payments/settlement-input';
import { readSettlementJson, settlementEditor, settlementErrorResponse, settlementJson } from '@/lib/payments/settlement-request';

export async function POST(request: Request) {
  try {
    const user = await settlementEditor(request);
    const { currency } = CartQuoteRequest.parse(await readSettlementJson(request, 256));
    return settlementJson(await settlementStore().quoteCart(user!.id!, currency));
  } catch (error) { return settlementErrorResponse(error); }
}
