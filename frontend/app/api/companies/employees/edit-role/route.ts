'use server'

import { NextApiRequest, NextApiResponse } from 'next';
import { dbPrisma } from '@/lib/db';

export async function POST(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { employeeId, newRole } = req.body;
    console.log('[frontend/app/api/companies/employees/edit-role/route.ts]: employeeId:', employeeId, 'newRole:', newRole);

    if (!employeeId || !newRole) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const updatedEmployee = await dbPrisma.employee.update({
      where: { id: employeeId },
      data: { role: newRole },
    });

    return res.status(200).json(updatedEmployee);
  } catch (error) {
    console.error('Error updating employee role:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}