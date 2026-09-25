import { adminCompanyDetail } from '@/lib/admin-company';
type Context = { params: Promise<{ companyId: string }> };
export async function GET(request: Request, context: Context) { return adminCompanyDetail(request, (await context.params).companyId, 'GET'); }
export async function PATCH(request: Request, context: Context) { return adminCompanyDetail(request, (await context.params).companyId, 'PATCH'); }
export async function DELETE(request: Request, context: Context) { return adminCompanyDetail(request, (await context.params).companyId, 'DELETE'); }
