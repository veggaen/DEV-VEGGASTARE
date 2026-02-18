import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const deny = req.nextUrl.searchParams.get('deny') === '1';

  if (!token) {
    return NextResponse.redirect(new URL('/companies?orgVerification=invalid', req.url));
  }

  const verification = await dbPrisma.companyOrgVerification.findUnique({
    where: { token },
    include: { Company: { select: { id: true } } },
  });

  if (!verification) {
    return NextResponse.redirect(new URL('/companies?orgVerification=invalid', req.url));
  }

  if (verification.expires < new Date()) {
    await dbPrisma.companyOrgVerification.update({
      where: { id: verification.id },
      data: { status: 'EXPIRED' },
    });
    return NextResponse.redirect(new URL(`/companies/${verification.companyId}?orgVerification=expired`, req.url));
  }

  if (deny) {
    await dbPrisma.companyOrgVerification.update({
      where: { id: verification.id },
      data: { status: 'DENIED', deniedAt: new Date() },
    });
    return NextResponse.redirect(new URL(`/companies/${verification.companyId}?orgVerification=denied`, req.url));
  }

  await dbPrisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: verification.companyId },
      data: {
        orgNumber: verification.orgNumber,
        orgType: verification.orgType ?? undefined,
      },
    });

    await tx.companyOrgVerification.update({
      where: { id: verification.id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
  });

  return NextResponse.redirect(new URL(`/companies/${verification.companyId}?orgVerification=verified`, req.url));
}
