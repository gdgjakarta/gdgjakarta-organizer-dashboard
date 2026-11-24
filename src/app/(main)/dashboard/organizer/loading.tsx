import { Skeleton } from "@/components/ui/skeleton";

const KPI_KEYS = ["kpi-1", "kpi-2", "kpi-3"];
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

      {/* KPI Cards Skeleton (3 cards matching GDGKpiCards) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {KPI_KEYS.map((key) => (
          <div key={key} className="rounded-xl bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-sm" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="ml-auto h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left Column: Full-height Events Skeleton */}
        <div className="flex flex-col xl:col-span-7">
          <div className="h-full rounded-xl bg-card p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-3">
              {EVENT_ROW_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-4 rounded-lg border p-3">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Organizers + Referral Leaderboard Skeleton */}
        <div className="flex flex-col gap-5 xl:col-span-5">
          <div className="rounded-xl bg-card p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-3">
              {MEMBER_ROW_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-card p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* Bottom Full-Width Analytics Hub Skeleton */}
        <div className="rounded-xl bg-card p-6 shadow-xs xl:col-span-12">
          <div className="mb-4 space-y-2">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-3.5 w-72" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-56" />
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
          <Skeleton className="mt-4 h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
