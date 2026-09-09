import Link from "next/link";

import { format, parseISO } from "date-fns";
import { ArrowRight, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FirestoreEvent } from "@/lib/firestore/types";

interface GDGUpcomingEventsProps {
  events: FirestoreEvent[];
}

export function GDGUpcomingEvents({ events }: GDGUpcomingEventsProps) {
  const _now = new Date();

  // Pick up to 5 upcoming or recent events
  const displayedEvents = events.slice(0, 5);

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
          <div className="py-6 text-center text-muted-foreground text-sm">
            No events found. Click "Sync Bevy Data" to import events.
          </div>
        ) : (
          displayedEvents.map((event) => {
            const _eventDate = new Date();
            let monthStr = "EVENT";
            let dayStr = "—";

            if (event.start_date) {
              try {
                const parsed = parseISO(event.start_date);
                monthStr = format(parsed, "MMM");
                dayStr = format(parsed, "d");
              } catch {
                // Ignore parse errors
              }
            }

            return (
              <div key={event.id} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                    <div className="grid h-1/3 place-items-center border-b bg-muted/60 font-semibold text-[9px] text-muted-foreground uppercase leading-none">
                      {monthStr}
                    </div>
                    <div className="grid h-2/3 place-items-center font-bold text-base leading-none">{dayStr}</div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <Link
                      href={`/dashboard/events`}
                      className="truncate font-medium text-sm leading-tight hover:underline"
                    >
                      {event.title}
                    </Link>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs leading-none">
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {event.total_registrations || event.total_approved || 0} RSVPs
                      </span>
                      <span>•</span>
                      <span>{event.is_virtual ? "Virtual" : "In-Person"}</span>
                    </div>
                  </div>
                </div>

                <Badge variant="outline" className="shrink-0 rounded-md px-2 py-0.5 font-medium text-[10px]">
                  {event.status}
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
