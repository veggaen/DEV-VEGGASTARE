import { teamHttp } from '@/lib/company-team-http';
export async function PATCH(request: Request) { return teamHttp(request, 'permissions'); }
