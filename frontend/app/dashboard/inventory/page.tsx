/**
 * @fileOverview  Legacy redirect — /dashboard/inventory → /dashboard/trading
 * @stability     deprecated (use /dashboard/trading instead)
 */

import { redirect } from "next/navigation";

export default function InventoryPage() {
  redirect("/dashboard/trading");
}

