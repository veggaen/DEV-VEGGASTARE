import { teamHttp } from '@/lib/company-team-http';
export async function POST(request: Request) { return teamHttp(request, 'role'); }
