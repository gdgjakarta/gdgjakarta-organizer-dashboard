import { Skeleton } from "@/components/ui/skeleton";

const MEMBER_CARD_KEYS = [
  "event-card-1",
  "event-card-2",
  "event-card-3",
  "event-card-4",
  "event-card-5",
  "event-card-6",
];

export default function MemberDashboardLoading() {
  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Events Grid Skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MEMBER_CARD_KEYS.map((key) => (
          <div key={key} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
            <Skeleton className="aspect-video w-full" />
            <div className="flex flex-1 flex-col p-5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-3.5 w-1/3" />
              <div className="mt-4 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              <div className="mt-6 border-t pt-4">
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
