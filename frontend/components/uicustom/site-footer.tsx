"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useSidebarOptional } from "@/components/providers/product-layoutProvider";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const sidebarContext = useSidebarOptional();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const footerRef = React.useRef<HTMLElement | null>(null);

  const [hideOnInfoAtTop, setHideOnInfoAtTop] = React.useState(false);
  const [isRevealed, setIsRevealed] = React.useState(false);

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

  React.useEffect(() => {
    const footer = footerRef.current;
    if (!footer || reduceMotion) {
      setIsRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsRevealed(entry.isIntersecting),
      { threshold: 0.18, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [reduceMotion, pathname]);
  
  // On /products, hide footer until all products are loaded (hasMore === false)
  const shouldHide =
    (sidebarContext !== null && !sidebarContext.showFooter) || hideOnInfoAtTop || isConversationDetail;

  if (shouldHide) {
    return null;
  }

  return (
    <motion.footer
      ref={footerRef}
      initial={false}
      animate={
        reduceMotion || isRevealed
          ? { opacity: 1, y: 0 }
          : { opacity: 0.35, y: 18 }
      }
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
      className="app-chrome mt-auto shrink-0 z-10 border-t pb-[calc(var(--cookie-banner-offset,0px)+var(--dev-banner-offset,0px))]"
    >
      <div className="border-b border-border/70 bg-brand-accent/10 px-4 py-2">
        <p className="mx-auto max-w-screen-2xl text-center text-xs text-foreground/70">
          Active creator build. Core marketplace paths are live; experimental surfaces are marked as they mature.
        </p>
      </div>
      
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">VeggaStare</span>
          <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
          <span>© {year}</span>
          <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
          <span>Org.nr: 937 051 107</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link
            href="/info"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-accent/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
          >
            Kontakt
          </Link>
          <Link
            href="/terms"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-accent/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
          >
            Salgsvilkår
          </Link>
          <Link
            href="/privacy"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-accent/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
          >
            Personvern
          </Link>
          <Link
            href="/products"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-accent/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
          >
            Markedsplass
          </Link>
        </div>
      </div>
    </motion.footer>
  );
}
