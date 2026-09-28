/** @fileOverview Public version-pinned buyer-copy download; never changes an order. @stability stable */
import { SALES_TERMS_TEXT } from '@/lib/legal/sales-terms';
import { SALES_TERMS_VERSION } from '@/lib/legal/sales-terms-version';

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // Never return newer wording under a stale version's download link.
  if (params.getAll('version').length !== 1 || params.get('version') !== SALES_TERMS_VERSION || [...params.keys()].some(key => key !== 'version')) {
    return Response.json({ error: 'TERMS_VERSION_UNAVAILABLE', message: 'Open /terms for the current public copy. Your original order confirmation retains its own terms.' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(SALES_TERMS_TEXT, { headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="veggat-sales-terms-${SALES_TERMS_VERSION}.txt"`,
    'Content-Language': 'nb',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
  } });
}
