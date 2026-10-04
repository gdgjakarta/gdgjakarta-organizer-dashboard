import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const MEMBER_ROW_KEYS = [
  "member-row-1",
  "member-row-2",
  "member-row-3",
  "member-row-4",
  "member-row-5",
  "member-row-6",
  "member-row-7",
  "member-row-8",
];

export default function DashboardMembersLoading() {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-60" />
        </div>
        <CardAction className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>

        {/* Table Skeleton */}
        <div className="border-y">
          <div className="flex h-10 items-center border-b bg-muted/40 px-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="ml-4 h-4 w-32" />
            <Skeleton className="ml-auto hidden h-4 w-28 sm:block" />
            <Skeleton className="ml-12 hidden h-4 w-20 md:block" />
            <Skeleton className="ml-12 h-4 w-12" />
          </div>
          <div className="divide-y">
            {MEMBER_ROW_KEYS.map((key) => (
              <div key={key} className="flex h-14 items-center px-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="ml-4 h-9 w-9 shrink-0 rounded-full" />
                <div className="ml-3 space-y-1">
                  <Skeleton className="h-4 w-40 sm:w-52" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="ml-auto hidden h-6 w-16 rounded-full sm:block" />
                <Skeleton className="ml-12 hidden h-4 w-24 md:block" />
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
