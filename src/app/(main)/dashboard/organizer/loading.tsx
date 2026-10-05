import { Skeleton } from "@/components/ui/skeleton";

const KPI_KEYS = ["kpi-1", "kpi-2", "kpi-3", "kpi-4"];
const EVENT_ROW_KEYS = ["event-1", "event-2", "event-3", "event-4"];
const MEMBER_ROW_KEYS = ["member-1", "member-2", "member-3", "member-4", "member-5"];

export default function OrganizerDashboardLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 sm:w-80" />
          <Skeleton className="h-4 w-72 sm:w-96" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_KEYS.map((key) => (
          <div key={key} className="rounded-xl bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="mt-4 space-y-1">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left Column: Events Table Skeleton */}
        <div className="rounded-xl bg-card p-6 shadow-xs xl:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-48" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="space-y-3">
            {EVENT_ROW_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-4 rounded-lg border p-3">
                <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Members Widget Skeleton */}
        <div className="rounded-xl bg-card p-6 shadow-xs xl:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3.5 w-40" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="space-y-3">
            {MEMBER_ROW_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-3 rounded-lg border p-2.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
