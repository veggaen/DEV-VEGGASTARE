"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { usePathname } from "next/navigation";

import { EdgeStoreProvider } from "@/lib/edgestore";
import { ThemeProvider } from "@/components/providers/themeprovider";
import { ConfirmDialogProvider } from "@/components/providers/confirm-dialog";
import { UiPreferencesProvider } from "@/components/providers/ui-preferences";
import { ProfileThemeProvider } from "@/components/providers/profile-theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { FollowStateProvider } from "@/hooks/useFollowState";
import { CurrencyRatesProvider } from "@/hooks/useCurrencyRates";
import { CartProvider } from "@/contexts/cart-context";

// Lazy-load Web3 providers — heavy bundle (Wagmi, Solana, AppKit) only needed
// on pages that use crypto features, not for initial paint.
const Web3Providers = dynamic(
  () => import("@/components/crypto-related/Web3Providers"),
  { ssr: false }
);

import MyTopBar from "@/components/uicustom/topbar";
import SiteFooter from "@/components/uicustom/site-footer";
import DevBanner from "@/components/uicustom/dev-banner";
import CookieBanner from "@/components/uicustom/cookie-banner";
import { ActiveWalletProvider } from "@/contexts/active-wallet-context";
import { TradeModeProvider } from "@/contexts/trade-mode-context";
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
  // Immersive chat surfaces own the full viewport — no site footer or dev banner
  // (which read as a fake "footer line" under the composer), and no reserved
  // bottom padding. Matches /ai/[id] and a DM conversation (but NOT the /ai list).
  const isImmersiveChat =
    /^\/ai\/[^/]+$/.test(pathname ?? '') || /^\/conversations\/[^/]+$/.test(pathname ?? '');
  
  // Gate page gets minimal layout - no providers, no header/footer
  if (pathname === '/gate') {
    return (
      <SessionProvider session={session} refetchOnWindowFocus>
        <EdgeStoreProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
            storageKey="veggat:theme"
          >
            <ProfileThemeProvider>
              <UiPreferencesProvider>
                <FollowStateProvider>
                  <CurrencyRatesProvider>
                    <Web3Providers>
                      <ActiveWalletProvider>
                      <TradeModeProvider>
                      {children}
                      <Toaster />
                      </TradeModeProvider>
                      </ActiveWalletProvider>
                    </Web3Providers>
                  </CurrencyRatesProvider>
                </FollowStateProvider>
              </UiPreferencesProvider>
            </ProfileThemeProvider>
            <SpeedInsights />
            <Analytics />
          </ThemeProvider>
        </EdgeStoreProvider>
      </SessionProvider>
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
                    <ActiveWalletProvider>
                    <TradeModeProvider>
                    <CartProvider>
                    <ConfirmDialogProvider>
                    <UpdateBanner />
                    <MyTopBar />
                    <ImpersonationBanner />
                    <div className={`flex flex-1 flex-col min-h-0 ${isProductsRoute || isImmersiveChat ? 'overflow-hidden' : 'overflow-auto'}`}>
                      <main className={`flex flex-1 flex-col min-h-0 ${isImmersiveChat ? '' : 'pb-[calc(var(--cookie-banner-offset,0px)+var(--dev-banner-offset,0px))]'}`}>
                        {children}
                      </main>
                    </div>
                    {!isProductsRoute && !isImmersiveChat && <SiteFooter />}
                    <CookieBanner />
                    {!isImmersiveChat && <DevBanner />}
                    <Toaster />
                    </ConfirmDialogProvider>
                    </CartProvider>
                    </TradeModeProvider>
                    </ActiveWalletProvider>
                  </Web3Providers>
                </CurrencyRatesProvider>
              </FollowStateProvider>
            </UiPreferencesProvider>
          </ProfileThemeProvider>
          <SpeedInsights />
          <Analytics />
        </ThemeProvider>
      </EdgeStoreProvider>
    </SessionProvider>
  );
}
