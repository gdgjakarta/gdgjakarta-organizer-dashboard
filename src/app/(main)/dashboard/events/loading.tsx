import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const TABLE_ROW_KEYS = ["event-row-1", "event-row-2", "event-row-3", "event-row-4", "event-row-5", "event-row-6"];

export default function DashboardEventsLoading() {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <CardAction className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>

        {/* Table Skeleton */}
        <div className="border-y">
          <div className="flex h-10 items-center border-b bg-muted/40 px-4">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="ml-4 h-4 w-40" />
            <Skeleton className="ml-auto hidden h-4 w-28 sm:block" />
            <Skeleton className="ml-12 hidden h-4 w-20 md:block" />
            <Skeleton className="ml-12 h-4 w-12" />
          </div>
          <div className="divide-y">
            {TABLE_ROW_KEYS.map((key) => (
              <div key={key} className="flex h-16 items-center px-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="ml-4 h-11 w-16 shrink-0 rounded-md" />
                <div className="ml-3 space-y-1">
                  <Skeleton className="h-4 w-48 sm:w-64" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="ml-auto hidden h-6 w-20 rounded-full sm:block" />
                <Skeleton className="ml-12 hidden h-4 w-28 md:block" />
                <Skeleton className="ml-12 h-8 w-8 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pt-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
