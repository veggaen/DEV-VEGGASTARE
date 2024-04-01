import { NextApiRequest, NextApiResponse } from 'next';
import { dbPrisma } from '@/lib/db';

export async function PATCH(req: NextApiRequest, res: NextApiResponse) {
    try {
      const { employee, permissions } = req.body;
  
      if (!employee || !permissions) {
        return res.status(400).json({ error: 'Missing employeeId or permissions in request body' });
      }
  
      console.log(`Updating employee permissions. Employee ID: ${employee.id}, Permissions:`, permissions);
  
      // Update employee permissions in the database
      await dbPrisma.employee.update({
        where: { id: employee.id },
        data: {
          permissions: permissions, // Assuming permissions is already in the correct format
        },
      });
  
      return res.status(200).json({ message: 'Employee permissions updated successfully' });
    } catch (error) {
      console.error('Error updating employee permissions:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }