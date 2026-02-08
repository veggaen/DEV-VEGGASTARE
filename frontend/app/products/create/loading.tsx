import { Skeleton } from "@/components/ui/skeleton";

export default function CreateProductLoading() {
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 py-3 pb-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          {/* Header skeleton */}
          <header>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-6 w-48 rounded-full" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
          </header>

          {/* Form card skeleton */}
          <div className="relative rounded-xl border border-border bg-card shadow-sm">
            <div className="p-3 sm:p-4 md:p-6 space-y-6">
              {/* Form sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-10 w-full" />
                  
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-24 w-full" />
                  
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                
                {/* Right column */}
                <div className="space-y-4">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-10 w-full" />
                  
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-10 w-full" />
                  
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              
              {/* Image upload area skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-5 w-20" />
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              </div>
              
              {/* Address section skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              {/* Submit button skeleton */}
              <div className="flex justify-end pt-4">
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
