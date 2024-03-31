import { dbPrisma } from '@/lib/db';
import { PrismaClient, Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

export async function POST(req: any, res: NextApiResponse) {
  
  try {
    // Assuming 'roleId' is a valid EmployeeRole enum value
      // and 'companyId' is the id of an existing company
      const { userId, companyId, role } = await req.json();
      console.log('Attempting to add employee with data: ',userId, companyId, role);

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