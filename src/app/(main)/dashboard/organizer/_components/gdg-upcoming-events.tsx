import Link from "next/link";

import { format, isFuture, parseISO } from "date-fns";
import { ArrowRight, Globe, MapPin, Radio, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface GDGUpcomingEventsProps {
  events: FirestoreEvent[];
}

function AudienceBadge({ audienceType }: { audienceType?: string }) {
  const type = (audienceType ?? "").toUpperCase();

  if (type === "VIRTUAL") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
      >
        <Radio className="size-3" /> Virtual
      </Badge>
    );
  }

  if (type === "HYBRID") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
      >
        <Globe className="size-3" /> Hybrid
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <MapPin className="size-3" /> In-Person
    </Badge>
  );
}

function DropRateBadge({
  totalAttendees,
  checkinCount,
  isUpcoming,
}: {
  totalAttendees: number;
  checkinCount: number;
  isUpcoming: boolean;
}) {
  if (totalAttendees <= 0 || (isUpcoming && checkinCount === 0)) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const dropped = Math.max(0, totalAttendees - checkinCount);
  const dropRate = (dropped / totalAttendees) * 100;
  const formattedRate = `${dropRate % 1 === 0 ? dropRate.toFixed(0) : dropRate.toFixed(1)}%`;

  let badgeStyle = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (dropRate > 60) {
    badgeStyle = "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  } else if (dropRate > 35) {
    badgeStyle = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Badge variant="outline" className={cn("shrink-0 px-1.5 py-0 font-medium text-xs tabular-nums", badgeStyle)}>
        {formattedRate}
      </Badge>
      <span className="text-muted-foreground text-xs tabular-nums">({dropped} no-show)</span>
    </div>
  );
}

export function GDGUpcomingEvents({ events }: GDGUpcomingEventsProps) {
  // Pick up to 5 upcoming or recent published non-test events (including hidden events)
  const displayedEvents = events
    .filter(
      (e) =>
        !e.is_test &&
        !/^\s*(\[test\]|\(test\)|test:)/i.test(e.title || "") &&
        (e.status ? e.status.toLowerCase() === "published" || e.status === "Completed" : true),
    )
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Recent & Upcoming Events</CardTitle>
        <CardAction>
          <Link
            href="/dashboard/events"
            className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
          >
            All Events <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {displayedEvents.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">No upcoming events found.</div>
        ) : (
          displayedEvents.map((event) => {
            let monthStr = "EVENT";
            let dayStr = "—";
            let isUpcoming = false;

            if (event.start_date) {
              try {
                const parsed = parseISO(event.start_date);
                monthStr = format(parsed, "MMM");
                dayStr = format(parsed, "d");
                isUpcoming = event.status !== "Completed" && isFuture(parsed);
              } catch {
                // Ignore parse errors
              }
            }

            const totalAttendees =
              event.total_registrations ||
              event.total_approved ||
              (event as { total_attendees?: number }).total_attendees ||
              0;
            const checkinCount = event.total_checked_in ?? (event as { checkin_count?: number }).checkin_count ?? 0;

            return (
              <div key={event.id} className="flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                    <div className="grid h-1/3 place-items-center border-b bg-muted/60 font-semibold text-[9px] text-muted-foreground uppercase leading-none">
                      {monthStr}
                    </div>
                    <div className="grid h-2/3 place-items-center font-bold text-base leading-none">{dayStr}</div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <Link
                      href={event.id ? `/dashboard/events/${event.id}` : "/dashboard/events"}
                      className="truncate font-medium text-sm leading-tight hover:underline"
                      title={event.title}
                    >
                      {event.title}
                    </Link>
                    <div className="flex items-center gap-2">
                      <AudienceBadge audienceType={event.audience_type} />
                      {event.is_hidden ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
                        >
                          Hidden
                        </Badge>
                      ) : null}
                      {event.is_test ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-purple-500/20 bg-purple-500/10 px-1.5 py-0 text-[10px] text-purple-600 dark:text-purple-400"
                        >
                          Test
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users className="size-3.5 text-muted-foreground" />
                    <span className="font-medium text-foreground">{totalAttendees}</span>
                    {checkinCount > 0 ? (
                      <span className="text-muted-foreground text-xs">({checkinCount} checked in)</span>
                    ) : null}
                  </div>

                  <DropRateBadge totalAttendees={totalAttendees} checkinCount={checkinCount} isUpcoming={isUpcoming} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
