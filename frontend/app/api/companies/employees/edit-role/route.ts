import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EmployeeRole } from '@prisma/client';
import { parseJsonOrError } from '@/lib/api-validate';
import { editEmployeeRoleAction } from '@/actions/edit-employee-role';

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
      return NextResponse.json(response.updatedEmployee, { status: 200 });
    }

    const message = response.message ?? 'Forbidden';
    const status = message === 'Unauthorized' ? 401 : 403;
    return NextResponse.json({ message }, { status });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating employee role:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}