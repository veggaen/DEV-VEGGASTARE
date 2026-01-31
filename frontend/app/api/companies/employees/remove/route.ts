import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CompanyEmployeeRemoveResponseSchema } from '@/lib/types/company';

const isDev = process.env.NODE_ENV !== 'production';

const removeEmployeeSchema = z.object({
  userId: z.string().trim().min(1).max(200),
  companyId: z.string().trim().min(1).max(200),
  // legacy payload some clients send; ignored
  clientUser: z.any().optional(),
});

export async function DELETE(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const bodyResult = await parseJsonOrError(req, removeEmployeeSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { userId, companyId } = bodyResult.data;

  try {
    const employee = await dbPrisma.employee.findFirst({
      where: {
        userId: session.id,
        companyId,
      },
    });
    const employeeWithPermissions = employee as { permissions?: { CAN_REMOVE_EMPLOYEE?: boolean } };

    if (!employeeWithPermissions?.permissions?.CAN_REMOVE_EMPLOYEE) {
      return NextResponse.json(
        { message: 'Permission denied: You do not have permission to remove employees' },
        { status: 403 }
      );
    }

    const existingEmployee = await dbPrisma.employee.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (!existingEmployee) {
      return NextResponse.json({ message: 'Employee not found in the specified company' }, { status: 404 });
    }

    await dbPrisma.employee.delete({
      where: { id: existingEmployee.id },
    });

    const dto = { message: `Successfully removed employee ${userId} from company ${companyId}` };
    const parsed = CompanyEmployeeRemoveResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[api/companies/employees/remove] Invalid DELETE DTO:', parsed.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error('Failed to remove employee:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}

