'use server';

import { dbPrisma } from '@/lib/db';
import { ExtendedUser } from '@/next-auth';

export async function fetchUserEmployeePermissions(clientUser: any, companyId: string) {
    try {
      console.log('fetchUserEmployeePermissions() Fetching user permissions for user employee:', clientUser.id, 'for companyId: ', companyId);
      // validate client user
      if (!clientUser || !clientUser.id) { 
        console.error('Permission denied: Missing client ID');
        return new Response(JSON.stringify({ message: 'Permission denied: Missing client ID' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
      }
      const employee = await dbPrisma.employee.findFirst({
        where: {
            userId: clientUser.id,
            companyId: companyId,
        },
      });
      
      if (!employee) {
        throw new Error('employee Permissions not found.');
      }
      console.log('todo: remove me:', employee)
      console.log(`Permissions SUCCESS fetched for employee ${clientUser.name}:`, employee.id);
      return employee.permissions;
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      throw error;
    }
}