import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextRequest, NextResponse } from 'next/server';
import { EmployeeRole } from '@prisma/client';
import { z } from 'zod';

const isDev = process.env.NODE_ENV !== 'production';

const addEmployeeSchema = z.object({
  userId: z.string().trim().min(1).max(200),
  companyId: z.string().trim().min(1).max(200),
  role: z.nativeEnum(EmployeeRole),
  // legacy payload some clients send; ignored
  clientUser: z.any().optional(),
});

export async function POST(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const bodyResult = await parseJsonOrError(req, addEmployeeSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { userId, companyId, role } = bodyResult.data;

  try {
    const employee = await dbPrisma.employee.findFirst({
      where: {
        userId: session.id,
        companyId,
      },
    });

    const employeeWithPermissions = employee as { permissions?: { CAN_ADD_EMPLOYEE?: boolean } };
    if (!employeeWithPermissions?.permissions?.CAN_ADD_EMPLOYEE) {
      return NextResponse.json(
        { message: 'Permission denied: You do not have permission to add employees' },
        { status: 403 }
      );
    }

    const existingEmployee = await dbPrisma.employee.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (existingEmployee) {
      return NextResponse.json(
        { message: 'User is already added to the company employee list.' },
        { status: 400 }
      );
    }

    const newEmployee = await dbPrisma.employee.create({
      data: {
        userId,
        companyId,
        role,
        permissions: {},
      },
    });

    return NextResponse.json(newEmployee, { status: 200 });
  } catch (error) {
    console.error('Failed to add employee:', error);
    return NextResponse.json(
      { error: 'Failed to add employee', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}