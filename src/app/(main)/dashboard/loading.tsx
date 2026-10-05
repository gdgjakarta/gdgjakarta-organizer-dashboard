import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_CARDS = ["card-1", "card-2", "card-3", "card-4"];
const SKELETON_ROWS = ["row-1", "row-2", "row-3", "row-4"];

export default function DashboardRootLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SKELETON_CARDS.map((key) => (
          <div key={key} className="rounded-xl bg-card p-5 shadow-xs">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-card p-6 shadow-xs">
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="space-y-3">
          {SKELETON_ROWS.map((key) => (
            <Skeleton key={key} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
