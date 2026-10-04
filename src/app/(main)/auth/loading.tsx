import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xs space-y-6">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-44" />
          <Skeleton className="mx-auto h-4 w-60" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
