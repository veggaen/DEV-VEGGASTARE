import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { UserProductCreationAnalyticsResponseSchema } from '@/lib/types/analytics';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const limit = await checkRateLimit(getClientIdentifier(request, session.user.id), 'analytics');
  if (!limit.success) return rateLimitedResponse(limit);

  try {
    // Aggregate at the database: never materialize every product/user identifier.
    const [direct, company] = await Promise.all([
      dbPrisma.product.count({ where: { companyId: null } }),
      dbPrisma.product.count({ where: { companyId: { not: null } } }),
    ]);
    const dto = UserProductCreationAnalyticsResponseSchema.parse({ data: [
      { label: 'Independent seller products', count: direct },
      { label: 'Company products', count: company },
    ] });
    return NextResponse.json(dto);
  } catch {
    console.error('Product publishing mix query failed');
    return NextResponse.json({ error: 'Analytics temporarily unavailable' }, { status: 500 });
  }
}
