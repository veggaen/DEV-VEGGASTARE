import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import AppProviders from "@/components/providers/app-providers";

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

export default function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} myanimation min-h-dvh flex flex-col bg-background text-foreground`}
        suppressHydrationWarning={true}
      >
      <AppProviders>
        {children}
        {modal}
      </AppProviders>
      </body>
    </html>
  );
}
