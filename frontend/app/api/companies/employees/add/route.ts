import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextRequest, NextResponse } from 'next/server';
import { EmployeeRole } from '@prisma/client';
import { z } from 'zod';
import { CompanyEmployeeResponseSchema } from '@/lib/types/company';

const isDev = process.env.NODE_ENV !== 'production';
const LOG_PREFIX = '[frontend/app/api/companies/employees/add/route.ts]';

const addEmployeeSchema = z.object({
  userId: z.string().trim().min(1).max(200),
  companyId: z.string().trim().min(1).max(200),
  role: z.nativeEnum(EmployeeRole),
  jobTitle: z.string().trim().min(1).max(80).optional(),
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

  const { userId, companyId, role, jobTitle } = bodyResult.data;

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
        jobTitle: jobTitle || null,
        permissions: {},
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    const toRecordOrUndefined = (val: unknown): Record<string, unknown> | undefined => {
      if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined;
      return val as Record<string, unknown>;
    };

    const dto = {
      id: String(newEmployee.id),
      userId: String(newEmployee.userId),
      role: newEmployee.role,
      jobTitle: newEmployee.jobTitle ?? null,
      createdAt:
        newEmployee.createdAt instanceof Date
          ? newEmployee.createdAt.toISOString()
          : String(newEmployee.createdAt),
      updatedAt:
        (newEmployee as any).updatedAt instanceof Date
          ? (newEmployee as any).updatedAt.toISOString()
          : String((newEmployee as any).updatedAt ?? newEmployee.createdAt),
      user: {
        id: String((newEmployee as any).User?.id ?? newEmployee.userId),
        name: (newEmployee as any).User?.name ?? null,
        email: (newEmployee as any).User?.email ?? null,
        image: (newEmployee as any).User?.image ?? null,
      },
      permissions: toRecordOrUndefined(newEmployee.permissions) ?? {},
    };

    const parsed = CompanyEmployeeResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid POST DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error('Failed to add employee:', error);
    return NextResponse.json(
      { error: 'Failed to add employee', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}