'use client'
import { FcGoogle } from "react-icons/fc";
import { FaGithub, FaDiscord } from "react-icons/fa";
<<<<<<< HEAD
=======
import { Button } from "@/components/ui/button";
>>>>>>> dev
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
export const MySocialAuth = () => {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [pending, setPending] = useState<Provider | null>(null);

<<<<<<< HEAD
  const onClick = (provider: Provider) => {
    setPending(provider);
=======
  const onClick = (provider: 'google' | 'github' | 'discord') => {
>>>>>>> dev
    signIn(provider, {
      callbackUrl: callbackUrl || DEFAULT_LOGIN_REDIRECT
    })
  }
<<<<<<< HEAD

  return (
    <div className="grid w-full grid-cols-3 gap-2">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          disabled={pending !== null}
          onClick={() => onClick(id)}
          aria-label={`Continue with ${label}`}
          className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-surface-1/60 text-sm font-medium text-foreground/80 transition-all duration-200 ease-out hover:border-brand-accent/40 hover:bg-accent hover:text-foreground motion-safe:hover:-translate-y-px hover:shadow-e1 motion-safe:active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"
        >
          {pending === id ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          ) : (
            <Icon className={id === 'discord' ? 'h-4.5 w-4.5 text-[#5865F2]' : 'h-4.5 w-4.5'} />
          )}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
=======
  return(
    <div className="flex items-center w-full gap-x-2">
        <Button size={'lg'} className="w-full" variant={"outline"} onClick={() => onClick('google')}>
            <FcGoogle className="h-5 w-5" />
        </Button>
        <Button size={'lg'} className="w-full" variant={"outline"} onClick={() => onClick('github')}>
            <FaGithub className="h-5 w-5" />
        </Button>
        <Button size={'lg'} className="w-full" variant={"outline"} onClick={() => onClick('discord')}>
            <FaDiscord className="h-5 w-5 text-[#5865F2]" />
        </Button>
>>>>>>> dev
    </div>
  )
}
