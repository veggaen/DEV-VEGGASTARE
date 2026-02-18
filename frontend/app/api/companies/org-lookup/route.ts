import { NextRequest, NextResponse } from 'next/server';
import { lookupNorwegianOrganization } from '@/lib/norway-org';

export async function GET(req: NextRequest) {
  const orgNumber = req.nextUrl.searchParams.get('orgNumber') || '';
  const result = await lookupNorwegianOrganization(orgNumber);

  if (!result.found) {
    return NextResponse.json(result, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
