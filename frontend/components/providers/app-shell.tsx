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

// Keep the provider tree stable, but render its children on the server. A
// client-only wrapper here hid every route behind the wallet download waterfall.
// Wallet connections/modal initialization still happen in client effects.
const Web3Providers = dynamic(
  () => import("@/components/crypto-related/Web3Providers"),
  { loading: () => <AppBootSkeleton /> }
);

import MyTopBar from "@/components/uicustom/topbar";
import SiteFooter from "@/components/uicustom/site-footer";
import CookieBanner from "@/components/uicustom/cookie-banner";
import { ActiveWalletProvider } from "@/contexts/active-wallet-context";
import { TradeModeProvider } from "@/contexts/trade-mode-context";
import ImpersonationBanner from "@/components/uicustom/ImpersonationBanner";
import { UpdateBanner } from "@/components/uicustom/UpdateBanner";
import DemoSessionNotice from "@/components/uicustom/auth/demo-session-notice";
import { restoreRouteScroll } from "@/lib/route-scroll";

function PageScroller({ children, scrollKey, contained }: {
  children: React.ReactNode;
  scrollKey: string | null;
  contained: boolean;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const previousRoute = React.useRef(scrollKey);
  // Mount below the lazy providers, alongside the actual DOM node. An effect
  // on AppShell can run before that node exists on a hard load.
  React.useLayoutEffect(() => {
    const routeChanged = previousRoute.current !== scrollKey;
    previousRoute.current = scrollKey;
    const scroller = scrollRef.current;
    if (!scroller) return;
    // SSR content is already scrollable before hydration. Do not undo a user's
    // early scroll/click just because the lazy providers finished downloading.
    if (!routeChanged && !window.location.hash) return;
    return restoreRouteScroll(scroller, window.location.hash);
  }, [scrollKey]);
  return <div ref={scrollRef} data-site-scroll="true" data-app-scroll-container={contained ? undefined : 'true'} className={`flex flex-1 flex-col min-h-0 min-w-0 overscroll-contain-y ${contained ? 'overflow-hidden' : 'overflow-auto'}`}>{children}</div>;
}

export default function AppShell({
  session,
  children,
}: {
  session?: Session | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/auth/');
	// The persistent shell owns this scroller, so Next's window scroll reset is
	// insufficient. Keep Pulse's intercepted detail modal at the feed position.
	const scrollKey = pathname?.startsWith('/pulse/') ? '/pulse' : pathname;
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
                    {/* Only the page/drawer scroll. A document-level hash or
                        focus jump must never move the header or demo notice. */}
                    <div data-app-shell style={isAuthRoute ? { '--app-header-offset': '0px' } as React.CSSProperties : undefined} className="fixed inset-x-0 top-0 flex h-dvh min-h-0 min-w-0 flex-col overflow-clip">
                    <SkipToContent />
                    <UpdateBanner />
                    <MyTopBar />
                    <ImpersonationBanner />
                    <DemoSessionNotice />
                    <PageScroller scrollKey={scrollKey} contained={Boolean(isProductsRoute || isImmersiveChat)}>
                      <main id="main-content" tabIndex={-1} className={`min-w-0 outline-none ${isProductsRoute || isImmersiveChat ? 'flex flex-1 flex-col min-h-0' : 'shrink-0 min-h-[calc(100dvh-var(--app-header-offset,0px)-var(--demo-notice-height,0px))]'} ${isImmersiveChat ? '' : 'pb-[var(--cookie-banner-offset,0px)]'}`}>
                        {children}
                      </main>
                      {!isProductsRoute && !isImmersiveChat && pathname !== '/' && <SiteFooter />}
                    </PageScroller>
                    <CookieBanner />
                    <Toaster />
                    </div>
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

