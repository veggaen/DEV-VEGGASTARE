/** @fileOverview Compatibility endpoint for guarded OAuth unlink. @stability stable */
import { NextRequest, NextResponse } from 'next/server';
import { unlinkOauthProvider } from '@/actions/oauth-links';

export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers }); }
  const result = await unlinkOauthProvider(body && typeof body === 'object' && 'provider' in body ? body.provider : null);
  return NextResponse.json(result.ok ? { success: true, provider: result.provider } : { error: result.error }, { status: result.ok ? 200 : 400, headers });
}
