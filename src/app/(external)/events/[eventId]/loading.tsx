import { Skeleton } from "@/components/ui/skeleton";

export default function PublicEventDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-8">
          {/* Header Skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-28 rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>

            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>

            <Skeleton className="h-10 w-3/4 rounded-lg" />
            <Skeleton className="h-6 w-1/2 rounded-lg" />

            <div className="flex items-center gap-3 pt-2">
              <Skeleton className="size-10 rounded-xl" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          </div>

          {/* Hero Banner Skeleton */}
          <Skeleton className="aspect-[16/9] w-full rounded-2xl sm:aspect-[21/9]" />

          {/* Quick Info Cards Skeleton */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl sm:col-span-2 lg:col-span-1" />
          </div>

          {/* Tabs Skeleton */}
          <div className="space-y-4 pt-4">
            <div className="flex gap-4 border-b pb-3">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="lg:col-span-4">
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
