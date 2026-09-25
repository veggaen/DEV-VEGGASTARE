import { CompanyEmployeeResponseSchema } from './types/company';
import type { TeamMutation } from './company-team-policy';
export class TeamClientError extends Error {
  constructor(message: string, public refreshRequired = false) { super(message); }
}
export async function submitTeamChange(input: TeamMutation) {
  const { kind, ...body } = input;
  const route = { add: 'add', remove: 'remove', permissions: 'edit', role: 'edit-role' }[kind];
  let response: Response;
  try {
    response = await fetch(`/api/companies/employees/${route}`, {
      method: kind === 'remove' ? 'DELETE' : kind === 'permissions' ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new TeamClientError('The change could not be confirmed. Refresh the team before trying again.', true); }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new TeamClientError(result?.error || 'Unable to save this change. Refresh the team and try again.', response.status === 409 || response.status >= 500);
  if (kind === 'remove') return null;
  const parsed = CompanyEmployeeResponseSchema.safeParse(result);
  if (!parsed.success) throw new TeamClientError('The response could not be confirmed. Refresh the team before trying again.', true);
  return parsed.data;
}
