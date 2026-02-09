"use client";

import { useParams } from "next/navigation";
import { useReachTracker } from "@/hooks/use-reach-tracker";

import ProductClient from "./ProductClient";

export default function Page() {
  const { id } = useParams();
  // Catch-all route can include extra segments; treat the last segment as the product id.
  const productId = Array.isArray(id) ? id[id.length - 1] : id;

  // Reach tracking for product pages (scroll, dwell, hover, copy)
  useReachTracker({
    productId: typeof productId === "string" ? productId : undefined,
    trackScroll: true,
    trackHovers: true,
    trackCopy: true,
  });

  if (typeof productId !== "string" || !productId) {
    return (
      <div className="p-6 text-sm text-zinc-600 dark:text-zinc-300">
        Invalid product link.
      </div>
    );
  }

  return <ProductClient productId={productId} />;
  
/* is this proper and good typescript? like best practice? I see this error in vs code:
   Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.ts(2322)
ProductClient.tsx(1158, 56): The expected type comes from property 'productId' which is declared here on type 'IntrinsicAttributes & { productId: string; }'
(property) productId: string */
}
