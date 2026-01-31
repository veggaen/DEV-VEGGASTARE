import { FeedSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto p-4 space-y-4">
      {/* Create post input skeleton */}
      <div className="flex items-center space-x-3 p-4 border rounded-lg">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-10 flex-1 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
      
      {/* Feed posts */}
      <FeedSkeleton count={5} />
    </div>
  );
}
