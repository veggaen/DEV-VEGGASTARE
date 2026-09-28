/** @fileOverview Email links open a review screen; GET never changes account links. @stability stable */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const url = new URL('/settings?section=verification', req.url);
  if (token && /^[a-zA-Z0-9-]{20,100}$/.test(token)) {
    url.searchParams.set('oauthToken', token);
    url.searchParams.set('oauthIntent', req.nextUrl.searchParams.get('deny') === '1' ? 'deny' : 'confirm');
  } else url.searchParams.set('oauthConfirm', 'invalid');
  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
