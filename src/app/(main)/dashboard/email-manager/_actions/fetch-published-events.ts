"use server";

import { format, parseISO } from "date-fns";

import { getAllBevyChapterEvents } from "@/lib/bevy/client";

import {
  buildDefaultEventPlaceholders,
  type EventDynamicPlaceholders,
  type PublishedEventOption,
} from "../_types/placeholders";

export { buildDefaultEventPlaceholders, type EventDynamicPlaceholders, type PublishedEventOption };

interface EventsCacheEntry {
  events: PublishedEventOption[];
  fetchedAt: number;
}

let cachedEventsEntry: EventsCacheEntry | null = null;
let inFlightEventsPromise: Promise<{
  success: boolean;
  events: PublishedEventOption[];
  error?: string;
  fromCache?: boolean;
}> | null = null;

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

interface DetailCacheEntry {
  event: PublishedEventOption;
  placeholders: EventDynamicPlaceholders;
  fetchedAt: number;
}

const cachedEventDetails = new Map<string, DetailCacheEntry>();

/**
 * Server action to fetch events that are published and ready for communications.
 * Merges Bevy chapter events with in-memory caching and optional forceRefresh flag.
 */
export async function fetchPublishedEventsAction(options?: { forceRefresh?: boolean }): Promise<{
  success: boolean;
  events: PublishedEventOption[];
  error?: string;
  fromCache?: boolean;
}> {
  const now = Date.now();

  // Return cached events if fresh and forceRefresh was not requested
  if (!options?.forceRefresh && cachedEventsEntry && now - cachedEventsEntry.fetchedAt < CACHE_TTL_MS) {
    return {
      success: true,
      events: cachedEventsEntry.events,
      fromCache: true,
    };
  }

  // Deduplicate concurrent in-flight requests when not forcing refresh
  if (!options?.forceRefresh && inFlightEventsPromise) {
    return inFlightEventsPromise;
  }

  const fetchPromise = (async () => {
    try {
      // 1. Fetch all Bevy events (including hidden events)
      const { results: bevyEvents } = await getAllBevyChapterEvents(undefined, true, "All");

      // 2. Return all chapter events with no filter
      const allEvents = bevyEvents.filter((e) => Boolean(e.id));

      // 3. Map to unified format
      const events: PublishedEventOption[] = allEvents.map((bevy) => {
        const idStr = String(bevy.id);

        let formattedDate = "Date TBD";
        let formattedTime = "";
        const rawStart = bevy.start_date || "";

        if (rawStart) {
          try {
            const parsed = parseISO(rawStart);
            formattedDate = format(parsed, "EEEE, MMM dd, yyyy");
            formattedTime = format(parsed, "hh:mm a");
          } catch {
            formattedDate = rawStart;
          }
        }

        const thumbnailUrl = bevy.picture?.thumbnail_url || bevy.picture?.url || bevy.cropped_picture_url || "";

        const bannerUrl =
          bevy.banner?.url ||
          bevy.cropped_banner_url ||
          bevy.banner?.thumbnail_url ||
          bevy.picture?.url ||
          bevy.cropped_picture_url ||
          thumbnailUrl;

        const venueName = bevy.venue_name || (bevy.is_virtual_event ? "Virtual / Online" : "Jakarta, Indonesia");
        const venueAddress = bevy.venue_address || "";
        const venueUrl =
          bevy.google_maps_url ||
          bevy.venue_map_url ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueName} ${venueAddress}`.trim())}`;
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
          venueUrl,
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

      cachedEventsEntry = {
        events,
        fetchedAt: Date.now(),
      };

      return {
        success: true,
        events,
        fromCache: false,
      };
    } catch (error) {
      console.error("[fetchPublishedEventsAction] Error fetching published events:", error);
      return {
        success: false,
        events: cachedEventsEntry?.events ?? [],
        error: error instanceof Error ? error.message : "Failed to fetch published events.",
        fromCache: false,
      };
    } finally {
      inFlightEventsPromise = null;
    }
  })();

  inFlightEventsPromise = fetchPromise;
  return fetchPromise;
}

/**
 * Server action to fetch single event details directly from Bevy API.
 * Accurately retrieves full banner image URL, description, and location metadata.
 * Uses in-memory server cache to avoid repeated network hits for the same event.
 */
export async function fetchBevyEventDetailAction(
  eventId: string,
  options?: { forceRefresh?: boolean },
): Promise<{
  success: boolean;
  event?: PublishedEventOption;
  placeholders?: EventDynamicPlaceholders;
  error?: string;
  fromCache?: boolean;
}> {
  try {
    if (!eventId) {
      return { success: false, error: "Event ID is required." };
    }

    const now = Date.now();
    if (!options?.forceRefresh) {
      const cached = cachedEventDetails.get(eventId);
      if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        return {
          success: true,
          event: cached.event,
          placeholders: cached.placeholders,
          fromCache: true,
        };
      }
    }

    const { getBevyEventById } = await import("@/lib/bevy/client");
    const detail = await getBevyEventById(eventId);

    if (!detail) {
      return { success: false, error: `Event ${eventId} not found on Bevy.` };
    }

    const idStr = String(detail.id);
    let formattedDate = "Date TBD";
    let formattedTime = "";
    const rawStart = detail.start_date || "";

    if (rawStart) {
      try {
        const parsed = parseISO(rawStart);
        formattedDate = format(parsed, "EEEE, MMM dd, yyyy");
        formattedTime = format(parsed, "hh:mm a");
        if (detail.end_date) {
          try {
            const parsedEnd = parseISO(detail.end_date);
            formattedTime = `${formattedTime} - ${format(parsedEnd, "hh:mm a")}`;
          } catch {
            // Keep start time
          }
        }
      } catch {
        formattedDate = rawStart;
      }
    }

    const thumbnailUrl = detail.picture?.thumbnail_url || detail.picture?.url || detail.cropped_picture_url || "";

    const bannerUrl =
      detail.banner?.url ||
      detail.cropped_banner_url ||
      detail.banner?.thumbnail_url ||
      (detail as unknown as { banner_url?: string }).banner_url ||
      detail.picture?.url ||
      detail.cropped_picture_url ||
      (detail as unknown as { picture_url?: string }).picture_url ||
      thumbnailUrl ||
      "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";

    let defaultVenue = "Jakarta, Indonesia";
    if (detail.is_virtual_event) {
      defaultVenue = "Virtual / Online";
    } else if (detail.venue_city) {
      defaultVenue = `${detail.venue_city}, Indonesia`;
    }
    const venueName = detail.venue_name || defaultVenue;

    const venueAddress =
      detail.venue_address || [detail.venue_city, detail.venue_country].filter(Boolean).join(", ") || "";

    const venueUrl =
      detail.google_maps_url ||
      detail.venue_map_url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueName} ${venueAddress}`.trim())}`;

    const eventUrl =
      detail.url || detail.static_url || `https://gdg.community.dev/events/details/google-gdg-jakarta-${idStr}/`;

    const mappedEvent: PublishedEventOption = {
      id: idStr,
      title: detail.title || "Untitled Event",
      startDate: rawStart,
      endDate: detail.end_date || "",
      formattedDate,
      formattedTime,
      thumbnailUrl,
      bannerUrl,
      venueName,
      venueAddress,
      venueUrl,
      url: eventUrl,
      descriptionShort: detail.description_short || "",
      isVirtual: Boolean(detail.is_virtual_event),
    };

    const placeholders = buildDefaultEventPlaceholders(mappedEvent);

    cachedEventDetails.set(eventId, {
      event: mappedEvent,
      placeholders,
      fetchedAt: Date.now(),
    });

    return {
      success: true,
      event: mappedEvent,
      placeholders,
      fromCache: false,
    };
  } catch (error) {
    console.error(`[fetchBevyEventDetailAction] Error fetching details for event ${eventId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch event detail from Bevy.",
    };
  }
}
