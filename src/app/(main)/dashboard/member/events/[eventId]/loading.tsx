import { Skeleton } from "@/components/ui/skeleton";

export default function MemberEventDetailLoading() {
  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Back button */}
      <Skeleton className="h-4 w-28" />

      {/* Banner */}
      <div className="overflow-hidden rounded-xl bg-card shadow-xs">
        <Skeleton className="aspect-21/9 w-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Skeleton className="h-8 w-3/4" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="rounded-xl bg-card p-6 shadow-xs space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
