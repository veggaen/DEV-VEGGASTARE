import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EmployeeRole } from '@/generated/prisma/browser';
import { parseJsonOrError } from '@/lib/api-validate';
import { editEmployeeRoleAction } from '@/actions/edit-employee-role';
import { CompanyEmployeeResponseSchema } from '@/lib/types/company';

const LOG_PREFIX = '[frontend/app/api/companies/employees/edit-role/route.ts]';

export const dynamic = 'force-dynamic';

const postBodySchema = z.object({
  employeeId: z.string().min(1),
  newRole: z.nativeEnum(EmployeeRole),
  companyId: z.string().min(1),
});

export async function POST(req: Request) {
  const bodyResult = await parseJsonOrError(req, postBodySchema);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const response = await editEmployeeRoleAction(bodyResult.data);
    if (response.success) {
      console.log(`${LOG_PREFIX} Employee role updated successfully`);
      const updatedEmployee = response.updatedEmployee as any;

      const toRecordOrUndefined = (val: unknown): Record<string, unknown> | undefined => {
        if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined;
        return val as Record<string, unknown>;
      };

      const dto = {
        id: String(updatedEmployee.id),
        userId: String(updatedEmployee.userId),
        role: updatedEmployee.role,
        jobTitle: updatedEmployee.jobTitle ?? null,
        createdAt:
          updatedEmployee.createdAt instanceof Date
            ? updatedEmployee.createdAt.toISOString()
            : String(updatedEmployee.createdAt),
        updatedAt:
          updatedEmployee.updatedAt instanceof Date
            ? updatedEmployee.updatedAt.toISOString()
            : String(updatedEmployee.updatedAt ?? updatedEmployee.createdAt),
        user: {
          id: String(updatedEmployee?.User?.id ?? updatedEmployee.userId),
          name: updatedEmployee?.User?.name ?? null,
          email: updatedEmployee?.User?.email ?? null,
          image: updatedEmployee?.User?.image ?? null,
        },
        permissions: toRecordOrUndefined(updatedEmployee.permissions) ?? {},
      };

      const parsed = CompanyEmployeeResponseSchema.safeParse(dto);
      if (!parsed.success) {
        console.error(`${LOG_PREFIX} Invalid POST DTO:`, parsed.error);
        return NextResponse.json(
          {
            message: 'Internal Server Error',
            ...(process.env.NODE_ENV !== 'production' ? { issues: parsed.error.issues } : {}),
          },
          { status: 500 }
        );
      }

      return NextResponse.json(parsed.data, { status: 200 });
    }

    const message = response.message ?? 'Forbidden';
    const status = message === 'Unauthorized' ? 401 : 403;
    return NextResponse.json({ message }, { status });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating employee role:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}