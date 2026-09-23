import { NextResponse } from 'next/server';
import { zodErrorResponse } from '@/lib/api-validate';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { historyQuerySchema, aggregatePriceHistory, filterPriceHistory } from '@/lib/analytics/crypto-history';
import { getCryptoHistory } from '@/lib/analytics/crypto-history-server';

export async function GET(request: Request) {
  const query = historyQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return zodErrorResponse(query.error);
  const limit = await checkRateLimit('price-history:' + getClientIdentifier(request), 'analytics');
  if (!limit.success) return rateLimitedResponse(limit);
  const { crypto, vs_currency, interval, days, fromDate, toDate } = query.data;
  try {
    const history = await getCryptoHistory(crypto, vs_currency);
    return NextResponse.json({ ...history,
      data: aggregatePriceHistory(filterPriceHistory(history.data, days, fromDate, toDate), interval),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    // Never relay provider response bodies, URLs or credential errors.
    return NextResponse.json({ error: 'Historical prices are temporarily unavailable. Try again later.' },
      { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
  }
}
