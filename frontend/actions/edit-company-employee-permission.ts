'use server';
import { runTeamMutation, teamFailure } from '@/lib/company-team';
export type { EmployeePermissions } from '@/lib/types/company-permissions';
export async function editCompanyEmployeePermissionAction(input: unknown) {
  try {
    const data = await runTeamMutation({ ...(input && typeof input === 'object' ? input : {}), kind: 'permissions' });
    return { success: true as const, data };
  } catch (error) { return { success: false as const, ...teamFailure(error) }; }
}
