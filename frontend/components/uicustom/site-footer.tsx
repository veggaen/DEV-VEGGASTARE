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
    <footer className="hidden md:block mt-auto shrink-0 z-10 border-t border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-white/60">
          <span className="font-medium text-white/80">VeggaStare</span>
          <span className="mx-2 text-white/25">·</span>
          <span>© {year}</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/info"
            className="rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition-all duration-300 hover:bg-white/5 hover:text-white/90"
          >
            Info / Contact
          </Link>
				<Link
					href="/privacy"
					className="rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition-all duration-300 hover:bg-white/5 hover:text-white/90"
				>
					Privacy & cookies
				</Link>
          <Link
            href="/products"
            className="rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition-all duration-300 hover:bg-white/5 hover:text-white/90"
          >
            Marketplace
          </Link>
        </div>
      </div>
    </footer>
  );
}
