'use server';

import { dbPrisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/browser';
import { auth } from '@/auth';
import { isDemoUserId } from '@/lib/demo-policy';

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
      const session = await auth();
      if (!session?.user?.id || session.user.id !== clientUser?.id || isDemoUserId(session.user.id)) {
        return { success: false, error: 'Not authorized', permissions: null };
      }
      if (!companyId) {
        return { success: false, error: 'Missing company ID', permissions: null };
      }

      const employee = await dbPrisma.employee.findFirst({
        where: {
            userId: session.user.id,
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
