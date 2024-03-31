import { dbPrisma } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

interface RemoveEmployeeRequest {
    userId: string;
    companyId: string;
  }

// Note: Adjust this function signature if you're using `Request` from the Web API instead
export async function DELETE(req: any, res: NextApiResponse) {
    console.log("Received DELETE request"); // Additional log
    const { userId, companyId } = await req.json()
    console.log(`Attempting to remove employee with ID: ${userId} from company ID: ${companyId}`)
    
    try {
      // Optional: Validate that the employee belongs to the company
      const employee = await dbPrisma.employee.findFirst({
        where: {
            userId: userId,
            company: { id: companyId }, // Assuming you have relations set up
        },
    });
      console.log(`Employee found: ${JSON.stringify(employee)}`);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found in the specified company' });
      }
  
      await dbPrisma.employee.delete({
        where: { id: employee.id },
      });
  
      console.log(`Employee ${userId} removed from company ${companyId}`);

      return NextResponse.json({ message: `Successfully removed Employee ' ${userId} ' from company ' ${companyId}'` }, { status: 200 });
    } catch (error) {
      console.error(`Failed to remove employee: ${error}`);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

