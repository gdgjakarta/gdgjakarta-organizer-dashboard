"use client";

import { useId, useMemo, useState } from "react";

import Link from "next/link";

import { Calendar, ChevronDown, Loader2, Search, X } from "lucide-react";

import { EventCardImage } from "@/components/event-card-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveEventAudience } from "@/lib/bevy/audience";
import type { BevyEvent } from "@/lib/bevy/types";
import { fetchBevyChapterEventsAction } from "@/server/bevy-actions";

interface EventsDirectoryProps {
  initialEvents: BevyEvent[];
  totalCount: number;
  pageSize?: number;
}

function getAudienceLabel(event: BevyEvent): string {
  const { label } = resolveEventAudience(event.audience_type, event.is_virtual_event);
  return label;
}

function isPubliclyVisibleEvent(event: BevyEvent): boolean {
  const isPublished = event.status ? event.status.toLowerCase() === "published" : true;
  const isHidden = Boolean(event.is_hidden || (event as { hidden?: boolean }).hidden);
  return isPublished && !isHidden && !event.is_test;
}

export function EventsDirectory({ initialEvents, totalCount, pageSize = 15 }: EventsDirectoryProps) {
  const searchInputId = useId();
  const [events, setEvents] = useState<BevyEvent[]>(() => initialEvents.filter(isPubliclyVisibleEvent));
  const [allEvents, setAllEvents] = useState<BevyEvent[] | null>(null);
  const [total, setTotal] = useState<number>(totalCount);
  const [page, setPage] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isSearchingAll, setIsSearchingAll] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const cleanQuery = searchQuery.trim().toLowerCase();

  // Lazy-load all remaining events in background when user types a search query
  const ensureAllEventsLoaded = async () => {
    if (allEvents || isSearchingAll || events.length >= total) return;
    setIsSearchingAll(true);
    try {
      const response = await fetchBevyChapterEventsAction(100, 1, false, "Published");
      if (response?.results) {
        const fullList = response.results.filter(isPubliclyVisibleEvent);
        setAllEvents(fullList);
        setTotal(Math.max(fullList.length, total));
      }
    } catch (err) {
      console.warn("[EventsDirectory] Could not preload full events list for search:", err);
    } finally {
      setIsSearchingAll(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim() && !allEvents && events.length < total) {
      void ensureAllEventsLoaded();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const poolToFilter = allEvents ?? events;

  const filteredEvents = useMemo(() => {
    if (!cleanQuery) return events;
    return poolToFilter.filter((event) => {
      const titleMatch = event.title?.toLowerCase().includes(cleanQuery);
      const shortDescMatch = event.description_short?.toLowerCase().includes(cleanQuery);
      const descMatch = event.description?.toLowerCase().includes(cleanQuery);
      const venueMatch =
        event.venue_name?.toLowerCase().includes(cleanQuery) ||
        event.venue_city?.toLowerCase().includes(cleanQuery) ||
        event.venue_address?.toLowerCase().includes(cleanQuery);
      const typeMatch = event.event_type_title?.toLowerCase().includes(cleanQuery);
      const audienceMatch = getAudienceLabel(event).toLowerCase().includes(cleanQuery);
      const tagMatch = Array.isArray(event.tags) && event.tags.some((t) => t?.toLowerCase().includes(cleanQuery));

      return titleMatch || shortDescMatch || descMatch || venueMatch || typeMatch || audienceMatch || tagMatch;
    });
  }, [cleanQuery, events, poolToFilter]);

  const hasMore = !cleanQuery && events.length < total;

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const response = await fetchBevyChapterEventsAction(pageSize, nextPage, false, "Published");

      if (!response?.results) {
        setError("Failed to load more events. Please try again.");
        return;
      }

      const hasNextPage = Boolean(response.pagination?.next_page);
      const newResults = response.results.filter(isPubliclyVisibleEvent);
      if (newResults.length === 0 && !hasNextPage) {
        setTotal(events.length);
        return;
      }

      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => String(e.id)));
        const uniqueNew = newResults.filter((e) => !existingIds.has(String(e.id)));
        const nextEvents = [...prev, ...uniqueNew];
        if (!hasNextPage) {
          setTotal(nextEvents.length);
        } else if (typeof response.count === "number" && response.count < total) {
          setTotal(response.count);
        }
        return nextEvents;
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
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="mx-auto max-w-xl">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id={searchInputId}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search events by name, topic, or venue..."
            className="h-11 rounded-full border-muted-foreground/20 bg-background/80 pr-10 pl-10 text-sm shadow-xs backdrop-blur-xs transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Search events"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3.5 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {cleanQuery && (
          <div className="mt-2.5 px-2 text-muted-foreground text-xs">
            <span>
              {filteredEvents.length === 0
                ? "No matching events"
                : `Found ${filteredEvents.length} event${filteredEvents.length === 1 ? "" : "s"}`}
              {isSearchingAll ? " (searching full directory...)" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Zero State for Search Filter */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Search className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <h3 className="font-semibold text-lg">No events found</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            We couldn&apos;t find any events matching &quot;{searchQuery}&quot;.
          </p>
          <Button variant="outline" size="sm" onClick={handleClearSearch} className="mt-4 cursor-pointer">
            Clear Search
          </Button>
        </div>
      ) : (
        /* Events Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredEvents.map((event, index) => {
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
                timeZone: "Asia/Jakarta",
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
                <EventCardImage
                  src={imageUrl}
                  alt={event.title}
                  priority={index < 4}
                  loading={index < 4 ? "eager" : "lazy"}
                >
                  <div className="absolute top-3 left-3 z-20 flex gap-1.5">
                    <Badge variant="secondary" className="bg-background/85 text-[10px] backdrop-blur-xs">
                      {audienceLabel}
                    </Badge>
                    {event.is_test ? (
                      <Badge
                        variant="outline"
                        className="border-purple-500/30 bg-purple-500/20 text-[10px] text-purple-700 backdrop-blur-xs dark:text-purple-300"
                      >
                        Test
                      </Badge>
                    ) : null}
                  </div>
                </EventCardImage>

                <CardHeader>
                  <Link href={`/events/${event.id}`} className="group/title">
                    <CardTitle className="line-clamp-2 text-xl transition-colors group-hover/title:text-primary">
                      {event.title}
                    </CardTitle>
                  </Link>
                  <CardDescription>{formattedDate}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <p className="line-clamp-3 text-muted-foreground text-sm">
                    {event.description_short || "Join us for this exciting GDG Jakarta event!"}
                  </p>
                </CardContent>

                <CardFooter>
                  <Button variant="secondary" className="w-full cursor-pointer" asChild>
                    <Link href={`/events/${event.id}`}>View Details</Link>
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
      )}

      {/* Pagination & Load More Controls (shown when not searching) */}
      {!cleanQuery && (
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          {/* Progress indicator */}
          <div className="flex flex-col items-center gap-2">
            <p className="font-medium text-muted-foreground text-sm">
              Showing <span className="font-semibold text-foreground">{events.length}</span> of{" "}
              <span className="font-semibold text-foreground">{total}</span> events
            </p>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round((events.length / Math.max(total, 1)) * 100))}%`,
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
                  Load More Events ({Math.min(pageSize, total - events.length)} more)
                </>
              )}
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              You&apos;ve reached the end • All {events.length} events loaded
            </p>
          )}
        </div>
      )}
    </div>
  );
}
