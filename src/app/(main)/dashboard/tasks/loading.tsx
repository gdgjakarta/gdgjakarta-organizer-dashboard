import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex items-center justify-between gap-4 py-2">
        <Skeleton className="h-9 w-64" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex h-11 items-center border-b bg-muted/40 px-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="ml-4 h-4 w-20" />
          <Skeleton className="ml-8 h-4 w-48" />
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="ml-8 h-4 w-20" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton array
            <div key={`task-skeleton-${i}`} className="flex h-14 items-center px-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="ml-4 h-4 w-16" />
              <Skeleton className="ml-8 h-4 w-60" />
              <Skeleton className="ml-auto h-6 w-20 rounded-full" />
              <Skeleton className="ml-8 h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
