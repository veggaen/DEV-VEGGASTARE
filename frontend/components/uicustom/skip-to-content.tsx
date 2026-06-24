"use client";

/**
 * SkipToContent — a WCAG 2.4.1 (Bypass Blocks) skip link.
 *
 * It is the first focusable element on the page, visually hidden until it
 * receives keyboard focus, at which point it slides into view at the top-left.
 * Activating it moves focus to <main id="main-content">, letting keyboard and
 * screen-reader users jump past the nav on every page. Mouse users never see it.
 *
 * Pairs with `<main id="main-content" tabIndex={-1}>` in AppProviders.
 */
export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="
        sr-only focus-visible:not-sr-only
        focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[1000]
        focus-visible:inline-flex focus-visible:items-center focus-visible:rounded-md
        focus-visible:bg-brand-accent focus-visible:px-4 focus-visible:py-2.5
        focus-visible:text-sm focus-visible:font-semibold focus-visible:text-brand-accent-foreground
        focus-visible:shadow-lg focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
      "
      // On click, also move programmatic focus to the target (some browsers only
      // scroll without focusing on a hash link to a tabIndex=-1 element).
      onClick={(e) => {
        const target = document.getElementById("main-content");
        if (target) {
          e.preventDefault();
          target.focus();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }}
    >
      Skip to content
    </a>
  );
}
