/** @fileOverview Legacy Ethereum alias shares validation, rate limits and cached data. @stability stable */
import { GET as getHistory } from '../crypto-price/route';

export async function GET(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set('crypto', 'ethereum');
  return getHistory(new Request(url, { headers: request.headers }));
}
