import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { EdgeStoreProvider } from "../lib/edgestore";
import { ThemeProvider } from "@/components/providers/themeprovider";
import { UiPreferencesProvider } from "@/components/providers/ui-preferences";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner"
import MyTopBar from "@/components/uicustom/topbar";

/** NEW: one client wrapper that contains ActiveNetwork + wagmi + react-query + Solana + WalletContext + Pricing */
import Web3Providers from "@/components/crypto-related/Web3Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.veggat.com"),
  title: {
    default: "Veggat — Secure marketplace for premium digital products",
    template: "%s — Veggat",
  },
  description:
    "Veggat is a modern marketplace for premium digital products and services. Browse curated listings, manage inventory, and checkout securely.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Veggat",
    title: "Veggat — Secure marketplace for premium digital products",
    description:
      "Browse curated premium products, manage warehouses, and checkout securely on Veggat.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Veggat — Secure marketplace for premium digital products",
    description:
      "Browse curated premium products, manage warehouses, and checkout securely on Veggat.",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} myanimation transition-colors h-full`} suppressHydrationWarning={true}>
        <SessionProvider session={session} refetchOnWindowFocus={true}>
          <EdgeStoreProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
              <UiPreferencesProvider>
                <Web3Providers>

                  <MyTopBar />
                  {children}
                  <Toaster />
                </Web3Providers>
              </UiPreferencesProvider>
              <SpeedInsights />
            </ThemeProvider>
          </EdgeStoreProvider>
        </SessionProvider>
      </body>
    </html>
  ); // is this proper and good typescript? like best practice? does each part here need a '?' or is it ok like this? and its this best practices and could there be better ways?
}
