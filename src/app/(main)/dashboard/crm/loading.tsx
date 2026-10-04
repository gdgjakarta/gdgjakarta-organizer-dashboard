import { Skeleton } from "@/components/ui/skeleton";

export default function CrmLoading() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton array
          <div key={`crm-kpi-${i}`} className="rounded-xl border bg-card p-5 shadow-xs">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-20" />
            <Skeleton className="mt-2 h-3.5 w-32" />
          </div>
        ))}
      </div>

      {/* Pipeline Activity Skeleton */}
      <div className="rounded-xl border bg-card p-6 shadow-xs">
        <Skeleton className="mb-4 h-6 w-44" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>

      {/* Task Reminders Skeleton */}
      <div className="rounded-xl border bg-card p-6 shadow-xs">
        <Skeleton className="mb-4 h-6 w-36" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
