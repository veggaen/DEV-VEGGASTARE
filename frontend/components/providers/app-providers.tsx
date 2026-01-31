"use client";

import * as React from "react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { EdgeStoreProvider } from "@/lib/edgestore";
import { ThemeProvider } from "@/components/providers/themeprovider";
import { UiPreferencesProvider } from "@/components/providers/ui-preferences";
import { Toaster } from "@/components/ui/sonner";
import { FollowStateProvider } from "@/hooks/useFollowState";

import Web3Providers from "@/components/crypto-related/Web3Providers";

import MyTopBar from "@/components/uicustom/topbar";
import SiteFooter from "@/components/uicustom/site-footer";
import DevBanner from "@/components/uicustom/dev-banner";
import CookieBanner from "@/components/uicustom/cookie-banner";

export default function AppProviders({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus>
      <EdgeStoreProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="veggat:theme"
        >
          <UiPreferencesProvider>
            <FollowStateProvider>
              <Web3Providers>
                <MyTopBar />
                <div className="flex flex-1 flex-col min-h-0 overflow-auto">
                  <main className="flex flex-1 flex-col pb-[calc(var(--cookie-banner-offset,0px)+var(--dev-banner-offset,0px))]">
                    {children}
                  </main>
                </div>
                <SiteFooter />

                <CookieBanner />
                <DevBanner />
                <Toaster />
              </Web3Providers>
            </FollowStateProvider>
          </UiPreferencesProvider>
          <SpeedInsights />
        </ThemeProvider>
      </EdgeStoreProvider>
    </SessionProvider>
  );
}
