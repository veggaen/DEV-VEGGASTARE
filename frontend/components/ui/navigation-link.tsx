"use client";
/** @fileOverview Navigation feedback driven by actual route transitions. @stability stable */

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 bg-emerald-400 motion-safe:animate-pulse">
      <span className="sr-only">Loading page…</span>
    </span>
  );
}

/** Uses Next's actual transition status, not a simulated timer. */
export default function NavigationLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<PendingNavigation /></Link>;
}
