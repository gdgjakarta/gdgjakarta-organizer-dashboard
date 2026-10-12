import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReferralLeaderboardLoading() {
  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

      {/* Banner Skeleton */}
      <Skeleton className="h-24 w-full rounded-2xl" />

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton cards
          <Card key={i} className="shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="size-4 rounded-full" />
            </CardHeader>
            <CardContent className="space-y-1">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton rows
              <div key={i} className="flex h-14 items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="size-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
                <Skeleton className="h-4 w-20 font-mono" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
