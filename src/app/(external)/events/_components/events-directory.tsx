"use client";

import { useState } from "react";

import { Calendar, ChevronDown, Loader2 } from "lucide-react";

import { EventCardImage } from "@/components/event-card-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BevyEvent } from "@/lib/bevy/types";
import { fetchBevyChapterEventsAction } from "@/server/bevy-actions";

interface EventsDirectoryProps {
  initialEvents: BevyEvent[];
  totalCount: number;
  pageSize?: number;
}

function getAudienceLabel(event: BevyEvent): string {
  if (event.audience_type === "VIRTUAL" || event.is_virtual_event) {
    return "Virtual";
  }
  if (event.audience_type === "HYBRID") {
    return "Hybrid";
  }
  return "In-Person";
}

export function EventsDirectory({ initialEvents, totalCount, pageSize = 15 }: EventsDirectoryProps) {
  const [events, setEvents] = useState<BevyEvent[]>(initialEvents);
  const [page, setPage] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = events.length < totalCount;

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const response = await fetchBevyChapterEventsAction(pageSize, nextPage);

      if (!response?.results) {
        setError("Failed to load more events. Please try again.");
        return;
      }

      const newResults = response.results;
      if (newResults.length === 0) {
        return;
      }

      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => String(e.id)));
        const uniqueNew = newResults.filter((e) => !existingIds.has(String(e.id)));
        return [...prev, ...uniqueNew];
      });

      setPage(nextPage);
    } catch (err) {
      console.error("[EventsDirectory] Error loading more events:", err);
      setError("An unexpected error occurred while loading more events.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (events.length === 0 && !isLoadingMore) {
    return (
      <div className="rounded-xl border border-dashed p-16 text-center">
        <Calendar className="mx-auto mb-4 size-12 text-muted-foreground/50" />
        <h3 className="font-semibold text-xl">No events found</h3>
        <p className="mt-2 text-muted-foreground">Check back later for new activities and meetups.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Events Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {events.map((event) => {
          const imageUrl =
            event.picture?.url ||
            event.picture?.thumbnail_url ||
            event.banner?.url ||
            event.banner?.thumbnail_url ||
            event.cropped_banner_url ||
            event.cropped_picture_url ||
            null;

          let formattedDate = "";
          try {
            formattedDate = new Date(event.start_date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            });
          } catch {
            formattedDate = event.start_date || "Date TBA";
          }

          const audienceLabel = getAudienceLabel(event);

          return (
            <Card
              key={event.id}
              className="flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <EventCardImage src={imageUrl} alt={event.title}>
                <div className="absolute top-3 left-3 z-20 flex gap-1.5">
                  <Badge variant="secondary" className="bg-background/85 text-[10px] backdrop-blur-xs">
                    {audienceLabel}
                  </Badge>
                </div>
              </EventCardImage>

              <CardHeader>
                <CardTitle className="line-clamp-2 text-xl">{event.title}</CardTitle>
                <CardDescription>{formattedDate}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <p className="line-clamp-3 text-muted-foreground text-sm">
                  {event.description_short || "Join us for this exciting GDG Jakarta event!"}
                </p>
              </CardContent>

              <CardFooter>
                <Button variant="secondary" className="w-full cursor-pointer" asChild>
                  {event.url ? (
                    <a href={event.url} target="_blank" rel="noreferrer">
                      View Details
                    </a>
                  ) : (
                    <span>Details Unavailable</span>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}

        {/* Skeleton cards while loading more */}
        {isLoadingMore &&
          Array.from({ length: Math.min(4, pageSize) }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton array
            <Card key={`more-skeleton-${index}`} className="flex flex-col overflow-hidden">
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

      {/* Pagination & Load More Controls */}
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        {/* Progress indicator */}
        <div className="flex flex-col items-center gap-2">
          <p className="font-medium text-muted-foreground text-sm">
            Showing <span className="font-semibold text-foreground">{events.length}</span> of{" "}
            <span className="font-semibold text-foreground">{totalCount}</span> events
          </p>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.round((events.length / Math.max(totalCount, 1)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex flex-col items-center gap-2 text-destructive">
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={handleLoadMore} className="cursor-pointer">
              Try Again
            </Button>
          </div>
        )}

        {/* Action Button */}
        {hasMore ? (
          <Button
            variant="outline"
            size="lg"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="cursor-pointer rounded-full px-8 py-6 font-medium text-base shadow-sm transition-all hover:bg-accent hover:shadow"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" />
                Loading more events...
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 size-5" />
                Load More Events ({Math.min(pageSize, totalCount - events.length)} more)
              </>
            )}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">You&apos;ve reached the end • All {totalCount} events loaded</p>
        )}
      </div>
    </div>
  );
}
