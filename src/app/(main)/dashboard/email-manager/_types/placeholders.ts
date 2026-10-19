export interface PublishedEventOption {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  formattedDate: string; // e.g., "Friday, Oct 23, 2026"
  formattedTime: string; // e.g., "10:00 AM"
  thumbnailUrl?: string;
  bannerUrl?: string;
  venueName?: string;
  venueAddress?: string;
  url?: string;
  descriptionShort?: string;
  isVirtual?: boolean;
}

export interface EventDynamicPlaceholders {
  EventName: string;
  EventDate: string;
  EventTime: string;
  EventVenue: string;
  EventAddress: string;
  EventUrl: string;
  EventBannerUrl: string;
  EventDescription: string;
  SessionTitle: string;
  [customKey: string]: string;
}

export const STANDARD_EVENT_PLACEHOLDER_KEYS: readonly string[] = [
  "EventName",
  "EventDate",
  "EventTime",
  "EventVenue",
  "EventAddress",
  "EventUrl",
  "EventBannerUrl",
  "EventDescription",
  "SessionTitle",
];

export interface CustomPlaceholderDefinition {
  key: string; // Token key without brackets, e.g. "WifiPassword" -> [[WifiPassword]]
  label: string; // User-friendly label, e.g. "Venue Wi-Fi Password"
  sampleValue: string; // Preview or campaign value
  category: "event" | "attendee";
  description?: string;
}

export const CUSTOM_EVENT_PLACEHOLDERS_KEY = "gdg_email_custom_event_placeholders_v1";
export const CUSTOM_ATTENDEE_PLACEHOLDERS_KEY = "gdg_email_custom_attendee_placeholders_v1";

export function sanitizeTokenKey(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^\[+|\]+$/g, "")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .replace(/[^a-zA-Z0-9_ -]/g, "")
    .split(/[\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function formatTokenKeyToLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Extracts unique placeholder token keys from HTML content matching [[TokenName]]
 */
export function extractTokensFromHtml(html: string): string[] {
  if (!html) return [];
  const matches = html.matchAll(/\[\[\s*([a-zA-Z0-9_ -]+?)\s*\]\]/g);
  const found = new Set<string>();
  for (const match of matches) {
    const rawKey = match[1];
    const clean = sanitizeTokenKey(rawKey);
    if (clean) {
      found.add(clean);
    }
  }
  return Array.from(found);
}

export function getStoredCustomEventPlaceholders(): CustomPlaceholderDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_EVENT_PLACEHOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredCustomEventPlaceholders(defs: CustomPlaceholderDefinition[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_EVENT_PLACEHOLDERS_KEY, JSON.stringify(defs));
  } catch (err) {
    console.warn("[saveStoredCustomEventPlaceholders] Failed to persist:", err);
  }
}

export function getStoredCustomAttendeePlaceholders(): CustomPlaceholderDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_ATTENDEE_PLACEHOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredCustomAttendeePlaceholders(defs: CustomPlaceholderDefinition[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_ATTENDEE_PLACEHOLDERS_KEY, JSON.stringify(defs));
  } catch (err) {
    console.warn("[saveStoredCustomAttendeePlaceholders] Failed to persist:", err);
  }
}

export function buildDefaultEventPlaceholders(
  event?: PublishedEventOption,
  customValues?: Record<string, string>,
): EventDynamicPlaceholders {
  const fallbackBanner = "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";
  const standard: EventDynamicPlaceholders = !event
    ? {
        EventName: "GDG Jakarta Event",
        EventDate: "Date TBD",
        EventTime: "10:00 AM",
        EventVenue: "Jakarta Convention Center",
        EventAddress: "Jl. Jend. Gatot Subroto, Jakarta",
        EventUrl: "https://gdg.community.dev/gdg-jakarta/",
        EventBannerUrl: fallbackBanner,
        EventDescription: "Join the GDG Jakarta community event.",
        SessionTitle: "Keynote: Building Production AI Agents with Gemini",
      }
    : {
        EventName: event.title || "Untitled Event",
        EventDate: event.formattedDate,
        EventTime: event.formattedTime,
        EventVenue: event.venueName ?? (event.isVirtual ? "Virtual / Online" : "Jakarta, Indonesia"),
        EventAddress: event.venueAddress ?? "",
        EventUrl: event.url ?? `https://gdg.community.dev/events/details/google-gdg-jakarta-${event.id}/`,
        EventBannerUrl: event.bannerUrl ?? fallbackBanner,
        EventDescription: event.descriptionShort ?? "",
        SessionTitle: "Keynote: Building Production AI Agents with Gemini",
      };

  if (customValues) {
    return { ...standard, ...customValues };
  }
  return standard;
}

export interface AttendeeDynamicPlaceholders {
  Name: string;
  FirstName: string;
  LastName: string;
  Email: string;
  TicketType: string;
  CheckinStatus: string;
  [customKey: string]: string;
}

export const STANDARD_ATTENDEE_PLACEHOLDER_KEYS: readonly string[] = [
  "Name",
  "FirstName",
  "LastName",
  "Email",
  "TicketType",
  "CheckinStatus",
];

export const defaultAttendeePlaceholders: AttendeeDynamicPlaceholders = {
  Name: "Budi Santoso",
  FirstName: "Budi",
  LastName: "Santoso",
  Email: "budi.santoso@example.com",
  TicketType: "In-Person Pass (Free)",
  CheckinStatus: "Checked In",
};
