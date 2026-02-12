import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { auth } from "@/auth";
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

export default async function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var key='veggat:theme';var t=localStorage.getItem(key);var m=window.matchMedia('(prefers-color-scheme: dark)');var theme=t||'system';var isDark=(theme==='dark')||(theme==='system'&&m.matches);var root=document.documentElement;if(isDark){root.classList.add('dark');}else{root.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.className} myanimation transition-colors min-h-[100dvh] flex flex-col bg-background text-foreground`}
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
