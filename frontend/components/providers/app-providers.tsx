"use client";

import * as React from "react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { usePathname } from "next/navigation";

import { EdgeStoreProvider } from "@/lib/edgestore";
import { ThemeProvider } from "@/components/providers/themeprovider";
import { UiPreferencesProvider } from "@/components/providers/ui-preferences";
import { ProfileThemeProvider } from "@/components/providers/profile-theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { FollowStateProvider } from "@/hooks/useFollowState";
import { CurrencyRatesProvider } from "@/hooks/useCurrencyRates";

import Web3Providers from "@/components/crypto-related/Web3Providers";

import MyTopBar from "@/components/uicustom/topbar";
import SiteFooter from "@/components/uicustom/site-footer";
import DevBanner from "@/components/uicustom/dev-banner";
import CookieBanner from "@/components/uicustom/cookie-banner";
import ImpersonationBanner from "@/components/uicustom/ImpersonationBanner";
import { UpdateBanner } from "@/components/uicustom/UpdateBanner";

export default function AppProviders({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
	const isProductsRoute = pathname?.startsWith('/products');
  
  // Gate page gets minimal layout - no providers, no header/footer
  if (pathname === '/gate') {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
        storageKey="veggat:theme"
      >
        {children}
      </ThemeProvider>
    );
  }

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
          <ProfileThemeProvider>
            <UiPreferencesProvider>
              <FollowStateProvider>
                <CurrencyRatesProvider>
                  <Web3Providers>
                    <UpdateBanner />
                    <MyTopBar />
                    <ImpersonationBanner />
                    <div className={`flex flex-1 flex-col min-h-0 ${isProductsRoute ? 'overflow-hidden' : 'overflow-auto'}`}>
                      <main className="flex flex-1 flex-col min-h-0 pb-[calc(var(--cookie-banner-offset,0px)+var(--dev-banner-offset,0px))]">
                        {children}
                      </main>
                    </div>
                    {!isProductsRoute && <SiteFooter />}
                    <CookieBanner />
                    <DevBanner />
                    <Toaster />
                  </Web3Providers>
                </CurrencyRatesProvider>
              </FollowStateProvider>
            </UiPreferencesProvider>
          </ProfileThemeProvider>
          <SpeedInsights />
        </ThemeProvider>
      </EdgeStoreProvider>
    </SessionProvider>
  );
}
