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
}

export function buildDefaultEventPlaceholders(event?: PublishedEventOption): EventDynamicPlaceholders {
  const fallbackBanner = "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";
  if (!event) {
    return {
      EventName: "GDG Jakarta Event",
      EventDate: "Date TBD",
      EventTime: "10:00 AM",
      EventVenue: "Jakarta Convention Center",
      EventAddress: "Jl. Jend. Gatot Subroto, Jakarta",
      EventUrl: "https://gdg.community.dev/gdg-jakarta/",
      EventBannerUrl: fallbackBanner,
      EventDescription: "Join the GDG Jakarta community event.",
      SessionTitle: "Keynote: Building Production AI Agents with Gemini",
    };
  }

  return {
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
}

export interface AttendeeDynamicPlaceholders {
  Name: string;
  FirstName: string;
  LastName: string;
  Email: string;
  TicketType: string;
  CheckinStatus: string;
}

export const defaultAttendeePlaceholders: AttendeeDynamicPlaceholders = {
  Name: "Budi Santoso",
  FirstName: "Budi",
  LastName: "Santoso",
  Email: "budi.santoso@example.com",
  TicketType: "In-Person Pass (Free)",
  CheckinStatus: "Checked In",
};
