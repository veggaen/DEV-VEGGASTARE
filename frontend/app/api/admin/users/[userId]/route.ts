import { adminUserDetail } from '@/lib/admin-user-detail';
type Context = { params: Promise<{ userId: string }> };
export async function GET(request: Request, context: Context) { return adminUserDetail(request, (await context.params).userId, 'GET'); }
export async function PATCH(request: Request, context: Context) { return adminUserDetail(request, (await context.params).userId, 'PATCH'); }
export async function DELETE(request: Request, context: Context) { return adminUserDetail(request, (await context.params).userId, 'DELETE'); }
