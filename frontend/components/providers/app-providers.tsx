"use client";

/** @fileOverview Lightweight route shell that keeps wallet bundles off the gate. @stability stable */
import type { ReactNode } from "react";
import type { Session } from "next-auth";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/components/providers/themeprovider";
import SiteTelemetry from "@/components/providers/site-telemetry";
import { AppBootSkeleton } from "@/components/ui/route-skeleton";

const AppShell = dynamic(() => import("./app-shell"), {
  loading: () => <AppBootSkeleton />,
});

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
