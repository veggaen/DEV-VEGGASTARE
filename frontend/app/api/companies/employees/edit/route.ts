import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { z } from 'zod';
import { CompanyEmployeePermissionsPatchResponseSchema } from '@/lib/types/company';

const isDev = process.env.NODE_ENV !== 'production';

// Strict schema for employee permissions update
const updateEmployeePermissionsSchema = z.object({
  employee: z.object({
    id: z.string().min(1).max(200),
  }),
  permissions: z.object({
    CAN_ADD_EMPLOYEE: z.boolean(),
    CAN_REMOVE_EMPLOYEE: z.boolean(),
    CAN_EDIT_EMPLOYEE_ROLE: z.boolean(),
    CAN_EDIT_PERMISSION: z.boolean(),
    CAN_DELETE_COMPANY: z.boolean(),
    CAN_POST_PRODUCT_POSITION_PERMISSION: z.boolean(),
    CAN_EDIT_PRODUCT_POSITION_PERMISSION: z.boolean(),
  }),
});

export async function PATCH(req: NextRequest) {
    try {
      // Authentication check
      const session = await MyLibUserAuth();
      if (!session?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Validate request body with Zod
      const bodyResult = await parseJsonOrError(req, updateEmployeePermissionsSchema);
      if (!bodyResult.ok) return bodyResult.response;
      
      const { employee, permissions } = bodyResult.data;
  
      // Verify the employee exists and the user has permission to edit
      const existingEmployee = await dbPrisma.employee.findUnique({
        where: { id: employee.id },
        include: { Company: true },
      });

      if (!existingEmployee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      // Authorization: Check if user is admin/owner or has permission to edit employees in this company
      const userEmployee = await dbPrisma.employee.findFirst({
        where: {
          userId: session.id,
          companyId: existingEmployee.companyId,
        },
      });

      const isAdmin = session.role === 'ADMIN' || session.role === 'OWNER';
      const canEdit = isAdmin || (userEmployee?.permissions as any)?.CAN_EDIT_PERMISSION;

      if (!canEdit) {
        return NextResponse.json({ error: 'Forbidden - You cannot edit permissions for this employee' }, { status: 403 });
      }

      console.log(`Updating employee permissions. Employee ID: ${employee.id}, Permissions:`, permissions);
  
      // Update employee permissions in the database
      await dbPrisma.employee.update({
        where: { id: employee.id },
        data: {
          permissions: permissions,
        },
      });
  
      const dto = { message: 'Employee permissions updated successfully' };
      const parsed = CompanyEmployeePermissionsPatchResponseSchema.safeParse(dto);
      if (!parsed.success) {
        console.error('[api/companies/employees/edit] Invalid PATCH DTO:', parsed.error);
        return NextResponse.json(
          { error: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
          { status: 500 }
        );
      }

      return NextResponse.json(parsed.data, { status: 200 });
    } catch (error) {
      console.error('Error updating employee permissions:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }