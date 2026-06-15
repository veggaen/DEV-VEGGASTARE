import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';

/**
 * @fileOverview GET permissions for the authenticated user across their companies.
 * @stability stable
 */

export async function GET(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  try {
    // If companyId is provided, return permissions for that specific company
    if (companyId) {
      const employee = await dbPrisma.employee.findFirst({
        where: { userId: session.id, companyId },
        select: { id: true, role: true, permissions: true, companyId: true },
      });

      if (!employee) {
        return NextResponse.json({ error: 'Not an employee of this company' }, { status: 403 });
      }

      return NextResponse.json({
        employeeId: employee.id,
        companyId: employee.companyId,
        role: employee.role,
        permissions: employee.permissions,
      });
    }

    // Otherwise, return permissions for all companies the user belongs to
    const employees = await dbPrisma.employee.findMany({
      where: { userId: session.id },
      select: { id: true, role: true, permissions: true, companyId: true },
    });

    return NextResponse.json({
      companies: employees.map((e) => ({
        employeeId: e.id,
        companyId: e.companyId,
        role: e.role,
        permissions: e.permissions,
      })),
    });
  } catch (error) {
    console.error('[api/companies/employees/permissions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}