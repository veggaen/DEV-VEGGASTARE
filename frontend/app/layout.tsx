import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { auth } from "@/auth";
import AppProviders from "@/components/providers/app-providers";

/**
 * Force all pages dynamic — the root layout calls auth() (reads cookies),
 * and AppProviders uses SessionProvider / ThemeProvider (client contexts).
 * Next.js 16 doesn't always infer this, causing useContext prerender errors.
 */
export const dynamic = "force-dynamic";

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
  // A failed session read (e.g. an undecryptable legacy cookie after the
  // next-auth upgrade) must never 500 the entire site. Degrade to logged-out.
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    console.error("[RootLayout] auth() failed, rendering as logged-out:", err);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} myanimation min-h-dvh flex flex-col bg-background text-foreground`}
        suppressHydrationWarning={true}
      >
      <AppProviders session={session}>
        {children}
        {modal}
      </AppProviders>
      </body>
    </html>
  );
}
