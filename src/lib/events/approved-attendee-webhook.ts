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
  status: "approved" | "ACCEPTED" | string;
  bevyEventId: string;
  bevyChapterId: string;
  sessionName: string;
  sessionCapacity: number;
  subjectEmail: string;
  bodyEmail: string;

  // Additional secondary fields for backward compatibility
  session?: string;
  eventName?: string;
  eventHeaderEmailUrl?: string;
  actionButtonUrl?: string;
  bevyEventDate?: string;
  bevyEventLocation?: string;
  bevyEventLocationUrl?: string;
}

export interface ApproveAttendeeWebhookResult {
  success: boolean;
  status?: number;
  message?: string;
  error?: string;
  details?: unknown;
}

/**
 * Resolves sessionName and sessionCapacity from registration and event data.
 * - sessionName: queried by n8n Check Capacity API against Bevy
 * - sessionCapacity: validated by n8n Validate Capacity node
 */
export function resolveSessionInfo(
  registration: Partial<FirestoreRegistration>,
  event?: FirestoreEvent,
): { sessionName: string; sessionCapacity: number } {
  const rawSession =
    registration.session_title ??
    registration.ticket_name ??
    registration.ticket_tier ??
    (registration.answers?.Session as string | undefined) ??
    (registration.answers?.session as string | undefined) ??
    (registration.answers?.Ticket as string | undefined) ??
    (registration.answers?.ticket as string | undefined) ??
    "";

  let sessionName = "Regular Ticket";
  if (rawSession && typeof rawSession === "string") {
    const cleaned = rawSession.split(",")[0].trim();
    if (cleaned) {
      sessionName = cleaned;
    }
  } else if (event?.tickets && event.tickets.length > 0) {
    sessionName = event.tickets[0].name.trim() || "Regular Ticket";
  } else if (event?.sessions && event.sessions.length > 0) {
    sessionName = event.sessions[0].title.trim() || "Regular Ticket";
  }

  let sessionCapacity = 100;

  // 1. Check matching session from event
  const matchedSession = event?.sessions?.find((s) => {
    if (registration.session_id && s.id === registration.session_id) return true;
    const sTitle = s.title.toLowerCase();
    const target = sessionName.toLowerCase();
    return sTitle === target || target.includes(sTitle) || sTitle.includes(target);
  });

  if (matchedSession && typeof matchedSession.capacity === "number" && matchedSession.capacity > 0) {
    sessionCapacity = matchedSession.capacity;
  } else {
    // 2. Check matching ticket tier from event
    const matchedTicket = event?.tickets?.find((t) => {
      if (registration.ticket_id && t.id === registration.ticket_id) return true;
      const tName = t.name.toLowerCase();
      const target = sessionName.toLowerCase();
      return tName === target || target.includes(tName) || tName.includes(target);
    });

    if (matchedTicket && typeof matchedTicket.capacity === "number" && matchedTicket.capacity > 0) {
      sessionCapacity = matchedTicket.capacity;
    } else if (typeof event?.max_attendees === "number" && event.max_attendees > 0) {
      sessionCapacity = event.max_attendees;
    }
  }

  return { sessionName, sessionCapacity };
}

/**
 * Builds the approved attendee webhook payload using the event and attendee registration objects.
 * Matches n8n webhook API specification:
 * POST /webhook/api/approved-attendee
 *
 * All actual data is interpolated into bodyEmail, with the QR Code and Attendee Ref Code preserved
 * so n8n's "Generate QR Code" and "Add Bevy Attendee API" nodes can replace them dynamically.
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

  // Resolve session name and session capacity
  const { sessionName, sessionCapacity } = resolveSessionInfo(registration, event);

  // Construct subjectEmail and bodyEmail with actual template data
  let subjectEmail = `Your Official Ticket: ${eventName}`;
  let bodyEmail = `<!DOCTYPE html><html><body><h2>Hi ${fullName},</h2><p>Your ticket is confirmed!</p></body></html>`;

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
    simulatedData.sessionTime = sessionName;

    // Actual interpolated data, preserving QR Code expression tag for n8n workflow
    bodyEmail = interpolateTemplateHtml(rawHtml, simulatedData, { preserveQrCodeTag: true });
    subjectEmail = interpolateTemplateSubject(rawSubject, simulatedData);
  } catch (err) {
    console.warn("[buildApprovedAttendeePayload] Failed to construct email template:", err);
  }

  return {
    email,
    fullName,
    status: "approved",
    bevyEventId,
    bevyChapterId,
    sessionName,
    sessionCapacity,
    subjectEmail,
    bodyEmail,
    session: sessionName,
    eventName,
    eventHeaderEmailUrl,
    actionButtonUrl,
    bevyEventDate,
    bevyEventLocation,
    bevyEventLocationUrl,
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
