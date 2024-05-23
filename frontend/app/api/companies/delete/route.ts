import { EmployeePermissions } from '@/actions/edit-company-employee-permission';
import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(req: NextRequest) {
  try {
    const data = await req.json();
    const { companyId, userId } = data;

    if (!companyId || !userId) {
      return NextResponse.json({ error: 'Company ID and User ID are required' }, { status: 400 });
    }

    const company = await dbPrisma.company.findUnique({
      where: { id: companyId },
      include: {
        employees: true,
        warehouseLocations: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const userEmployee = company.employees.find(employee => employee.userId === userId);

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