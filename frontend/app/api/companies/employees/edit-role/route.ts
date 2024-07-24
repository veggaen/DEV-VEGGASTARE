import { NextApiRequest, NextApiResponse } from 'next';
import { editEmployeeRoleAction } from '@/actions/edit-employee-role';

const LOG_PREFIX = '[frontend/app/api/companies/employees/edit-role/route.ts]';

export async function POST(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { employeeId, newRole, clientUser, companyId } = req.body;
    console.log(`${LOG_PREFIX} Request received to edit role. Employee ID: ${employeeId}, New Role: ${newRole}, Company ID: ${companyId}, Client User: ${clientUser?.id}`);

    if (!employeeId || !newRole || !clientUser || !companyId) {
      console.error(`${LOG_PREFIX} Missing required fields`);
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const response = await editEmployeeRoleAction({ employeeId, newRole, clientUser, companyId });

    if (response.success) {
      console.log(`${LOG_PREFIX} Employee role updated successfully:`, response.updatedEmployee);
      return res.status(200).json(response.updatedEmployee);
    } else {
      console.error(`${LOG_PREFIX} Failed to update employee role:`, response.message);
      return res.status(403).json({ message: response.message });
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating employee role:`, error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}