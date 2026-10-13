"use server";

import { format, parseISO } from "date-fns";

import { getAllBevyChapterEvents } from "@/lib/bevy/client";

export interface PublishedEventOption {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  formattedDate: string; // e.g., "FRIDAY, OCT 23, 2026"
  formattedTime: string; // e.g., "10:00 AM"
  thumbnailUrl?: string;
  bannerUrl?: string;
  venueName?: string;
  venueAddress?: string;
  url?: string;
  descriptionShort?: string;
  isVirtual?: boolean;
}

/**
 * Server action to fetch events that are published and ready for communications.
 * Merges Bevy chapter events with any local Firestore event extensions.
 */
export async function fetchPublishedEventsAction(): Promise<{
  success: boolean;
  events: PublishedEventOption[];
  error?: string;
}> {
  try {
    // 1. Fetch all Bevy events (including hidden events)
    const { results: bevyEvents } = await getAllBevyChapterEvents(undefined, true, "All");

    // 2. Return all chapter events with no filter
    const allEvents = bevyEvents.filter((e) => Boolean(e.id));

    // 3. Map to unified format
    const events: PublishedEventOption[] = allEvents.map((bevy) => {
      const idStr = String(bevy.id);

      let formattedDate = "DATE TBD";
      let formattedTime = "";
      const rawStart = bevy.start_date || "";

      if (rawStart) {
        try {
          const parsed = parseISO(rawStart);
          // Uppercase date format matching Bevy UI: "FRIDAY, OCT 23, 2026"
          formattedDate = format(parsed, "EEEE, MMM dd, yyyy").toUpperCase();
          formattedTime = format(parsed, "hh:mm a");
        } catch {
          formattedDate = rawStart.toUpperCase();
        }
      }

      const thumbnailUrl = bevy.picture?.thumbnail_url || bevy.picture?.url || bevy.cropped_picture_url || "";

      const bannerUrl = bevy.banner?.url || bevy.picture?.url || thumbnailUrl;

      const venueName = bevy.venue_name || (bevy.is_virtual_event ? "Virtual / Online" : "Jakarta, Indonesia");
      const venueAddress = bevy.venue_address || "";
      const eventUrl =
        bevy.url || bevy.static_url || `https://gdg.community.dev/events/details/google-gdg-jakarta-${idStr}/`;

      return {
        id: idStr,
        title: bevy.title || "Untitled Event",
        startDate: rawStart,
        endDate: bevy.end_date || "",
        formattedDate,
        formattedTime,
        thumbnailUrl,
        bannerUrl,
        venueName,
        venueAddress,
        url: eventUrl,
        descriptionShort: bevy.description_short || "",
        isVirtual: Boolean(bevy.is_virtual_event),
      };
    });

    // Sort by start date (descending, latest / upcoming first)
    events.sort((a, b) => {
      const timeA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const timeB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return timeB - timeA;
    });

    return {
      success: true,
      events,
    };
  } catch (error) {
    console.error("[fetchPublishedEventsAction] Error fetching published events:", error);
    return {
      success: false,
      events: [],
      error: error instanceof Error ? error.message : "Failed to fetch published events.",
    };
  }
}
