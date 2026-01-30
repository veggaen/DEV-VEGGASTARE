import { EmployeePermissions } from '@/actions/edit-company-employee-permission';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const deleteCompanySchema = z.object({
  companyId: z.string().trim().min(1).max(200),
  // legacy: some callers send userId; ignore and use session user instead
  userId: z.string().trim().min(1).max(200).optional(),
});

export async function DELETE(req: NextRequest) {
  try {
    const session = await MyLibUserAuth();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyResult = await parseJsonOrError(req, deleteCompanySchema);
    if (!bodyResult.ok) return bodyResult.response;

    const { companyId } = bodyResult.data;
    const userId = session.id;

    const company = await dbPrisma.company.findUnique({
      where: { id: companyId },
      include: {
        Employee: true,
        WarehouseLocation: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const userEmployee = company.Employee.find(employee => employee.userId === userId);

    if (!userEmployee) {
      return NextResponse.json({ error: 'User is not an employee of this company' }, { status: 403 });
    }

    const userPermissions = (userEmployee.permissions as unknown) as EmployeePermissions;
    //const userPermissions = userEmployee.permissions as EmployeePermissions;

    if (!userPermissions.CAN_DELETE_COMPANY) {
      return NextResponse.json({ error: 'You do not have permission to delete this company' }, { status: 403 });
    }

    /* Check for ownerId and to allow only the owner to delete the company
    TODO: fix permissions requirements? add more?
    if (company.ownerId !== userId) {
      return NextResponse.json({ error: 'You do not have permission to delete this company' }, { status: 403 });
    }
    */

    await dbPrisma.$transaction(async (transaction) => {
      await transaction.warehouseLocation.deleteMany({
        where: { companyId },
      });

      await transaction.employee.deleteMany({
        where: { companyId },
      });

      await transaction.company.delete({
        where: { id: companyId },
      });
    });

    return NextResponse.json({ success: 'Company deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to delete company:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}