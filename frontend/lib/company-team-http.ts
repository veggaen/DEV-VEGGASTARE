import { NextResponse } from 'next/server';
import { mutateCompanyTeam, teamFailure, teamRequestActor, CompanyTeamError } from './company-team';
import type { TeamMutation } from './company-team-policy';
export async function teamHttp(request: Request, kind: TeamMutation['kind']) {
  const responseHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  try {
    const actor = await teamRequestActor();
    let body: unknown;
    try { body = await request.json(); } catch { throw new CompanyTeamError('Invalid request. Refresh the team and try again.', 400); }
    const data = await mutateCompanyTeam(actor, { ...(body && typeof body === 'object' ? body : {}), kind });
    return NextResponse.json(data ?? { message: 'Team member removed.' }, { headers: responseHeaders });
  } catch (error) {
    const result = teamFailure(error);
    return NextResponse.json({ error: result.error, message: result.error }, { status: result.status, headers: responseHeaders });
  }
}
