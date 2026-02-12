'use server';

import { dbPrisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/browser';

type PermissionsResult = { 
  success: true; 
  permissions: Prisma.JsonValue; 
  role: string;
} | { 
  success: false; 
  error: string; 
  permissions: null;
};

export async function fetchUserEmployeePermissions(clientUser: any, companyId: string): Promise<PermissionsResult> {
    try {
      // Validate inputs
      if (!clientUser?.id) { 
        return { success: false, error: 'Missing user ID', permissions: null };
      }
      if (!companyId) {
        return { success: false, error: 'Missing company ID', permissions: null };
      }

      const employee = await dbPrisma.employee.findFirst({
        where: {
            userId: clientUser.id,
            companyId: companyId,
        },
      });
      
      if (!employee) {
        // Not an employee of this company - this is valid, not an error
        return { success: false, error: 'Not an employee', permissions: null };
      }
      
      return { 
        success: true, 
        permissions: employee.permissions,
        role: employee.role,
      };
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return { success: false, error: 'Database error', permissions: null };
    }
}