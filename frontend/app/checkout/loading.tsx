import { OrderSummarySkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <div className="flex flex-col lg:flex-row w-full max-w-6xl mx-auto p-4 gap-8">
      {/* Checkout form section */}
      <div className="flex-1 space-y-6">
        {/* Progress steps */}
        <div className="flex items-center justify-between mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center">
              <Skeleton className="h-10 w-10 rounded-full" />
              {i < 3 && <Skeleton className="h-1 w-16 mx-2" />}
            </div>
          ))}
        </div>
        
        {/* Shipping address section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </div>
        
        {/* Payment section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 p-3 border rounded-md">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Order summary sidebar */}
      <div className="lg:w-96 space-y-4">
        <OrderSummarySkeleton />
        
        {/* Items preview */}
        <div className="p-4 border rounded-lg space-y-3">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <Skeleton className="h-16 w-16 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
