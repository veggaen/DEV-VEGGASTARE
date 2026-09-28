"use client";

/**
 * @fileOverview  MobileDock — the AppRail's `dock` variant wired to the current
 *                session: Home · Products · Pulse (· AI) · Menu. Fixed above the
 *                safe-area at the bottom of small screens; the app shell reserves
 *                `--mobile-rail-offset` so content is never hidden under it.
 *                The Menu chip opens the same drawer as the header's account
 *                button (via the existing `veggat:open-menu` event).
 * @stability     evolving
 */

import * as React from "react";
import { FiMenu } from "react-icons/fi";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getPrimaryNavigation } from "@/components/uicustom/site-navigation";
import { AppRail, RailAction } from "./app-rail";

export function MobileDock() {
  const user = useCurrentUser();
  const items = getPrimaryNavigation(user, "dock");
  return (
    <AppRail id="dock-rail" variant="dock" items={items} aria-label="Primary navigation (mobile)">
      <RailAction
        variant="dock"
        label="Menu"
        icon={FiMenu}
        aria-label="Open menu (mobile)"
        onClick={() => window.dispatchEvent(new Event("veggat:open-menu"))}
      />
    </AppRail>
  );
}

export default MobileDock;
