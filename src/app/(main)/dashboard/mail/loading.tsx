import { Skeleton } from "@/components/ui/skeleton";

export default function MailLoading() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="size-8 rounded-md" />
      </div>
      <div className="flex flex-1 rounded-xl border bg-card overflow-hidden">
        <div className="w-64 border-r p-4 space-y-3">
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      </div>
    </div>
  );
}
