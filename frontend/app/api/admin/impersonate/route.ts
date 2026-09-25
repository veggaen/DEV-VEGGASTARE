import { switchAccount } from '@/lib/impersonation';
export async function POST(request: Request) { return switchAccount(request); }
