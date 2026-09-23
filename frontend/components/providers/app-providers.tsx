"use client";

/** @fileOverview Stable provider boundary; essential SSR content is never replaced by a lazy app shell. @stability stable */
import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/components/providers/themeprovider";
import SiteTelemetry from "@/components/providers/site-telemetry";
import AppShell from "./app-shell";

export default function AppProviders({ children, session }: {
  children: ReactNode;
  session?: Session | null;
}) {
  const pathname = usePathname();
  if (pathname !== "/gate") return <AppShell session={session}>{children}</AppShell>;
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}
      disableTransitionOnChange storageKey="veggat:theme">
      {children}
      <SiteTelemetry />
    </ThemeProvider>
  );
}
