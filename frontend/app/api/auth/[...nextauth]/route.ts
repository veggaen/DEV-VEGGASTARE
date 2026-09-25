import type { NextRequest } from 'next/server';
import { POST as authPost } from '@/auth';
import { confirmedSignOutRoute } from '@/lib/preview-signout';
export { GET } from '@/auth';
export const POST = (request: NextRequest) => confirmedSignOutRoute(request, authPost);
