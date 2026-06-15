/**
 * @fileOverview  Dashboard layout — dock-aware wrapper that positions the sidebar
 *                on any edge (left, right, top, bottom) based on user preference.
 * @stability     evolving
 */

import { DashboardDockProvider } from "@/contexts/dashboard-dock-context";
import { DashboardShell } from "@/components/uicustom/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardDockProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardDockProvider>
  );
}