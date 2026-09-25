'use client';
import { useEffect, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { isDemoUserId } from '@/lib/demo-policy';
export function CompanyAccess({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession(), router = useRouter(), actor = session?.user;
  const allowed = !!actor?.id && !actor.isDemo && !actor.isImpersonating && !isDemoUserId(actor.id) && ['OWNER', 'ADMIN'].includes(actor.role);
  useEffect(() => { if (status !== 'loading' && !allowed) router.replace('/'); }, [allowed, status, router]);
  if (status === 'loading' || !allowed) return <p role="status" className="p-6 text-muted-foreground">Checking access…</p>;
  return <div key={actor.id + ':' + actor.role}>{children}</div>;
}
