"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarOptional } from "@/components/providers/product-layoutProvider";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const sidebarContext = useSidebarOptional();
  const pathname = usePathname();

  const [hideOnInfoAtTop, setHideOnInfoAtTop] = React.useState(false);

  // Hide footer on full-screen chat pages
  const isConversationDetail = pathname?.startsWith("/conversations/") && pathname !== "/conversations/new";
  
  React.useEffect(() => {
    const isInfo = pathname === "/info" || pathname.startsWith("/info/");
    if (!isInfo) {
      setHideOnInfoAtTop(false);
      return;
    }

    const scrollEl = document.querySelector<HTMLElement>(
      '[data-app-scroll-container="true"]'
    );

    const getScrollTop = () => (scrollEl ? scrollEl.scrollTop : window.scrollY);
    const update = () => {
      const top = getScrollTop();
      setHideOnInfoAtTop(top < 8);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    scrollEl?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      scrollEl?.removeEventListener("scroll", update);
    };
  }, [pathname]);
  
  // On /products, hide footer until all products are loaded (hasMore === false)
  const shouldHide =
    (sidebarContext !== null && !sidebarContext.showFooter) || hideOnInfoAtTop || isConversationDetail;

  if (shouldHide) {
    return null;
  }

  return (
    <footer className="hidden md:block mt-auto shrink-0 z-10 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/60 backdrop-blur-xl">
      {/* Soft maintenance notice */}
      <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-6 py-2">
        <p className="text-center text-xs text-amber-700 dark:text-amber-200/80">
          🛠️ We&apos;re still building! Some features may be incomplete or change without notice.
        </p>
      </div>
      
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">VeggaStare</span>
          <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
          <span>© {year}</span>
          <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
          <span>Org.nr: 937 051 107</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/info"
            className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-all duration-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Kontakt
          </Link>
          <Link
            href="/terms"
            className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-all duration-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Salgsvilkår
          </Link>
          <Link
            href="/privacy"
            className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-all duration-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Personvern
          </Link>
          <Link
            href="/products"
            className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-all duration-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Markedsplass
          </Link>
        </div>
      </div>
    </footer>
  );
}
