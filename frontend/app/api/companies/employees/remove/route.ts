import { dbPrisma } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';


// Note: Adjust this function signature if you're using `Request` from the Web API instead
export async function DELETE(req: any, res: NextApiResponse) {
    console.log("Received DELETE request"); // Additional log
    const { userId, companyId, clientUser } = await req.json()
    console.log(`${clientUser.name} Attempting to remove employee with ID: ${userId} from company ID: ${companyId}`)
    
    try {
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
            companyId,
        },
      });
      const employeeWithPermissions = employee as { permissions?: { CAN_REMOVE_EMPLOYEE?: boolean } };

      if (!employeeWithPermissions || !employeeWithPermissions.permissions?.CAN_REMOVE_EMPLOYEE) {
        console.error('Permission denied: You do not have permission to remove employees');
        return new Response(JSON.stringify({ message: 'Permission denied: You do not have permission to remove employees' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
      }
      
      // Optional: Validate that the employee belongs to the company
      const existingEmployee = await dbPrisma.employee.findFirst({
        where: {
            userId: userId,
            company: { id: companyId }, // Assuming you have relations set up
        },
      });

      console.log(`Employee found: ${JSON.stringify(existingEmployee)}`);
      if (!existingEmployee) {
        return res.status(404).json({ message: 'Employee not found in the specified company' });
      }
  
      await dbPrisma.employee.delete({
        where: { id: existingEmployee.id },
      });
  
      console.log(`Employee ${userId} removed from company ${companyId}`);

      return NextResponse.json({ message: `Successfully removed Employee ' ${userId} ' from company ' ${companyId}'` }, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error(`Failed to remove employee: ${error}`);
      return NextResponse.json({ message: 'Internal Server Error' }, {
        status: 400,
        headers: {
            'Content-Type': 'application/json',
        },
      })
    }
}

