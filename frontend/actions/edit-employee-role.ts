'use server';

import { dbPrisma } from '@/lib/db';
import { EmployeeRole } from '@prisma/client';
import { MyLibUserAuth } from '@/lib/user-auth';
import { z } from 'zod';

const LOG_PREFIX = '[frontend/actions/edit-employee-role.ts]';

const inputSchema = z.object({
  employeeId: z.string().min(1),
  newRole: z.nativeEnum(EmployeeRole),
  companyId: z.string().min(1),
});

interface EditEmployeeRoleResponse {
  success: boolean;
  message?: string;
  updatedEmployee?: any;
}

export const editEmployeeRoleAction = async (formData: unknown): Promise<EditEmployeeRoleResponse> => {
  const parsed = inputSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Invalid request' };
  }

  const { employeeId, newRole, companyId } = parsed.data;

  const sessionUser = await MyLibUserAuth();
  if (!sessionUser?.id) {
    return { success: false, message: 'Unauthorized' };
  }

  console.log(`${LOG_PREFIX} ${sessionUser.name ?? sessionUser.id} is initiating request to edit employee role [Employee ID: ${employeeId}, New Role: ${newRole}, Company ID: ${companyId}]`);

  try {
    // Fetch client employee data for permission check
    const clientEmployee = await dbPrisma.employee.findFirst({
      where: {
        userId: sessionUser.id,
        companyId: companyId,
      },
    });

    if (!clientEmployee) {
      console.error(`${LOG_PREFIX} Client user is not an employee of the company`);
      return { success: false, message: 'Client user is not an employee of the company' };
    }

    // Check if client user has permission to edit employee roles
    const permissions = clientEmployee.permissions as { [key: string]: boolean };
    if (!permissions.CAN_EDIT_EMPLOYEE_ROLE) {
      console.error(`${LOG_PREFIX} Permission denied: You do not have permission to edit employee roles.`);
      return { success: false, message: 'Permission denied: You do not have permission to edit employee roles' };
    }

    // Fetch the employee to be updated
    const targetEmployee = await dbPrisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId: companyId,
      },
    });

    if (!targetEmployee) {
      console.error(`${LOG_PREFIX} Employee not found or does not belong to the specified company`);
      return { success: false, message: 'Employee not found or does not belong to the specified company' };
    }

    // Check role hierarchy
    const roleHierarchy = ['USER', 'STAFF', 'MANAGER', 'OWNER'];
    if (roleHierarchy.indexOf(clientEmployee.role) <= roleHierarchy.indexOf(targetEmployee.role)) {
      console.error(`${LOG_PREFIX} Permission denied: You do not have a higher role than the employee you are trying to update`);
      return { success: false, message: 'Permission denied: You do not have a higher role than the employee you are trying to update' };
    }

    // Update employee role
    const updatedEmployee = await dbPrisma.employee.update({
      where: { id: employeeId },
      data: { role: newRole },
    });

    console.log(`${LOG_PREFIX} Successfully updated employee role:`, updatedEmployee);
    return { success: true, updatedEmployee };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating employee role:`, error);
    return { success: false, message: 'Internal Server Error' };
  }
};