import { BEVY_CONFIG } from "@/config/bevy-config";
import {
  getDefaultTemplateByKey,
  getDefaultTemplateData,
  interpolateTemplateHtml,
  interpolateTemplateSubject,
} from "@/lib/events/email-templates";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";

export interface ApprovedAttendeeWebhookPayload {
  email: string;
  fullName: string;
  status: "ACCEPTED";
  eventName: string;
  eventHeaderEmailUrl: string;
  actionButtonUrl: string;
  bevyEventId: string;
  bevyChapterId: string;
  bevyEventDate: string;
  bevyEventLocation: string;
  bevyEventLocationUrl: string;
  session: string;
  subjectEmail?: string;
  bodyEmail?: string;
}

export interface ApproveAttendeeWebhookResult {
  success: boolean;
  status?: number;
  message?: string;
  error?: string;
  details?: unknown;
}

/**
 * Builds the approved attendee webhook payload using the event and attendee registration objects.
 */
export function buildApprovedAttendeePayload(
  registration: FirestoreRegistration,
  event?: FirestoreEvent,
): ApprovedAttendeeWebhookPayload {
  const email = (registration.member_email || "").trim();
  const fullName = (registration.member_name || "").trim();

  const eventName = (event?.title ?? registration.event_title).trim();

  const defaultHeader = "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";
  const eventHeaderEmailUrl =
    event?.banner_url ??
    event?.picture_url ??
    registration.event_banner_url ??
    registration.event_picture_url ??
    defaultHeader;

  const chapterSlug = process.env.BEVY_CHAPTER_SLUG ?? BEVY_CONFIG.chapterSlug ?? "gdg-jakarta";
  const bevyEventId = String(event?.id ?? registration.event_id);
  const defaultActionUrl = `https://gdg.community.dev/${chapterSlug}`;
  const actionButtonUrl =
    event?.url ??
    event?.static_url ??
    (bevyEventId
      ? `https://gdg.community.dev/events/details/google-gdg-${chapterSlug}/?event=${bevyEventId}`
      : defaultActionUrl);

  const eventChapter = event as { chapter?: { id?: string | number }; chapter_id?: string | number } | undefined;
  const bevyChapterId = String(
    eventChapter?.chapter?.id ??
      eventChapter?.chapter_id ??
      process.env.BEVY_CHAPTER_ID ??
      BEVY_CONFIG.chapterId ??
      "642",
  );

  let bevyEventDate = "Saturday, October 24, 2026";
  const rawDate = event?.start_date;
  if (rawDate) {
    try {
      const parsedDate = new Date(rawDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        bevyEventDate = parsedDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {
      // keep fallback
    }
  }

  const venueParts = [event?.venue?.name, event?.venue?.address, event?.venue?.city].filter(Boolean);
  let location = event?.venue?.name;
  if (!location) {
    if (venueParts.length > 0) {
      location = venueParts.join(", ");
    } else {
      location = event?.is_virtual ? "Virtual / Online Event" : "Google Office Jakarta";
    }
  }

  const bevyEventLocation = location;
  const bevyEventLocationUrl = event?.is_virtual
    ? actionButtonUrl
    : `https://maps.google.com/?q=${encodeURIComponent(location)}`;

  const rawSession =
    registration.session_title ??
    (registration.answers?.Session as string | undefined) ??
    (registration.answers?.session as string | undefined) ??
    registration.ticket_name ??
    "";
  let session = "Morning Session";
  if (rawSession && typeof rawSession === "string") {
    session = rawSession.split(",")[0].trim();
  }

  // Construct subjectEmail and bodyEmail directly on dashboard using accepted template
  let subjectEmail: string | undefined;
  let bodyEmail: string | undefined;

  try {
    const rawHtml = event?.email_templates?.accepted ?? getDefaultTemplateByKey("accepted");
    const rawSubject =
      event?.email_templates?.accepted_subject ??
      "Your Official Ticket & Reminders: {{ $('bevy-config').item.json.bevyEventName }}";

    const simulatedData = getDefaultTemplateData(
      event ?? {
        id: bevyEventId,
        title: eventName,
        requires_approval: false,
        total_registrations: 0,
        total_approved: 0,
        total_checked_in: 0,
        start_date: "",
        end_date: "",
        created_at: "",
        updated_at: "",
        status: "Published",
      },
    );

    simulatedData.attendee = {
      name: fullName,
      email,
    };
    simulatedData.event.eventName = eventName;
    simulatedData.event.headerEmailUrl = eventHeaderEmailUrl;
    simulatedData.event.eventCtaUrl = actionButtonUrl;
    simulatedData.venueLocation = bevyEventLocation;
    simulatedData.venueLocationUrl = bevyEventLocationUrl;
    simulatedData.eventDate = bevyEventDate;
    simulatedData.sessionTime = session;

    bodyEmail = interpolateTemplateHtml(rawHtml, simulatedData);
    subjectEmail = interpolateTemplateSubject(rawSubject, simulatedData);
  } catch (err) {
    console.warn("[buildApprovedAttendeePayload] Failed to construct email template:", err);
  }

  return {
    email,
    fullName,
    status: "ACCEPTED",
    eventName,
    eventHeaderEmailUrl,
    actionButtonUrl,
    bevyEventId,
    bevyChapterId,
    bevyEventDate,
    bevyEventLocation,
    bevyEventLocationUrl,
    session,
    subjectEmail,
    bodyEmail,
  };
}

/**
 * Resolves the approved attendee webhook URL from a base URL or fallback.
 * Gracefully handles base URLs ending in /webhook/api, /api, /webhook, or bare domain.
 */
export function resolveApprovedAttendeeWebhookUrl(baseUrl?: string): string {
  const raw = (baseUrl ?? "https://n8n.gdgjakarta.com").trim().replace(/\/+$/, "");

  if (raw.endsWith("/webhook/api/approved-attendee") || raw.endsWith("/approved-attendee")) {
    return raw;
  }
  if (raw.endsWith("/webhook/api")) {
    return `${raw}/approved-attendee`;
  }
  if (raw.endsWith("/webhook")) {
    return `${raw}/api/approved-attendee`;
  }
  if (raw.endsWith("/api")) {
    return `${raw.slice(0, -4)}/webhook/api/approved-attendee`;
  }
  return `${raw}/webhook/api/approved-attendee`;
}
