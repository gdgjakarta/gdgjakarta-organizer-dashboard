import { Skeleton } from "@/components/ui/skeleton";

export default function ExternalHomeLoading() {
  return (
    <div className="flex flex-col gap-12 pb-16">
      {/* Hero Section Skeleton */}
      <section className="relative overflow-hidden bg-background px-4 pt-16 pb-12 sm:px-6 lg:px-8">
        <div className="container mx-auto flex flex-col items-center text-center">
          <Skeleton className="mb-4 h-6 w-32 rounded-full" />
          <Skeleton className="mb-4 h-12 w-3/4 max-w-2xl sm:h-16" />
          <Skeleton className="mb-6 h-5 w-full max-w-xl" />
          <div className="flex flex-wrap justify-center gap-3">
            <Skeleton className="h-11 w-36 rounded-full" />
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
        </div>
      </section>

      {/* Pill Filter Skeleton */}
      <div className="container mx-auto flex justify-center gap-2 px-4">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>

      {/* Featured Events Grid Skeleton */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {["event-sk-1", "event-sk-2", "event-sk-3", "event-sk-4", "event-sk-5", "event-sk-6"].map((skeletonId) => (
            <div key={skeletonId} className="flex flex-col overflow-hidden rounded-xl border bg-card">
              <Skeleton className="aspect-video w-full" />
              <div className="flex flex-1 flex-col p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-3.5 w-1/3" />
                <div className="mt-4 space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
                <div className="mt-6 border-t pt-4">
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
