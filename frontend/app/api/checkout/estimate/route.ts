import { estimateSettlement } from '@/lib/payments/settlement-runtime';
import { SettlementSelection } from '@/lib/payments/settlement-quote';
import { readSettlementJson, settlementEditor, settlementErrorResponse, settlementJson } from '@/lib/payments/settlement-request';

export async function POST(request: Request) {
  try {
    await settlementEditor(request, false);
    const selection = SettlementSelection.parse(await readSettlementJson(request, 2048));
    return settlementJson({ quote: await estimateSettlement(selection) });
  } catch (error) { return settlementErrorResponse(error); }
}
