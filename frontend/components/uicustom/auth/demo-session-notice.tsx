"use client";
/** @fileOverview Explicit isolation and exit controls for interview demo sessions. @stability experimental */
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
export default function DemoSessionNotice() {
  const { data } = useSession();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const update = () => document.documentElement.style.setProperty('--demo-notice-height', `${ref.current?.offsetHeight ?? 0}px`);
    update();
    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--demo-notice-height'); };
  }, [data?.user?.isDemo]);
  if (!data?.user?.isDemo) return null;
  return <aside ref={ref} className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b bg-muted px-4 py-2 text-sm" aria-label="Demo mode">
    <span>Demo mode · Your own temporary workspace · No real payments</span>
    <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => void signOut({ callbackUrl: '/' })}>Exit demo</button>
  </aside>;
}
