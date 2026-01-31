import { cn } from "@/lib/utils";

/**
 * A flexible skeleton placeholder component for loading states.
 * Use this to show the shape of content while data is being fetched.
 */

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  );
}

// Pre-built skeleton patterns for common use cases

/**
 * Skeleton for a product card in grid view
 */
function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col space-y-3", className)}>
      {/* Image placeholder */}
      <Skeleton className="h-48 w-full rounded-lg" />
      {/* Title */}
      <Skeleton className="h-4 w-3/4" />
      {/* Price */}
      <Skeleton className="h-4 w-1/2" />
      {/* Category badge */}
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}

/**
 * Skeleton for a product list/grid
 */
function ProductGridSkeleton({ 
  count = 8, 
  className 
}: { 
  count?: number; 
  className?: string;
}) {
  return (
    <div className={cn(
      "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",
      className
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for user profile card
 */
function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col space-y-4 p-4", className)}>
      <div className="flex items-center space-x-4">
        {/* Avatar */}
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          {/* Name */}
          <Skeleton className="h-5 w-32" />
          {/* Username/email */}
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      {/* Bio */}
      <Skeleton className="h-20 w-full" />
      {/* Stats row */}
      <div className="flex space-x-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

/**
 * Skeleton for company/organization card
 */
function CompanySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col space-y-4 p-4", className)}>
      {/* Banner */}
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="flex items-start space-x-4">
        {/* Logo */}
        <Skeleton className="h-20 w-20 rounded-lg -mt-10" />
        <div className="space-y-2 flex-1">
          {/* Company name */}
          <Skeleton className="h-6 w-48" />
          {/* Description */}
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for warehouse card
 */
function WarehouseSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col space-y-3 p-4 border rounded-lg", className)}>
      {/* Location header */}
      <div className="flex items-center space-x-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-40" />
      </div>
      {/* Address */}
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      {/* Stats */}
      <div className="flex space-x-4 pt-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}

/**
 * Skeleton for feed/post card
 */
function FeedPostSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col space-y-3 p-4 border rounded-lg", className)}>
      {/* Author header */}
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* Content */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {/* Actions */}
      <div className="flex space-x-4 pt-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton for feed list
 */
function FeedSkeleton({ 
  count = 5, 
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <FeedPostSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for a data table row
 */
function TableRowSkeleton({ 
  columns = 5, 
  className 
}: { 
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center space-x-4 p-4", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4",
            i === 0 ? "w-8" : i === 1 ? "w-40" : "w-24"
          )} 
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for a full table
 */
function TableSkeleton({ 
  rows = 5, 
  columns = 5, 
  className 
}: { 
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col divide-y", className)}>
      {/* Header */}
      <TableRowSkeleton columns={columns} className="bg-muted/50" />
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}

/**
 * Skeleton for cart items
 */
function CartItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center space-x-4 p-4", className)}>
      <Skeleton className="h-20 w-20 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex items-center space-x-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-12" />
        <Skeleton className="h-8 w-8" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  );
}

/**
 * Skeleton for order summary
 */
function OrderSummarySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col space-y-4 p-4 border rounded-lg", className)}>
      <Skeleton className="h-6 w-32" />
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

/**
 * Full page loading skeleton with centered content
 */
function PageLoadingSkeleton({ 
  message = "Loading...",
  className 
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-[60vh] space-y-4",
      className
    )}>
      <div className="relative">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
      <p className="text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
}

export { 
  Skeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  ProfileSkeleton,
  CompanySkeleton,
  WarehouseSkeleton,
  FeedPostSkeleton,
  FeedSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  CartItemSkeleton,
  OrderSummarySkeleton,
  PageLoadingSkeleton,
};
