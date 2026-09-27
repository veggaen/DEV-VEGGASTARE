import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import AppProviders from "@/components/providers/app-providers";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { CONSENT_VISIBILITY_SCRIPT } from "@/lib/consent-visibility";
import { ACCENT_BOOT_SCRIPT } from "@/lib/accent-boot";

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

export default async function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  // Initialize both SSR and hydration with the same verified identity. Otherwise
  // the demo banner and signed-in composer arrive after users start scrolling.
  // auth() reads request headers: personalized HTML must never be shared-cached.
  // Route handlers/actions still perform their own authorization checks.
  const session = await auth();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} myanimation min-h-dvh flex flex-col bg-background text-foreground`}
        suppressHydrationWarning={true}
      >
      {/* Parser-time presentation check, like the theme bootstrap: returning
          visitors never see a consent flash while the application JS downloads.
          Nonce is inherited from the existing CSP; this does not enable tracking. */}
      <script id="consent-visibility" nonce={nonce} dangerouslySetInnerHTML={{ __html: CONSENT_VISIBILITY_SCRIPT }} />
      {/* Saved accent preset on <html> before hydration — no colour flash. */}
      <script id="accent-boot" nonce={nonce} dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SCRIPT }} />
      {/* With JS disabled no optional SDK can run, and an inert consent panel
          must not cover the readable sales terms or other server content. */}
      <noscript><style>{'[data-cookie-banner]{display:none}'}</style></noscript>
      <AppProviders session={session}>
        {children}
        {modal}
      </AppProviders>
      </body>
    </html>
  );
}
