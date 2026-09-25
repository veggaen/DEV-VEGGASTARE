import 'server-only';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limit';
import { isDemoUserId } from '@/lib/demo-policy';
import { Prisma } from '@/generated/prisma/client';
import { CompanyEmployeeResponseSchema } from '@/lib/types/company';
import { canManageTeamTarget, permissionRecord, teamMutationSchema, TEAM_ACTION_PERMISSION, TEAM_RANK, type TeamMutation } from './company-team-policy';
export class CompanyTeamError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
export function teamFailure(error: unknown) {
  if (error instanceof CompanyTeamError) return { error: error.message, status: error.status };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return { error: 'This person is already on the team. Refresh the team list.', status: 409 };
    if (error.code === 'P2003') return { error: 'This member has linked records. Review their access with the company owner before removal.', status: 409 };
  }
  return { error: 'The change could not be confirmed. Refresh the team before trying again.', status: 500 };
}
export async function teamRequestActor() {
  const viewer = await MyLibUserAuth();
  if (!viewer?.id) throw new CompanyTeamError('Sign in to manage this team.', 401);
  if (isDemoUserId(viewer.id)) throw new CompanyTeamError('Demo accounts cannot change teams. Use your own account.');
  const h = await headers(); const raw = h.get('origin');
  let origin: URL;
  try { origin = new URL(raw ?? ''); } catch { throw new CompanyTeamError('Open company settings on this site and try again.'); }
  if (origin.origin !== raw || origin.host !== (h.get('x-forwarded-host') ?? h.get('host')) || !['https:', 'http:'].includes(origin.protocol)) throw new CompanyTeamError('Open company settings on this site and try again.');
  if (!(await checkRateLimit(`company-team:${viewer.id}`, 'write')).success) throw new CompanyTeamError('Too many changes. Wait a minute and try again.', 429);
  return viewer.id;
}
const employeeSelect = {
  id: true, userId: true, companyId: true, role: true, permissions: true, jobTitle: true, createdAt: true, updatedAt: true,
  User: { select: { id: true, name: true, image: true } },
} satisfies Prisma.EmployeeSelect;
/** Internal service: actor must come from teamRequestActor, never the request body. */
export async function mutateCompanyTeam(actorId: string, raw: unknown) {
  if (isDemoUserId(actorId)) throw new CompanyTeamError('Demo accounts cannot change teams. Use your own account.');
  const parsed = teamMutationSchema.safeParse(raw);
  if (!parsed.success) throw new CompanyTeamError('Refresh company settings and review the selected person and changes.', 400);
  const input: TeamMutation = parsed.data;
  return dbPrisma.$transaction(async tx => {
    // User share lock prevents platform-role revocation racing this write.
    // Company lock serializes all team edits, including access revocations.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actorId} FOR SHARE`;
    const user = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!user) throw new CompanyTeamError('Sign in again to manage this team.', 401);
    await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${input.companyId} FOR UPDATE`;
    const company = await tx.company.findUnique({ where: { id: input.companyId }, select: { ownerId: true } });
    if (!company) throw new CompanyTeamError('Company not available.', 404);
    const privileged = company.ownerId === actorId || user.role === 'ADMIN' || user.role === 'OWNER';
    const actor = await tx.employee.findUnique({ where: { userId_companyId: { userId: actorId, companyId: input.companyId } }, select: { role: true, permissions: true } });
    const owned = permissionRecord(actor?.permissions);
    if (!privileged && (!actor || owned[TEAM_ACTION_PERMISSION[input.kind]] !== true)) throw new CompanyTeamError('You no longer have permission for this team change. Refresh the page.');
    const assertNewRole = (role: keyof typeof TEAM_RANK) => {
      if (role === 'OWNER') throw new CompanyTeamError('Ownership cannot be changed through team roles.');
      if (!privileged && (!actor || TEAM_RANK[role] >= TEAM_RANK[actor.role])) throw new CompanyTeamError('Choose a role below your own.');
    };
    if (input.kind === 'add') {
      assertNewRole(input.role);
      if (input.userId === actorId || input.userId === company.ownerId || isDemoUserId(input.userId)) throw new CompanyTeamError('Choose another personal account to add to the team.');
      if (!await tx.user.findUnique({ where: { id: input.userId }, select: { id: true } })) throw new CompanyTeamError('This account is no longer available.', 404);
      const row = await tx.employee.create({ data: { companyId: input.companyId, userId: input.userId, role: input.role, jobTitle: input.jobTitle || null, permissions: {} }, select: employeeSelect });
      return employeeDto(row);
    }
    const target = await tx.employee.findFirst({ where: { id: input.employeeId, companyId: input.companyId }, select: employeeSelect });
    if (!target) throw new CompanyTeamError('Team member not available. Refresh the team list.', 404);
    if (!canManageTeamTarget(actorId, company.ownerId, privileged, actor, target)) throw new CompanyTeamError('You cannot change your own access, the owner, or a member with higher access.');
    if (target.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new CompanyTeamError('This member changed since you opened the form. Refresh the team and review again.', 409);
    if (input.kind === 'remove') { await tx.employee.delete({ where: { id: target.id } }); return null; }
    let data: Prisma.EmployeeUpdateInput;
    if (input.kind === 'role') { assertNewRole(input.newRole); data = { role: input.newRole }; }
    else {
      if (!privileged && Object.keys(input.permissions).some(key => owned[key] !== true)) throw new CompanyTeamError('You can only change permissions you hold yourself.');
      data = { permissions: { ...permissionRecord(target.permissions), ...input.permissions } as Prisma.InputJsonObject };
    }
    data.updatedAt = new Date(Math.max(Date.now(), target.updatedAt.getTime() + 1));
    return employeeDto(await tx.employee.update({ where: { id: target.id }, data, select: employeeSelect }));
  }, { timeout: 10_000, maxWait: 5_000 });
}
function employeeDto(row: Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>) {
  return CompanyEmployeeResponseSchema.parse({ id: row.id, userId: row.userId, role: row.role, permissions: permissionRecord(row.permissions), jobTitle: row.jobTitle, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), user: row.User });
}
export async function runTeamMutation(raw: unknown) { return mutateCompanyTeam(await teamRequestActor(), raw); }
