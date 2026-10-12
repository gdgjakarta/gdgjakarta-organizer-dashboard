"use server";

import { format, parseISO } from "date-fns";

import { getAllBevyChapterEvents } from "@/lib/bevy/client";
import { getFirestoreEvents } from "@/lib/firestore/client";

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
    // 1. Fetch all Bevy events
    const { results: bevyEvents } = await getAllBevyChapterEvents(undefined, false, "All");

    // 2. Fetch Firestore events to ensure any Firestore-first events or extra metadata are present
    let firestoreEvents: Awaited<ReturnType<typeof getFirestoreEvents>> = [];
    try {
      firestoreEvents = await getFirestoreEvents(100);
    } catch (fsError) {
      console.warn("[fetchPublishedEventsAction] Firestore events fetch warning:", fsError);
    }

    const firestoreMap = new Map(firestoreEvents.map((e) => [String(e.id), e]));

    // 3. Filter strictly for published events
    const publishedBevy = (bevyEvents || []).filter((e) => {
      const status = (e.status || "").toLowerCase();
      // An event is published if status is "published" or not draft/canceled
      return (
        status === "published" ||
        (!e.is_hidden && status !== "draft" && status !== "canceled" && status !== "cancelled")
      );
    });

    // 4. Map to unified format
    const events: PublishedEventOption[] = publishedBevy.map((bevy) => {
      const idStr = String(bevy.id);
      const fs = firestoreMap.get(idStr);

      let formattedDate = "DATE TBD";
      let formattedTime = "";
      const rawStart = bevy.start_date || fs?.start_date || "";

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

      const thumbnailUrl =
        bevy.picture?.thumbnail_url ||
        bevy.picture?.url ||
        fs?.picture?.thumbnail_url ||
        fs?.picture?.url ||
        bevy.cropped_picture_url ||
        fs?.cropped_picture_url ||
        "";

      const bannerUrl =
        bevy.banner?.url || bevy.picture?.url || fs?.banner?.url || fs?.banner_url || fs?.picture_url || thumbnailUrl;

      const venueName =
        bevy.venue_name || fs?.venue?.name || (bevy.is_virtual_event ? "Virtual / Online" : "Jakarta, Indonesia");
      const venueAddress = bevy.venue_address || fs?.venue?.address || "";
      const eventUrl =
        bevy.url ||
        bevy.static_url ||
        fs?.url ||
        `https://gdg.community.dev/events/details/google-gdg-jakarta-${idStr}/`;

      return {
        id: idStr,
        title: bevy.title || fs?.title || "Untitled Event",
        startDate: rawStart,
        endDate: bevy.end_date || fs?.end_date || "",
        formattedDate,
        formattedTime,
        thumbnailUrl,
        bannerUrl,
        venueName,
        venueAddress,
        url: eventUrl,
        descriptionShort: bevy.description_short || fs?.description_short || "",
        isVirtual: Boolean(bevy.is_virtual_event || fs?.is_virtual),
      };
    });

    // Also include any Firestore events that have status === "Published" but aren't in Bevy list
    for (const fs of firestoreEvents) {
      const idStr = String(fs.id);
      if (fs.status === "Published" && !events.some((e) => e.id === idStr)) {
        let formattedDate = "DATE TBD";
        let formattedTime = "";
        if (fs.start_date) {
          try {
            const parsed = parseISO(fs.start_date);
            formattedDate = format(parsed, "EEEE, MMM dd, yyyy").toUpperCase();
            formattedTime = format(parsed, "hh:mm a");
          } catch {
            formattedDate = fs.start_date.toUpperCase();
          }
        }

        events.push({
          id: idStr,
          title: fs.title || "Untitled Event",
          startDate: fs.start_date || "",
          endDate: fs.end_date || "",
          formattedDate,
          formattedTime,
          thumbnailUrl: fs.picture?.thumbnail_url || fs.picture_url || "",
          bannerUrl: fs.banner_url || fs.picture_url || "",
          venueName: fs.venue?.name || "Jakarta, Indonesia",
          venueAddress: fs.venue?.address || "",
          url: fs.url || "",
          descriptionShort: fs.description_short || "",
          isVirtual: Boolean(fs.is_virtual),
        });
      }
    }

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
