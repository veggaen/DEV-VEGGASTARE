import { NextRequest, NextResponse } from 'next/server';
import { searchNorwegianOrganizationsByPrefix } from '@/lib/norway-org';

export async function GET(req: NextRequest) {
  const orgNumber = req.nextUrl.searchParams.get('orgNumber') || '';
  const limitRaw = req.nextUrl.searchParams.get('limit');
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 6;

  const suggestions = await searchNorwegianOrganizationsByPrefix(orgNumber, limit);
  return NextResponse.json({ suggestions }, { status: 200 });
}
