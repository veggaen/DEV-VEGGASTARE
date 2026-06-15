"use client";

/**
 * @fileOverview Safe close handler for intercepting-route modals.
 *   `router.back()` is correct when the modal was opened via in-app soft
 *   navigation, but when the user arrived some other way (deep link, refresh,
 *   external referrer) `back()` can leave the app entirely or jump to an
 *   unexpected page (the "kicked back to the homepage" bug).
 *
 *   This hook records, at mount, whether we got here through an in-app
 *   navigation. On close it uses history.back() only in that case; otherwise
 *   it replaces the URL with a sensible base route so the modal simply
 *   dismisses to the page it belongs to.
 * @stability active
 */

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useModalClose(fallbackHref: string) {
  const router = useRouter();
  // Captured once on mount — true when there is in-app history to go back to.
  const canGoBackRef = useRef(false);

  useEffect(() => {
    // history.length > 1 means there is a previous entry in this tab's session.
    // We also require that the previous document was same-origin (when the
    // referrer is available) so we never `back()` out to an external site.
    const hasHistory = typeof window !== "undefined" && window.history.length > 1;
    let sameOriginReferrer = true;
    try {
      if (document.referrer) {
        sameOriginReferrer = new URL(document.referrer).origin === window.location.origin;
      }
    } catch {
      sameOriginReferrer = false;
    }
    canGoBackRef.current = hasHistory && sameOriginReferrer;
  }, []);

  return useCallback(() => {
    if (canGoBackRef.current) {
      router.back();
    } else {
      // No safe history entry — dismiss to the base route instead of risking a
      // jump off the app.
      router.replace(fallbackHref);
    }
  }, [router, fallbackHref]);
}
