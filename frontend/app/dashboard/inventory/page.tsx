"use client";

/**
 * @fileOverview  Legacy redirect — /dashboard/inventory → /dashboard/trading
 * @stability     deprecated (use /dashboard/trading instead)
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InventoryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/trading");
  }, [router]);
  return null;
}

