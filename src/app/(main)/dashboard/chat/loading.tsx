import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="size-8 rounded-md" />
      </div>
      <div className="flex-1 rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-10 w-64 rounded-xl" />
        </div>
        <div className="flex items-center justify-end gap-3">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="size-10 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-16 w-80 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
