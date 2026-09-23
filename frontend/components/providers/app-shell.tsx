"use client";
/** @fileOverview Full application providers, loaded only after the access gate. @stability stable */

import * as React from "react";
import dynamic from "next/dynamic";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import SiteTelemetry from "@/components/providers/site-telemetry";
import { usePathname } from "next/navigation";

import { EdgeStoreProvider } from "@/lib/edgestore";
import { ThemeProvider } from "@/components/providers/themeprovider";
import { ConfirmDialogProvider } from "@/components/providers/confirm-dialog";
import SkipToContent from "@/components/uicustom/skip-to-content";
import { UiPreferencesProvider } from "@/components/providers/ui-preferences";
import { ProfileThemeProvider } from "@/components/providers/profile-theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { FollowStateProvider } from "@/hooks/useFollowState";
import { CurrencyRatesProvider } from "@/hooks/useCurrencyRates";
import { CartProvider } from "@/contexts/cart-context";
import { AppBootSkeleton } from "@/components/ui/route-skeleton";

// Lazy-load Web3 providers — heavy bundle (Wagmi, Solana, AppKit) only needed
// on pages that use crypto features, not for initial paint.
const Web3Providers = dynamic(
  () => import("@/components/crypto-related/Web3Providers"),
  { ssr: false, loading: () => <AppBootSkeleton /> }
);

import MyTopBar from "@/components/uicustom/topbar";
import SiteFooter from "@/components/uicustom/site-footer";
import CookieBanner from "@/components/uicustom/cookie-banner";
import { ActiveWalletProvider } from "@/contexts/active-wallet-context";
import { TradeModeProvider } from "@/contexts/trade-mode-context";
import ImpersonationBanner from "@/components/uicustom/ImpersonationBanner";
import { UpdateBanner } from "@/components/uicustom/UpdateBanner";
import DemoSessionNotice from "@/components/uicustom/auth/demo-session-notice";

export default function AppShell({
  session,
  children,
}: {
  session?: Session | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
	const scrollRef = React.useRef<HTMLDivElement>(null);
	// The persistent shell owns this scroller, so Next's window scroll reset is
	// insufficient. Keep Pulse's intercepted detail modal at the feed position.
	const scrollKey = pathname?.startsWith('/pulse/') ? '/pulse' : pathname;
	React.useLayoutEffect(() => {
		scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}, [scrollKey]);
	const isProductsRoute = pathname?.startsWith('/products');
  // Immersive chat surfaces own the full viewport — no site footer or dev banner
  // (which read as a fake "footer line" under the composer), and no reserved
  // bottom padding. Matches /ai/[id] and a DM conversation (but NOT the /ai list).
  const isImmersiveChat =
    pathname === '/ai' || /^\/ai\/[^/]+$/.test(pathname ?? '') ||
    (pathname !== '/conversations/new' && /^\/conversations\/[^/]+$/.test(pathname ?? ''));
  
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
                    <SkipToContent />
                    <UpdateBanner />
                    <MyTopBar />
                    <ImpersonationBanner />
                    <DemoSessionNotice />
                    <div ref={scrollRef} data-site-scroll="true" data-app-scroll-container={isProductsRoute || isImmersiveChat ? undefined : 'true'} className={`flex flex-1 flex-col min-h-0 min-w-0 overscroll-contain-y ${isProductsRoute || isImmersiveChat ? 'overflow-hidden' : 'overflow-auto'}`}>
                      <main id="main-content" tabIndex={-1} className={`min-w-0 outline-none ${isProductsRoute || isImmersiveChat ? 'flex flex-1 flex-col min-h-0' : 'shrink-0 min-h-[calc(100dvh-var(--app-header-offset,0px)-var(--demo-notice-height,0px))]'} ${isImmersiveChat ? '' : 'pb-[var(--cookie-banner-offset,0px)]'}`}>
                        {children}
                      </main>
                      {!isProductsRoute && !isImmersiveChat && pathname !== '/' && <SiteFooter />}
                    </div>
                    <CookieBanner />
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
          <SiteTelemetry />
        </ThemeProvider>
      </EdgeStoreProvider>
    </SessionProvider>
  );
}

