import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function EventsDirectoryLoading() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <h1 className="font-extrabold text-4xl tracking-tight sm:text-5xl">Events Directory</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-xl">
          Discover all upcoming and past events hosted by GDG Jakarta.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton array
          <Card key={`event-skeleton-${index}`} className="flex flex-col overflow-hidden">
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              <div className="shimmer-wave" aria-hidden="true" />
            </div>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-2/3" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-9 w-full rounded-md" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
