import { dbPrisma } from '@/lib/db';
import { PrismaClient, Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

export async function POST(req: any, res: NextApiResponse) {
  
  try {
    // Assuming 'roleId' is a valid EmployeeRole enum value
      // and 'companyId' is the id of an existing company
      const { userId, companyId, role, clientUser } = await req.json();
      console.log('Attempting to add employee with data: ',userId, companyId, role, clientUser.name);

      if (!clientUser || !clientUser.id) {
        //return res.status(403).json({ error: 'Permission denied: Missing client ID' });
        return new Response(JSON.stringify({ message: 'Permission denied: Missing session user ID' }), {
          status: 400, // 400 Bad Request or 409 Conflict could be appropriate here
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
       // Query the database to find the employee associated with the clientUser and companyId
      const employee = await dbPrisma.employee.findFirst({
        where: {
          userId: clientUser.id,
          companyId,
        },
      });
    
      // Check if the employee exists and has the permission to add employees
      const employeeWithPermissions = employee as { permissions?: { CAN_ADD_EMPLOYEE?: boolean } };

      if (!employeeWithPermissions || !employeeWithPermissions.permissions?.CAN_ADD_EMPLOYEE) {
        //return res.status(403).json({ error: 'Permission denied: You do not have permission to add employees' });
        return new Response(JSON.stringify({ message: 'Permission denied: You do not have permission to add employees' }), {
          status: 400, // 400 Bad Request or 409 Conflict could be appropriate here
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
      // Check if an employee with the given userId and companyId already exists
      const existingEmployee = await dbPrisma.employee.findFirst({
        where: {
          userId,
          companyId,
        },
      });

      if (existingEmployee) {
        // Employee already exists, return an error response
        console.log(`Employee with userId: ${userId} already exists in companyId: ${companyId}`);
        return new Response(JSON.stringify({ message: 'User is already added to the company employee list.' }), {
          status: 400, // 400 Bad Request or 409 Conflict could be appropriate here
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Create a new employee record in the database
      const newEmployee = await dbPrisma.employee.create({
        data: {
          userId,
          companyId,
          role,
          // Assuming 'permissions' is an optional field
          permissions: {}, 
        },
      });
      console.log('clientEmployee:', employee, 'added new employee:', newEmployee)
      // Return a successful response with the created employee data
      return new Response(JSON.stringify(newEmployee), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
    console.error('Failed to add employee:', error);
    // Respond with an error status and message
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
          'Content-Type': 'application/json',
      },
    });
  }
}