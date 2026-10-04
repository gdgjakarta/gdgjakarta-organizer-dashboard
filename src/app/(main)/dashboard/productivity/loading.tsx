import { Skeleton } from "@/components/ui/skeleton";

export default function ProductivityLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="space-y-6 lg:col-span-9">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-xs space-y-4">
          <Skeleton className="h-6 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </section>
      <section className="space-y-6 lg:col-span-3">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </section>
    </div>
  );
}
