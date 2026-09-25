/**
 * @fileOverview Retired automatic wallet-metadata writer. Stale clients must
 * not associate social identities with wallet records without verification.
 * @stability stable
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Automatic wallet metadata updates are no longer supported. Refresh the page.' },
    { status: 410, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
