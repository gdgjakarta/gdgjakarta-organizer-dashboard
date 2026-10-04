import { format, isFuture, parseISO } from "date-fns";
import type { Metadata } from "next";

import { getAllBevyChapterEvents } from "@/lib/bevy/client";

import { type EventRow, type EventStatus, fallbackEvents } from "./_components/data";
import { Events } from "./_components/events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  description: "Manage and monitor GDG Jakarta meetups, devlabs, and conferences.",
};

export default async function Page() {
  let eventRows: EventRow[] = [];
  let totalCount: number | undefined;

  try {
    const { results: fetchedEvents, count } = await getAllBevyChapterEvents(undefined, true, "All");
    totalCount = count;

    if (fetchedEvents.length > 0) {
      eventRows = fetchedEvents.map((event) => {
        let startDateFormatted = "TBD";
        let endDateFormatted = "TBD";
        let isUpcomingEvent = false;

        if (event.start_date) {
          try {
            const parsedStart = parseISO(event.start_date);
            startDateFormatted = format(parsedStart, "dd MMM yyyy, h:mm a");
            isUpcomingEvent = isFuture(parsedStart);
          } catch {
            startDateFormatted = event.start_date;
          }
        }

        if (event.end_date) {
          try {
            endDateFormatted = format(parseISO(event.end_date), "dd MMM yyyy, h:mm a");
          } catch {
            endDateFormatted = event.end_date;
          }
        }

        const rawStatus = event.status || (event.completed ? "Completed" : "Published");
        let status: EventStatus = "Published";
        if (rawStatus === "Canceled" || rawStatus === "Cancelled") {
          status = "Canceled";
        } else if (rawStatus === "Draft") {
          status = "Draft";
        } else if (rawStatus === "Completed" || event.completed) {
          status = "Completed";
        } else {
          status = "Published";
        }

        const totalAttendees = event.total_attendees ?? 0;
        const checkinCount = event.checkin_count ?? 0;
        const dropped = Math.max(0, totalAttendees - checkinCount);
        const dropRate = totalAttendees > 0 ? (dropped / totalAttendees) * 100 : undefined;
        const audienceType = event.audience_type ?? (event.is_virtual_event ? "VIRTUAL" : "IN_PERSON");

        return {
          id: event.id,
          title: event.title || "Untitled Event",
          startDate: startDateFormatted,
          endDate: endDateFormatted,
          status,
          eventType: event.event_type_title || "Standard Event",
          audienceType,
          isVirtual: audienceType === "VIRTUAL",
          totalAttendees,
          checkinCount,
          dropRate,
          url: event.url || event.cohost_registration_url,
          staticUrl: event.static_url,
          pictureUrl:
            event.picture?.thumbnail_url ||
            event.picture?.url ||
            event.cropped_picture_url ||
            event.banner?.thumbnail_url ||
            event.banner?.url ||
            event.cropped_banner_url,
          bannerUrl: event.banner?.url || event.cropped_banner_url,
          tags: event.tags || [],
          isUpcoming: isUpcomingEvent,
          isHidden: Boolean(event.is_hidden || (event as { hidden?: boolean }).hidden),
          isTest: Boolean(event.is_test),
        };
      });
    }
  } catch (error) {
    console.error("[Events Page] Error loading events:", error);
  }

  if (eventRows.length === 0) {
    eventRows = fallbackEvents;
  }

  return <Events events={eventRows} totalCount={totalCount} />;
}
