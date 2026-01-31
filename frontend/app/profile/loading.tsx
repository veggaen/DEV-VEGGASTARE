import { ProfileSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto p-4 space-y-6">
      {/* Profile header */}
      <div className="relative">
        {/* Banner */}
        <Skeleton className="h-48 w-full rounded-lg" />
        
        {/* Avatar and basic info */}
        <div className="relative px-6 -mt-16">
          <div className="flex items-end space-x-4">
            <Skeleton className="h-32 w-32 rounded-full border-4 border-background" />
            <div className="pb-4 space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Bio section */}
      <div className="px-6 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      
      {/* Stats */}
      <div className="flex justify-center space-x-8 py-4 border-y">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center space-y-1">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      
      {/* Tabs */}
      <div className="flex space-x-4 border-b pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      
      {/* Content placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
