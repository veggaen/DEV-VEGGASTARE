'use server';
import { runTeamMutation, teamFailure } from '@/lib/company-team';
export async function editEmployeeRoleAction(input: unknown) {
  try {
    const updatedEmployee = await runTeamMutation({ ...(input && typeof input === 'object' ? input : {}), kind: 'role' });
    return { success: true as const, updatedEmployee };
  } catch (error) { const result = teamFailure(error); return { success: false as const, message: result.error, status: result.status }; }
}
