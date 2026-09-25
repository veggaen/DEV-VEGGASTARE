/** Shared presentation policy; the server rechecks it from locked database rows. */
import { z } from 'zod';
import { EmployeeRole } from '@/generated/prisma/browser';
import { permissionMapping } from '@/lib/permissions';
import type { EmployeePermissions } from '@/lib/types/company-permissions';
export const TEAM_PERMISSION_KEYS = [...Object.keys(permissionMapping),
  'CAN_VIEW_TAX_REPORTS', 'CAN_EDIT_TAX_DATA', 'CAN_MANAGE_EXPENSES', 'CAN_MANAGE_SALARIES', 'CAN_COMMENT_TAX_REPORTS',
  'CAN_VIEW_ORDERS', 'CAN_PROCESS_ORDERS', 'CAN_SHIP_ORDERS', 'CAN_MANAGE_SHIPMENTS', 'CAN_VIEW_INVENTORY', 'CAN_EDIT_INVENTORY',
] as (keyof EmployeePermissions)[];
export const TEAM_ROLES = ['MANAGER', 'WAREHOUSE_MANAGER', 'STAFF', 'ACCOUNTANT', 'WAREHOUSE_WORKER', 'USER'] as const;
// Finance and general staff are peers, not administrators of one another.
export const TEAM_RANK: Record<EmployeeRole, number> = { OWNER: 100, MANAGER: 80, WAREHOUSE_MANAGER: 60, STAFF: 40, ACCOUNTANT: 40, WAREHOUSE_WORKER: 20, USER: 10 };
export const teamRoleLabel = (role: string) => role.toLowerCase().replaceAll('_', ' ').replace(/^./, value => value.toUpperCase());
const id = z.string().trim().min(1).max(200);
const target = { companyId: id, employeeId: id, expectedUpdatedAt: z.string().datetime() };
const permissions = z.record(z.boolean()).refine(value => Object.keys(value).length > 0 && Object.keys(value).every(key => TEAM_PERMISSION_KEYS.includes(key as keyof EmployeePermissions)), 'Select known permissions only');
export const teamMutationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), companyId: id, userId: id, role: z.nativeEnum(EmployeeRole), jobTitle: z.string().trim().max(80).optional() }).strict(),
  z.object({ kind: z.literal('permissions'), ...target, permissions }).strict(),
  z.object({ kind: z.literal('role'), ...target, newRole: z.nativeEnum(EmployeeRole) }).strict(),
  z.object({ kind: z.literal('remove'), ...target }).strict(),
]);
export type TeamMutation = z.infer<typeof teamMutationSchema>;
export const TEAM_ACTION_PERMISSION = { add: 'CAN_ADD_EMPLOYEE', remove: 'CAN_REMOVE_EMPLOYEE', role: 'CAN_EDIT_EMPLOYEE_ROLE', permissions: 'CAN_EDIT_PERMISSION' } as const;
export function permissionRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function canManageTeamTarget(actorId: string, ownerId: string, privileged: boolean, actor: { role: EmployeeRole; permissions: unknown } | undefined | null, target: { userId: string; role: EmployeeRole; permissions: unknown }) {
  if (target.userId === ownerId || target.userId === actorId) return false;
  if (privileged) return true;
  if (!actor || TEAM_RANK[actor.role] <= TEAM_RANK[target.role]) return false;
  const owned = permissionRecord(actor.permissions);
  return Object.entries(permissionRecord(target.permissions)).every(([key, value]) => value !== true || owned[key] === true);
}
