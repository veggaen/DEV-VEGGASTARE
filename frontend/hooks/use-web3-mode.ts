/** @fileOverview Authoritative shared Web3 state, never inferred from local storage. @stability evolving */
'use client';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
export function useWeb3Mode() {
  const { data: session, status } = useSession();
  return useQuery({
    queryKey: ['web3-mode', session?.user?.id], enabled: status === 'authenticated', staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/settings/web3-mode', { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
      const body = await response.json();
      if (!response.ok || typeof body.web3ModeEnabled !== 'boolean') throw new Error('Web3 settings could not load.');
      return body.web3ModeEnabled as boolean;
    },
  });
}
