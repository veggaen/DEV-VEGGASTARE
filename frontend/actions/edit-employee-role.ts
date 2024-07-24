'use server';

import { dbPrisma } from '@/lib/db';

const LOG_PREFIX = '[frontend/actions/edit-employee-role.ts]';

export const editEmployeeRoleAction = async ({ employeeId, newRole, clientUser }: { employeeId: string; newRole: string; clientUser: any }) => {
  console.log(`${LOG_PREFIX} ${clientUser.name} is initiating request to edit role for employee [Employee ID: ${employeeId}]`);

  try {
    if (!clientUser) {
      console.error('Error updating employee role, no session user found.');
      return { success: false, message: 'No session user found' };
    }

    const updatedEmployee = await dbPrisma.employee.update({
      where: { id: employeeId },
      data: { role: newRole },
    });

    console.log(`${LOG_PREFIX} Employee role successfully updated.`);
    return { success: true, updatedEmployee };
  } catch (error) {
    console.error(`${LOG_PREFIX} Exception caught during role update operation: ${error}`);
    return { success: false, error: `An exception occurred: ${error}. Please try again or contact support.` };
  }
};