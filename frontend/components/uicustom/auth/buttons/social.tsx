'use client'
import { FcGoogle } from "react-icons/fc";
import { FaGithub, FaDiscord } from "react-icons/fa";
import { signIn } from 'next-auth/react'
import { DEFAULT_LOGIN_REDIRECT } from "@/routes";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

type Provider = 'google' | 'github' | 'discord';

const PROVIDERS: { id: Provider; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'google', label: 'Google', Icon: FcGoogle },
  { id: 'github', label: 'GitHub', Icon: FaGithub },
  { id: 'discord', label: 'Discord', Icon: FaDiscord },
];

/**
 * Social sign-in row. Each provider is a labeled button (icon-only buttons made
 * users guess), with a busy state on the one that was clicked so the redirect
 * gap never feels dead.
 */
import { useClientReady } from '@/hooks/use-client-ready';

export const MySocialAuth = () => {
  const ready = useClientReady();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = async (provider: Provider) => {
    setError(null);
    setPending(provider);
    try {
      await signIn(provider, {
        callbackUrl: callbackUrl || DEFAULT_LOGIN_REDIRECT
      });
    } catch {
      setError("Couldn't connect to sign-in. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
    <div className="grid w-full grid-cols-3 gap-2">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          disabled={!ready || pending !== null}
          aria-busy={pending === id}
          onClick={() => onClick(id)}
          aria-label={`Continue with ${label}`}
          className="flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-1 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60 sm:gap-2 sm:text-sm"
        >
          {pending === id ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          ) : (
            <Icon className={id === 'discord' ? 'h-4.5 w-4.5 text-[#5865F2]' : 'h-4.5 w-4.5'} />
          )}
          <span>{label}</span>
        </button>
      ))}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
