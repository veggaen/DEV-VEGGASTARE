import { CartItemSkeleton, OrderSummarySkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CartLoading() {
  return (
    <div className="flex flex-col lg:flex-row w-full max-w-6xl mx-auto p-4 gap-6">
      {/* Cart items section */}
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        
        {/* Cart items */}
        <div className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <CartItemSkeleton key={i} />
          ))}
        </div>
        
        {/* Continue shopping link */}
        <Skeleton className="h-5 w-40 mt-4" />
      </div>
      
      {/* Order summary sidebar */}
      <div className="lg:w-80">
        <OrderSummarySkeleton />
      </div>
    </div>
  );
}
