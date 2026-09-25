/** @fileOverview Server-only membership scope for internal company reads. @stability stable */
import type { Prisma } from '@/generated/prisma/browser';
import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';

export async function companyReadViewer() {
  const session = await MyLibUserAuth();
  if (!session?.id) return null;
  // Do not retain administrator access from an old session after demotion.
  const user = await dbPrisma.user.findUnique({ where: { id: session.id }, select: { role: true } });
  return user ? { id: session.id, role: user.role } : null;
}

export function companyReadScope(viewer: { id: string; role: string }): Prisma.CompanyWhereInput {
  if (viewer.role === 'ADMIN' || viewer.role === 'OWNER') return {};
  // Being the original founder is historical metadata, not perpetual access
  // after ownership transfer or removal from the current staff roster.
  return { OR: [{ ownerId: viewer.id }, { Employee: { some: { userId: viewer.id } } }] };
}

export function companyPrivateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}
