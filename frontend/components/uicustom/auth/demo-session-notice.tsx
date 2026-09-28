"use client";
/** @fileOverview Explicit isolation and exit controls for interview demo sessions. @stability experimental */
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
import { useClientReady } from "@/hooks/use-client-ready";
export default function DemoSessionNotice() {
  const { data } = useSession();
  const clientReady = useClientReady();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const update = () => document.documentElement.style.setProperty('--demo-notice-height', `${ref.current?.offsetHeight ?? 0}px`);
    update();
    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--demo-notice-height'); };
  }, [data?.user?.isDemo]);
  if (!data?.user?.isDemo) return null;
  return <aside ref={ref} className="relative z-10 shrink-0 border-b bg-muted text-sm" aria-label="Demo mode">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1 sm:justify-center sm:gap-4 sm:px-6 lg:px-8">
      <span className="min-w-0 text-xs leading-relaxed sm:text-sm"><span className="sm:hidden">Demo workspace · No payments</span><span className="hidden sm:inline">Demo mode · Your own temporary workspace · No real payments</span></span>
      <button type="button" disabled={!clientReady} className="min-h-11 shrink-0 rounded px-1 underline underline-offset-4 focus-visible:outline focus-visible:outline-2" onClick={() => void signOut({ callbackUrl: '/' })}>Exit demo</button>
    </div>
  </aside>;
}
