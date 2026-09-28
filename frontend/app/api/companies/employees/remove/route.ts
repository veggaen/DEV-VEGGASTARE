import { teamHttp } from '@/lib/company-team-http';
export async function DELETE(request: Request) { return teamHttp(request, 'remove'); }

