"use server";

import { revalidatePath } from "next/cache";

import { createBevyPerson, updateBevyEvent, updateBevyPerson } from "@/lib/bevy/client";
import type { BevySpeaker } from "@/lib/bevy/types";
import {
  getCleanDefaultTemplateDataForType,
  getDefaultTemplateByKey,
  interpolateTemplateHtml,
  splitFullName,
} from "@/lib/events/email-templates";
import { DEFAULT_SPEAKER_CUSTOM_SWAGS, DEFAULT_SPEAKER_HANDBOOK_MARKDOWN } from "@/lib/events/speaker-handbook";
import type { EventSpeakerConfig, EventSpeakerConfirmation, FirestoreEvent } from "@/lib/firestore/types";
import { SPEAKER_SLIDE_TEMPLATE_PRESETS } from "@/lib/firestore/types";
import { assertSafeWebhookUrl } from "@/lib/security/webhook-validator";
import { extractApiMessage } from "@/lib/utils";

import { isAuthorizedOrganizerSession } from "./auth-guard";
import { sendEmailDirectInternal } from "./email-template-actions";
import {
  deleteFirestoreDoc,
  getFirestoreDoc,
  getFirestoreEventByIdServer,
  patchFirestoreDoc,
  queryFirestoreDocs,
} from "./firestore-admin";
import { randomBytes } from "node:crypto";

const generateToken = (prefix: string, bytes = 12) => `${prefix}_${randomBytes(bytes).toString("hex")}`;

function buildSpeakerConfirmationDocId(eventId: string | number, email: string): string {
  const sanitized = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 75);
  return `spkconf_${String(eventId)}_${sanitized}`;
}

/**
 * Gets or initializes speaker configuration for an event.
 */
export async function getOrInitEventSpeakerConfigAction(
  eventId: string | number,
): Promise<{ success: boolean; config?: EventSpeakerConfig; error?: string }> {
  try {
    const eventDoc = await getFirestoreEventByIdServer(String(eventId));
    let config = eventDoc?.speaker_config;

    // Ensure custom_swags defaults to DEFAULT_SPEAKER_CUSTOM_SWAGS if empty or not set
    const resolvedCustomSwags =
      config?.custom_swags && config.custom_swags.length > 0 ? config.custom_swags : DEFAULT_SPEAKER_CUSTOM_SWAGS;

    if (!config?.share_token || !config?.custom_swags || config.custom_swags.length === 0) {
      if (!(await isAuthorizedOrganizerSession())) {
        return {
          success: false,
          error: "Unauthorized: Organizer session required to initialize speaker configuration.",
        };
      }

      config = {
        enabled: config?.enabled ?? true,
        share_token: config?.share_token || generateToken("spk", 12),
        auto_send_invitation: config?.auto_send_invitation ?? true,
        handbook_format: config?.handbook_format || "markdown",
        handbook_content: config?.handbook_content || DEFAULT_SPEAKER_HANDBOOK_MARKDOWN,
        active_slide_preset: config?.active_slide_preset || "gdg_default",
        custom_slide_template_url: config?.custom_slide_template_url,
        require_presentation_slides: config?.require_presentation_slides ?? true,
        allow_session_co_speakers: config?.allow_session_co_speakers ?? false,
        max_photo_size_mb: config?.max_photo_size_mb ?? 5,
        show_swag_section: config?.show_swag_section ?? true,
        selected_merchandise_ids: config?.selected_merchandise_ids,
        custom_swags: resolvedCustomSwags,
        updated_at: new Date().toISOString(),
      };

      await patchFirestoreDoc(
        "events",
        String(eventId),
        { speaker_config: config as unknown as Record<string, unknown> },
        true,
      );
      revalidatePath(`/dashboard/events/${eventId}`);
    } else {
      config = {
        ...config,
        custom_swags: resolvedCustomSwags,
      };
    }

    return { success: true, config };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to get speaker configuration.") };
  }
}

/**
 * Updates speaker configuration for an event.
 */
export async function updateEventSpeakerConfigAction(
  eventId: string | number,
  config: Partial<EventSpeakerConfig>,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const existing = await getFirestoreEventByIdServer(String(eventId));
    const mergedConfig: EventSpeakerConfig = {
      enabled: config.enabled ?? existing?.speaker_config?.enabled ?? true,
      share_token: config.share_token || existing?.speaker_config?.share_token || generateToken("spk", 12),
      auto_send_invitation: config.auto_send_invitation ?? existing?.speaker_config?.auto_send_invitation ?? true,
      calendar_webhook_url: config.calendar_webhook_url ?? existing?.speaker_config?.calendar_webhook_url,
      calendar_email: config.calendar_email ?? existing?.speaker_config?.calendar_email ?? "info@gdgjakarta.org",
      auto_create_calendar_event:
        config.auto_create_calendar_event ?? existing?.speaker_config?.auto_create_calendar_event ?? true,
      calendar_invites: {
        ...(existing?.speaker_config?.calendar_invites || {}),
        ...(config.calendar_invites || {}),
      },
      handbook_format: config.handbook_format ?? existing?.speaker_config?.handbook_format ?? "markdown",
      handbook_content:
        config.handbook_content ?? existing?.speaker_config?.handbook_content ?? DEFAULT_SPEAKER_HANDBOOK_MARKDOWN,
      active_slide_preset: config.active_slide_preset ?? existing?.speaker_config?.active_slide_preset ?? "gdg_default",
      custom_slide_template_url:
        config.custom_slide_template_url ?? existing?.speaker_config?.custom_slide_template_url,
      require_presentation_slides:
        config.require_presentation_slides ?? existing?.speaker_config?.require_presentation_slides ?? true,
      allow_session_co_speakers:
        config.allow_session_co_speakers ?? existing?.speaker_config?.allow_session_co_speakers ?? false,
      max_photo_size_mb: config.max_photo_size_mb ?? existing?.speaker_config?.max_photo_size_mb ?? 5,
      show_swag_section: config.show_swag_section ?? existing?.speaker_config?.show_swag_section ?? true,
      selected_merchandise_ids: config.selected_merchandise_ids ?? existing?.speaker_config?.selected_merchandise_ids,
      custom_swags: config.custom_swags ?? existing?.speaker_config?.custom_swags ?? DEFAULT_SPEAKER_CUSTOM_SWAGS,
      updated_at: new Date().toISOString(),
    };

    await patchFirestoreDoc(
      "events",
      String(eventId),
      { speaker_config: mergedConfig as unknown as Record<string, unknown> },
      true,
    );
    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to update speaker configuration.") };
  }
}

/**
 * Regenerates the shareable speaker confirmation token for an event.
 */
export async function regenerateSpeakerShareTokenAction(
  eventId: string | number,
): Promise<{ success: boolean; new_token?: string; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const newToken = generateToken("spk", 12);
    const existing = await getFirestoreEventByIdServer(String(eventId));
    const currentConfig = existing?.speaker_config;
    const updatedConfig: EventSpeakerConfig = {
      enabled: currentConfig?.enabled ?? true,
      share_token: newToken,
      auto_send_invitation: currentConfig?.auto_send_invitation ?? true,
      calendar_webhook_url: currentConfig?.calendar_webhook_url,
      calendar_email: currentConfig?.calendar_email ?? "info@gdgjakarta.org",
      auto_create_calendar_event: currentConfig?.auto_create_calendar_event ?? true,
      calendar_invites: currentConfig?.calendar_invites,
      handbook_format: currentConfig?.handbook_format ?? "markdown",
      handbook_content: currentConfig?.handbook_content ?? DEFAULT_SPEAKER_HANDBOOK_MARKDOWN,
      active_slide_preset: currentConfig?.active_slide_preset ?? "gdg_default",
      custom_slide_template_url: currentConfig?.custom_slide_template_url,
      require_presentation_slides: currentConfig?.require_presentation_slides ?? true,
      allow_session_co_speakers: currentConfig?.allow_session_co_speakers ?? false,
      max_photo_size_mb: currentConfig?.max_photo_size_mb ?? 5,
      show_swag_section: currentConfig?.show_swag_section ?? true,
      selected_merchandise_ids: currentConfig?.selected_merchandise_ids,
      custom_swags: currentConfig?.custom_swags ?? DEFAULT_SPEAKER_CUSTOM_SWAGS,
      updated_at: new Date().toISOString(),
    };

    const saved = await patchFirestoreDoc(
      "events",
      String(eventId),
      { speaker_config: updatedConfig as unknown as Record<string, unknown> },
      true,
    );
    if (!saved) {
      return { success: false, error: "Failed to persist new share token to Firestore." };
    }

    revalidatePath(`/dashboard/events/${eventId}`);
    revalidatePath(`/events/${eventId}/speaker-confirmation`);
    revalidatePath(`/events/${eventId}/speaker-handbook`);
    return { success: true, new_token: newToken };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to regenerate share token.") };
  }
}

/**
 * Validates the event share token and retrieves event speaker metadata.
 */
export async function validateSpeakerShareTokenAction(
  eventId: string | number,
  token: string,
): Promise<{ success: boolean; event?: FirestoreEvent; error?: string }> {
  try {
    const event = await getFirestoreEventByIdServer(String(eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    if (!event.speaker_config?.share_token || event.speaker_config.share_token !== token) {
      return { success: false, error: "Invalid or expired speaker confirmation link." };
    }

    if (event.speaker_config.enabled === false) {
      return { success: false, error: "Speaker confirmations are closed for this event." };
    }

    return { success: true, event };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to validate token.") };
  }
}

/**
 * Gets all speaker confirmations for an event (organizer only).
 */
export async function getEventSpeakerConfirmationsAction(
  eventId: string | number,
): Promise<{ success: boolean; confirmations?: EventSpeakerConfirmation[]; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const confirmations = await queryFirestoreDocs<EventSpeakerConfirmation>("event_speaker_confirmations", [
      {
        fieldFilter: {
          field: { fieldPath: "event_id" },
          op: "EQUAL",
          value: { stringValue: String(eventId) },
        },
      },
    ]);

    confirmations.sort(
      (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime(),
    );

    // Deduplicate by speaker_email (keeping the most recently updated record)
    const seenEmails = new Set<string>();
    const seenBevyIds = new Set<number>();
    const seenNames = new Set<string>();
    const deduped: EventSpeakerConfirmation[] = [];
    for (const c of confirmations) {
      if (c.id.startsWith("spkconf_test_")) continue;
      const emailKey = (c.speaker_email || c.id).toLowerCase();
      if (!seenEmails.has(emailKey)) {
        seenEmails.add(emailKey);
        if (c.bevy_person_id) seenBevyIds.add(Number(c.bevy_person_id));
        if (c.full_name) seenNames.add(c.full_name.trim().toLowerCase());
        deduped.push(c);
      }
    }

    // Also merge any existing confirmed event.speakers from the event roster
    const event = await getFirestoreEventByIdServer(String(eventId));
    if (event?.speakers && Array.isArray(event.speakers)) {
      for (const rawSpk of event.speakers) {
        if (!rawSpk) continue;
        const spk = rawSpk as unknown as Record<string, unknown>;
        const spkName = (
          (spk.full_name as string) || `${(spk.first_name as string) || ""} ${(spk.last_name as string) || ""}`
        ).trim();
        const spkEmail = ((spk.email as string) || "").trim().toLowerCase();
        const spkPersonId = spk.event_person_id || spk.id ? Number(spk.event_person_id || spk.id) : undefined;

        const alreadyListed =
          (spkEmail && seenEmails.has(spkEmail)) ||
          (spkPersonId && seenBevyIds.has(spkPersonId)) ||
          (spkName && seenNames.has(spkName.toLowerCase()));

        if (!alreadyListed && spkName) {
          if (spkEmail) seenEmails.add(spkEmail);
          if (spkPersonId) seenBevyIds.add(spkPersonId);
          seenNames.add(spkName.toLowerCase());

          const pictureObj = spk.picture as { url?: string } | string | undefined;
          const fallbackProfileUrl =
            (spk.picture_url as string) ||
            (typeof pictureObj === "string" ? pictureObj : pictureObj?.url) ||
            (spk.avatar_url as string) ||
            "";

          deduped.push({
            id: `roster_${eventId}_${spkPersonId || encodeURIComponent(spkName)}`,
            event_id: String(eventId),
            event_title: event.title,
            full_name: spkName,
            display_name: spkName,
            job_title: (spk.title as string) || "Speaker",
            company_institution: (spk.company as string) || "",
            speaker_email: spkEmail || "Synced from Event Roster",
            speaker_profile_url: fallbackProfileUrl,
            talk_title: (spk.talk_title as string) || `${spkName}'s Session`,
            talk_type: (spk.speaker_type as EventSpeakerConfirmation["talk_type"]) || "Technical Talk (45 mins)",
            talk_description: (spk.bio as string) || "",
            biography: (spk.bio as string) || "",
            bevy_person_id: spkPersonId,
            bevy_synced: true,
            bevy_synced_at: event.updated_at || event.created_at || new Date().toISOString(),
            created_at: event.created_at || new Date().toISOString(),
            updated_at: event.updated_at || new Date().toISOString(),
          });
        }
      }
    }

    return { success: true, confirmations: deduped };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to get speaker confirmations.") };
  }
}

/**
 * Deletes a speaker confirmation (organizer only).
 */
export async function deleteSpeakerConfirmationAction(
  confirmationId: string,
  eventId: string | number,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    await deleteFirestoreDoc("event_speaker_confirmations", confirmationId);
    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to delete speaker confirmation.") };
  }
}

export type SubmitSpeakerConfirmationInput = Omit<
  EventSpeakerConfirmation,
  "id" | "created_at" | "updated_at" | "invitation_email_sent" | "calendar_invite_sent" | "bevy_synced"
> & {
  token: string;
  confirmation_id?: string;
};

interface CalendarInviteItem {
  type: "main_event" | "agenda_slot" | "dinner";
  title: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  locationUrl?: string;
  virtualVenueUrl?: string;
}

/**
 * Triggers n8n Google Calendar invite webhook for speaker confirmation.
 * Supports Main Event, Bound Agenda Session Slot, and Dinner / After Party invites.
 * Automatically crafts appropriate locations (venue location url, virtual venue url, or hybrid combinations).
 */
async function triggerN8nSpeakerCalendarWebhook(
  webhookUrl: string,
  payload: {
    event: FirestoreEvent;
    confirmation: EventSpeakerConfirmation;
  },
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; actionTaken?: string; error?: string }> {
  try {
    const safeUrl = assertSafeWebhookUrl(webhookUrl, "https://n8n.gdgjakarta.com/webhook/api/speaker-calendar-invite");

    const apiKey =
      process.env.N8N_WEBHOOK_API_KEY ||
      process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY ||
      process.env.N8N_AUTH_SECRET ||
      "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0",
    };

    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const { event, confirmation } = payload;
    const speakerCalConfig = event.speaker_config?.calendar_invites;

    // Resolve venue locations & urls based on event format
    const venueName = event.venue?.name || "Google Indonesia";
    const venueAddress = [event.venue?.address, event.venue?.city].filter(Boolean).join(", ");
    const venueQuery = [event.venue?.name, event.venue?.address, event.venue?.city].filter(Boolean).join(", ");
    const venueLocationUrl =
      event.google_maps_url ||
      event.venue?.google_maps_url ||
      event.venue?.url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueQuery || venueName)}`;

    const virtualVenueUrl =
      event.join_virtual_event_url ||
      event.attendee_virtual_venue_link ||
      (event as unknown as Record<string, string>).virtual_venue_link ||
      `https://gdgjakarta.com/events/${event.id}`;

    const handbookUrl = `https://gdgjakarta.org/events/${event.id}/speaker-handbook?token=${event.speaker_config?.share_token || ""}`;

    // Compute calendar invites to send
    const invites: CalendarInviteItem[] = [];

    // 1. Main Event Invite (Default enabled unless explicitly false)
    if (speakerCalConfig?.invite_main_event !== false) {
      let mainLocation = venueLocationUrl;
      let mainDesc = `GDG Jakarta Event: ${event.title}

Speaker Session:
- Speaker: ${confirmation.full_name}
- Topic: ${confirmation.talk_title}
- Role: ${confirmation.job_title} at ${confirmation.company_institution}
- Handbook: ${handbookUrl}`;

      if (event.audience_type === "VIRTUAL") {
        mainLocation = virtualVenueUrl;
        mainDesc += `

Virtual Event Link: ${virtualVenueUrl}`;
      } else if (event.audience_type === "HYBRID") {
        mainLocation = venueLocationUrl;
        mainDesc += `

Virtual Venue Link: ${virtualVenueUrl}
Physical Venue: ${venueName} (${venueLocationUrl})`;
      } else {
        mainDesc += `

Venue: ${venueName}
Address: ${venueAddress}
Maps: ${venueLocationUrl}`;
      }

      if (speakerCalConfig?.main_event_notes?.trim()) {
        mainDesc += `

Note: ${speakerCalConfig.main_event_notes.trim()}`;
      }

      invites.push({
        type: "main_event",
        title: event.title,
        summary: event.title,
        description: mainDesc,
        startTime: event.start_date,
        endTime: event.end_date,
        location: mainLocation,
        locationUrl: venueLocationUrl,
        virtualVenueUrl: event.audience_type !== "IN_PERSON" ? virtualVenueUrl : undefined,
      });
    }

    // 2. Agenda Session Slot Invite (Follows Bevy Agenda binding or confirmation session_slot)
    if (speakerCalConfig?.invite_agenda_session !== false) {
      let agendaTime = confirmation.session_slot || event.default_session_time;
      let agendaTitle = confirmation.talk_title;
      let agendaDesc = `Speaker Session: ${confirmation.talk_title}
Speaker: ${confirmation.full_name}
Format: ${confirmation.talk_type}
Event: ${event.title}
Handbook: ${handbookUrl}`;

      if (event.agenda) {
        const days = Array.isArray(event.agenda)
          ? event.agenda
          : (
              event.agenda as {
                days?: Array<{
                  items?: Array<{ activity?: string; time?: string; description?: string }>;
                  agenda?: Array<{ activity?: string; time?: string; description?: string }>;
                }>;
              }
            ).days || [];

        for (const day of days) {
          const items =
            (day as { items?: Array<{ activity?: string; time?: string; description?: string }> }).items ||
            (day as { agenda?: Array<{ activity?: string; time?: string; description?: string }> }).agenda ||
            [];
          for (const item of items) {
            const normAct = (item.activity || "").toLowerCase();
            const normTalk = confirmation.talk_title.toLowerCase();
            const normSpeaker = confirmation.full_name.toLowerCase();
            if (
              normAct.includes(normTalk) ||
              normAct.includes(normSpeaker) ||
              (confirmation.session_slot && item.time === confirmation.session_slot)
            ) {
              if (item.time) agendaTime = item.time;
              if (item.activity) agendaTitle = item.activity;
              if (item.description)
                agendaDesc += `

Session Overview:
${item.description}`;
              break;
            }
          }
        }
      }

      if (speakerCalConfig?.agenda_session_notes?.trim()) {
        agendaDesc += `

Note: ${speakerCalConfig.agenda_session_notes.trim()}`;
      }

      let slotStartTime = event.start_date;
      let slotEndTime = event.end_date;

      if (agendaTime && /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(agendaTime)) {
        const [tStart, tEnd] = agendaTime.split("-").map((s) => s.trim());
        const eventDatePrefix = event.start_date.split("T")[0] || "";
        if (eventDatePrefix) {
          slotStartTime = `${eventDatePrefix}T${tStart.padStart(5, "0")}:00+07:00`;
          slotEndTime = `${eventDatePrefix}T${tEnd.padStart(5, "0")}:00+07:00`;
        }
      }

      invites.push({
        type: "agenda_slot",
        title: `${confirmation.talk_title} - ${confirmation.full_name}`,
        summary: `Stage Session: ${agendaTitle}`,
        description: agendaDesc,
        startTime: slotStartTime,
        endTime: slotEndTime,
        location: event.audience_type === "VIRTUAL" ? virtualVenueUrl : venueLocationUrl,
        locationUrl: venueLocationUrl,
        virtualVenueUrl: event.audience_type !== "IN_PERSON" ? virtualVenueUrl : undefined,
      });
    }

    // 3. Dinner / After Party Invite (Optional)
    if (speakerCalConfig?.invite_dinner && speakerCalConfig.dinner_start_time) {
      const dinnerTitle = speakerCalConfig.dinner_title || `Speakers & Organizers Dinner: ${event.title}`;
      let dinnerDesc = `Appreciation Dinner & Networking for confirmed speakers and organizers of ${event.title}.

Host: GDG Jakarta
Venue: ${speakerCalConfig.dinner_venue_name || "Dinner Venue"}
Address: ${speakerCalConfig.dinner_venue_address || ""}`;
      if (speakerCalConfig.dinner_maps_url) {
        dinnerDesc += `
Maps: ${speakerCalConfig.dinner_maps_url}`;
      }
      if (speakerCalConfig.dinner_notes?.trim()) {
        dinnerDesc += `

Note: ${speakerCalConfig.dinner_notes.trim()}`;
      }

      invites.push({
        type: "dinner",
        title: dinnerTitle,
        summary: dinnerTitle,
        description: dinnerDesc,
        startTime: speakerCalConfig.dinner_start_time,
        endTime: speakerCalConfig.dinner_end_time || speakerCalConfig.dinner_start_time,
        location:
          speakerCalConfig.dinner_maps_url ||
          speakerCalConfig.dinner_venue_address ||
          speakerCalConfig.dinner_venue_name ||
          "Dinner Location",
        locationUrl: speakerCalConfig.dinner_maps_url,
      });
    }

    const primaryInvite = invites[0] || {
      type: "main_event",
      title: event.title,
      summary: event.title,
      description: `Speaker session for ${confirmation.full_name}`,
      startTime: event.start_date,
      endTime: event.end_date,
      location: venueLocationUrl,
    };

    const res = await fetch(safeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "invite_speaker",
        createCalendarIfMissing: true,
        calendarId: "info@gdgjakarta.org",
        speakerEmail: confirmation.speaker_email,
        speakerName: confirmation.full_name,
        talkTitle: confirmation.talk_title,
        talkType: confirmation.talk_type,
        eventTitle: event.title,
        eventId: event.id,
        audienceType: event.audience_type || "IN_PERSON",
        sessionSlot: confirmation.session_slot || event.default_session_time,
        startTime: primaryInvite.startTime,
        endTime: primaryInvite.endTime,
        venueName,
        venueAddress,
        venueLocationUrl,
        virtualVenueUrl: event.audience_type !== "IN_PERSON" ? virtualVenueUrl : undefined,
        handbookUrl,
        invites,
        primaryInvite,
      }),
    });

    if (!res.ok) {
      let errorDetail = `Webhook returned status ${res.status}`;
      try {
        const errJson = (await res.json()) as Record<string, unknown>;
        if (typeof errJson.error === "string") {
          errorDetail = errJson.error;
        } else if (typeof errJson.message === "string") {
          errorDetail = errJson.message;
        }
      } catch {
        // ignore parse error
      }
      return { success: false, error: errorDetail };
    }

    try {
      const data = (await res.json()) as Record<string, unknown>;
      const isSuccess = data.success !== false && !data.error;
      let errorMsg: string | undefined;
      if (typeof data.error === "string") {
        errorMsg = data.error;
      } else if (!isSuccess) {
        errorMsg = "Unknown calendar automation error";
      }

      return {
        success: isSuccess,
        eventId: typeof data.eventId === "string" ? data.eventId : (data.id as string) || undefined,
        htmlLink: typeof data.htmlLink === "string" ? data.htmlLink : undefined,
        actionTaken: typeof data.actionTaken === "string" ? data.actionTaken : undefined,
        error: errorMsg,
      };
    } catch {
      return { success: true };
    }
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to execute speaker calendar invite webhook") };
  }
}

/**
 * Dispatches Speaker Invitation email using event's template.
 */
async function dispatchSpeakerInvitationEmail(
  event: FirestoreEvent,
  confirmation: EventSpeakerConfirmation,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { firstName, lastName } = splitFullName(confirmation.full_name);
    const templateHtml = event.email_templates?.speaker_invitation || getDefaultTemplateByKey("speaker_invitation");
    const baseData = getCleanDefaultTemplateDataForType("speaker_invitation", event);

    const handbookUrl = `https://gdgjakarta.org/events/${event.id}/speaker-handbook?token=${event.speaker_config?.share_token || ""}`;

    const ROLE_MAP: Record<string, string> = {
      speakers: "Speaker",
      panelists: "Panelist",
      facilitators: "Facilitator",
      mentors: "Mentor",
      judges: "Judge",
      moderators: "Moderator",
      hosts: "Host",
    };
    const presenterRole = ROLE_MAP[confirmation.presenter_role || "speakers"] || "Speaker";

    const renderedHtml = interpolateTemplateHtml(templateHtml, {
      attendee: {
        name: confirmation.full_name,
        email: confirmation.speaker_email,
      },
      event: {
        headerEmailUrl: event.banner_url || event.picture_url || baseData.event.headerEmailUrl,
        eventName: event.title || baseData.event.eventName,
        eventCtaUrl: baseData.event.eventCtaUrl,
        eventChecklistItems: baseData.event.eventChecklistItems,
      },
      sessionTime: confirmation.session_slot || event.default_session_time || baseData.sessionTime,
      venueLocation: baseData.venueLocation,
      venueLocationUrl: baseData.venueLocationUrl,
      eventDate: baseData.eventDate,
      talkType: confirmation.talk_type,
      talkTitle: confirmation.talk_title,
      speakerHandbookUrl: handbookUrl,
      presenterRole,
    });

    const subject = `${presenterRole} Invitation: ${event.title || "GDG Jakarta"}`;

    const res = await sendEmailDirectInternal({
      first_name: firstName,
      last_name: lastName,
      email: confirmation.speaker_email,
      subjectEmail: subject,
      bodyEmail: renderedHtml,
    });

    return { success: res.success, error: res.error };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to render or send email") };
  }
}

/**
 * Looks up an existing speaker confirmation by email (or confirmation ID) for the given event and token.
 * Allows returning speakers to prefill and update their submitted response.
 */
export async function lookupSpeakerConfirmationByEmailAction(input: {
  event_id: string | number;
  token: string;
  speaker_email: string;
  confirmation_id?: string;
}): Promise<{ success: boolean; confirmation?: EventSpeakerConfirmation; error?: string }> {
  try {
    const val = await validateSpeakerShareTokenAction(input.event_id, input.token);
    if (!val.success || !val.event) {
      return { success: false, error: val.error || "Invalid speaker confirmation link." };
    }

    const cleanEmail = input.speaker_email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: "Please enter a valid email address." };
    }

    if (input.confirmation_id) {
      const byId = (await getFirestoreDoc(
        "event_speaker_confirmations",
        input.confirmation_id,
      )) as unknown as EventSpeakerConfirmation | null;
      if (
        byId &&
        String(byId.event_id) === String(input.event_id) &&
        byId.speaker_email?.toLowerCase() === cleanEmail
      ) {
        return { success: true, confirmation: byId };
      }
    }

    const deterministicId = buildSpeakerConfirmationDocId(input.event_id, cleanEmail);
    const byDeterministic = (await getFirestoreDoc(
      "event_speaker_confirmations",
      deterministicId,
    )) as unknown as EventSpeakerConfirmation | null;
    if (byDeterministic && String(byDeterministic.event_id) === String(input.event_id)) {
      return { success: true, confirmation: byDeterministic };
    }

    // Fallback query if caller has organizer session
    const existingList = await queryFirestoreDocs<EventSpeakerConfirmation>("event_speaker_confirmations", [
      {
        fieldFilter: {
          field: { fieldPath: "event_id" },
          op: "EQUAL",
          value: { stringValue: String(input.event_id) },
        },
      },
    ]);
    const matched = existingList.find((c) => c.speaker_email?.toLowerCase() === cleanEmail);
    if (matched) {
      return { success: true, confirmation: matched };
    }

    return {
      success: false,
      error: `No existing speaker confirmation found for ${cleanEmail} on this event.`,
    };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to look up speaker confirmation.") };
  }
}

/**
 * Submits or updates speaker confirmation from public form.
 */
export async function submitSpeakerConfirmationAction(
  input: SubmitSpeakerConfirmationInput,
): Promise<{ success: boolean; confirmationId?: string; isUpdate?: boolean; error?: string }> {
  try {
    const val = await validateSpeakerShareTokenAction(input.event_id, input.token);
    if (!val.success || !val.event) {
      return { success: false, error: val.error || "Invalid speaker confirmation link." };
    }
    const event = val.event;

    const cleanEmail = input.speaker_email.trim().toLowerCase();
    const deterministicId = buildSpeakerConfirmationDocId(input.event_id, cleanEmail);

    // Check if an existing confirmation exists for this speaker (either by passed confirmation_id, deterministicId, or query)
    let existingDoc: EventSpeakerConfirmation | null = null;
    if (input.confirmation_id) {
      const doc = (await getFirestoreDoc(
        "event_speaker_confirmations",
        input.confirmation_id,
      )) as unknown as EventSpeakerConfirmation | null;
      if (doc && String(doc.event_id) === String(input.event_id)) {
        existingDoc = doc;
      }
    }
    if (!existingDoc) {
      const doc = (await getFirestoreDoc(
        "event_speaker_confirmations",
        deterministicId,
      )) as unknown as EventSpeakerConfirmation | null;
      if (doc && String(doc.event_id) === String(input.event_id)) {
        existingDoc = doc;
      }
    }
    if (!existingDoc) {
      const existingList = await queryFirestoreDocs<EventSpeakerConfirmation>("event_speaker_confirmations", [
        {
          fieldFilter: {
            field: { fieldPath: "event_id" },
            op: "EQUAL",
            value: { stringValue: String(input.event_id) },
          },
        },
      ]);
      existingDoc = existingList.find((c) => c.speaker_email?.toLowerCase() === cleanEmail) || null;
    }

    const isUpdate = Boolean(existingDoc);
    const confirmationId = existingDoc?.id || deterministicId;
    const now = new Date().toISOString();
    const optStr = (val: string | undefined, prev: string | undefined) => {
      const trimmed = val?.trim();
      if (trimmed) return trimmed;
      return prev !== undefined ? "" : undefined;
    };

    const record: EventSpeakerConfirmation = {
      id: confirmationId,
      event_id: String(input.event_id),
      display_name: input.display_name?.trim() || input.full_name.trim(),
      full_name: input.full_name.trim(),
      speaker_email: cleanEmail,
      whatsapp_number: optStr(input.whatsapp_number, existingDoc?.whatsapp_number),
      contact_channels: input.contact_channels?.length ? input.contact_channels : existingDoc?.contact_channels,
      job_title: input.job_title.trim(),
      company_institution: input.company_institution.trim(),
      linkedin_url: optStr(input.linkedin_url, existingDoc?.linkedin_url),
      twitter_url: optStr(input.twitter_url, existingDoc?.twitter_url),
      portfolio_url: optStr(input.portfolio_url, existingDoc?.portfolio_url),
      instagram_username: optStr(input.instagram_username, existingDoc?.instagram_username),
      company_twitter_username: optStr(input.company_twitter_username, existingDoc?.company_twitter_username),
      linkedin_or_social_url: optStr(
        input.linkedin_url?.trim() || input.linkedin_or_social_url,
        existingDoc?.linkedin_or_social_url,
      ),
      speaker_profile_url: optStr(input.speaker_profile_url, existingDoc?.speaker_profile_url),
      google_ecosystem_or_technology: input.google_ecosystem_or_technology,
      is_from_google_ecosystem: input.is_from_google_ecosystem,
      ecosystem_details: optStr(input.ecosystem_details, existingDoc?.ecosystem_details),
      presenter_role: input.presenter_role || "speakers",
      talk_type: input.talk_type,
      talk_title: input.talk_title.trim(),
      talk_description: optStr(input.talk_description, existingDoc?.talk_description),
      biography: optStr(input.biography, existingDoc?.biography),
      can_share_slides: input.can_share_slides || "Yes",
      session_slot: optStr(input.session_slot, existingDoc?.session_slot),
      presentation_slides_url: optStr(input.presentation_slides_url, existingDoc?.presentation_slides_url),
      tshirt_size: optStr(input.tshirt_size, existingDoc?.tshirt_size),
      swag_selections:
        input.swag_selections && Object.keys(input.swag_selections).length > 0
          ? input.swag_selections
          : existingDoc?.swag_selections,
      dietary_restrictions: optStr(input.dietary_restrictions, existingDoc?.dietary_restrictions),
      dietary_restrictions_list: input.dietary_restrictions_list?.length
        ? input.dietary_restrictions_list
        : existingDoc?.dietary_restrictions_list,
      additional_inquiry: optStr(input.additional_inquiry, existingDoc?.additional_inquiry),
      bevy_person_id: input.bevy_person_id ?? existingDoc?.bevy_person_id ?? null,
      bevy_synced: Boolean(input.bevy_person_id || existingDoc?.bevy_synced),
      bevy_synced_at: input.bevy_person_id ? now : existingDoc?.bevy_synced_at,
      created_at: existingDoc?.created_at || now,
      updated_at: now,
      invitation_email_sent: existingDoc?.invitation_email_sent ?? false,
      invitation_email_sent_at: existingDoc?.invitation_email_sent_at,
      calendar_invite_sent: existingDoc?.calendar_invite_sent ?? false,
      calendar_invite_sent_at: existingDoc?.calendar_invite_sent_at,
      calendar_event_id: existingDoc?.calendar_event_id,
      calendar_event_url: existingDoc?.calendar_event_url,
    };

    // If bevy_person_id was passed or exists, update existing person on Bevy without duplicating
    if (record.bevy_person_id) {
      try {
        const { firstName, lastName } = splitFullName(record.full_name);
        const title = `${record.job_title}${record.company_institution ? ` at ${record.company_institution}` : ""}`;
        await updateBevyPerson(Number(record.bevy_person_id), event.id, {
          first_name: firstName,
          last_name: lastName,
          title,
          bio:
            record.talk_description ||
            record.biography ||
            (record.talk_title ? `Speaker for: ${record.talk_title}` : ""),
          picture: record.speaker_profile_url || undefined,
        });
      } catch (bevyUpdateErr) {
        console.warn("[submitSpeakerConfirmationAction] updateBevyPerson failed:", bevyUpdateErr);
      }
    }

    // 1. Send Email Invitation (if first time or previous email wasn't sent)
    if (!isUpdate || !existingDoc?.invitation_email_sent) {
      const emailResult = await dispatchSpeakerInvitationEmail(event, record);
      if (emailResult.success) {
        record.invitation_email_sent = true;
        record.invitation_email_sent_at = new Date().toISOString();
      } else {
        record.invitation_email_error = emailResult.error?.slice(0, 950);
      }
    }

    // 2. Trigger GCal invite webhook directly using centralized webhook API (if first time or not yet sent)
    const gcalWebhook =
      process.env.N8N_SPEAKER_CALENDAR_WEBHOOK_URL || "https://n8n.gdgjakarta.com/webhook/api/speaker-calendar-invite";

    if (gcalWebhook && (!isUpdate || !existingDoc?.calendar_invite_sent)) {
      const gcalResult = await triggerN8nSpeakerCalendarWebhook(gcalWebhook, {
        event,
        confirmation: record,
      });
      if (gcalResult.success) {
        record.calendar_invite_sent = true;
        record.calendar_invite_sent_at = new Date().toISOString();
        if (gcalResult.eventId) {
          record.calendar_event_id = gcalResult.eventId;
        }
        if (gcalResult.htmlLink) {
          record.calendar_event_url = gcalResult.htmlLink;
        }
      } else {
        record.calendar_invite_error = gcalResult.error?.slice(0, 950);
      }
    }

    // 3. Save to Firestore
    const saved = await patchFirestoreDoc(
      "event_speaker_confirmations",
      confirmationId,
      record as unknown as Record<string, unknown>,
      true,
    );

    if (!saved) {
      console.error(
        "[submitSpeakerConfirmationAction] Failed to save confirmation document to Firestore:",
        confirmationId,
      );
      return {
        success: false,
        error: "Failed to save speaker confirmation. Please try again or contact the event organizers.",
      };
    }

    // Sync to event presenter role list (speakers, mentors, facilitators, panelists, judges, moderators, hosts)
    try {
      const roleKey = record.presenter_role || "speakers";
      const currentList = Array.isArray(event[roleKey]) ? [...(event[roleKey] as BevySpeaker[])] : [];
      const { firstName, lastName } = splitFullName(record.full_name);

      const newSpeakerObj: BevySpeaker = {
        id: record.bevy_person_id || undefined,
        first_name: firstName,
        last_name: lastName,
        full_name: record.full_name,
        title: record.job_title,
        company: record.company_institution,
        bio: record.talk_description || record.biography || `Speaker for ${record.talk_title}`,
        picture: record.speaker_profile_url ? { url: record.speaker_profile_url } : undefined,
        picture_url: record.speaker_profile_url,
        speaker_type: record.talk_type,
        event_person_id: record.bevy_person_id || undefined,
      };

      const existingIdx = currentList.findIndex(
        (s) =>
          (record.bevy_person_id && s.id === record.bevy_person_id) ||
          s.full_name?.toLowerCase() === record.full_name.toLowerCase(),
      );

      if (existingIdx >= 0) {
        currentList[existingIdx] = { ...currentList[existingIdx], ...newSpeakerObj };
      } else {
        currentList.push(newSpeakerObj);
      }

      await patchFirestoreDoc("events", String(event.id), { [roleKey]: currentList }, true);
      await updateBevyEvent(event.id, { [roleKey]: currentList });
    } catch (eventSyncErr) {
      console.warn("[submitSpeakerConfirmationAction] Failed updating event presenter array:", eventSyncErr);
    }

    // 4. If auto_sync_to_bevy is enabled on event config, trigger sync to Bevy people roster
    if (event.speaker_config?.auto_sync_to_bevy) {
      try {
        await syncSpeakerConfirmationToBevyAction(confirmationId, event.id);
      } catch (autoSyncErr) {
        console.warn("[submitSpeakerConfirmationAction] auto_sync_to_bevy failed:", autoSyncErr);
      }
    }

    revalidatePath(`/dashboard/events/${event.id}`);
    return { success: true, confirmationId, isUpdate };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to submit speaker confirmation.") };
  }
}

/**
 * Resends speaker invitation email manually (organizer only).
 */
export async function resendSpeakerInvitationAction(
  confirmationId: string,
  eventId: string | number,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const rawConf = await getFirestoreDoc("event_speaker_confirmations", confirmationId);
    if (!rawConf) {
      return { success: false, error: "Speaker confirmation record not found." };
    }
    const confirmation = rawConf as unknown as EventSpeakerConfirmation;

    const event = await getFirestoreEventByIdServer(String(eventId));
    if (!event) {
      return { success: false, error: "Event not found." };
    }

    const emailResult = await dispatchSpeakerInvitationEmail(event, confirmation);
    if (!emailResult.success) {
      return { success: false, error: emailResult.error || "Failed to dispatch email." };
    }

    await patchFirestoreDoc(
      "event_speaker_confirmations",
      confirmationId,
      {
        invitation_email_sent: true,
        invitation_email_sent_at: new Date().toISOString(),
      },
      true,
    );

    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to resend invitation.") };
  }
}

/**
 * Generates or regenerates talk title and talk description using Bevy AI.
 * Accessible from the speaker confirmation form when gated by a valid event speaker token.
 */
export async function generateSpeakerTalkWithAiAction(params: {
  eventId: string | number;
  token: string;
  topicPrompt: string;
  currentTitle?: string;
  currentDescription?: string;
  targetField?: "both" | "title" | "description";
}): Promise<{
  success: boolean;
  title?: string;
  description?: string;
  error?: string;
}> {
  try {
    const val = await validateSpeakerShareTokenAction(params.eventId, params.token);
    if (!val.success || !val.event) {
      return { success: false, error: val.error || "Invalid speaker confirmation link." };
    }

    const _event = val.event;
    const { generateBevyAiEventDetails, modifyBevyAiEventContent } = await import("@/lib/bevy/client");

    if (params.targetField === "both" || (!params.currentTitle && !params.currentDescription)) {
      const enrichedPrompt = `Write a conference presentation session description and title for a speaker presenting on: "${params.topicPrompt}". Focus exclusively on what attendees will learn in this specific talk. Do NOT describe an entire community event or meetup.`;

      const aiRes = await generateBevyAiEventDetails(enrichedPrompt);
      if (!aiRes.success || !aiRes.data) {
        return { success: false, error: aiRes.error || "Failed to generate talk details with AI" };
      }

      let cleanDesc = (aiRes.data.description || "").replace(/<[^>]*>/g, "").trim();
      // Remove event-level boilerplate if returned by Bevy event generator
      cleanDesc = cleanDesc
        .replace(/^(Join us for (an exciting|a)|In this event,|Welcome to our event,|RSVP now and).*?[.!?]\s*/i, "")
        .replace(/(Don't miss out|Secure your spot|See you there|RSVP today).*$/i, "")
        .trim();

      // If description starts with "In this session" or similar, keep it concise
      if (cleanDesc.length > 295) {
        cleanDesc = `${cleanDesc.slice(0, 292)}...`;
      }

      return {
        success: true,
        title: (aiRes.data.title || "")
          .replace(/<[^>]*>/g, "")
          .replace(/^Session:\s*/i, "")
          .trim(),
        description:
          cleanDesc ||
          (aiRes.data.description || "")
            .replace(/<[^>]*>/g, "")
            .slice(0, 295)
            .trim(),
      };
    }

    if (params.targetField === "title") {
      const modRes = await modifyBevyAiEventContent({
        field: "title",
        change: "regenerate",
        title: params.currentTitle || params.topicPrompt,
        description: params.currentDescription || `Talk session on ${params.topicPrompt}`,
        maxLength: 120,
        minLength: 10,
      });

      const rawContent =
        modRes.data?.title || modRes.data?.result || modRes.data?.modified_content || modRes.data?.text;
      if (!modRes.success || !rawContent) {
        return { success: false, error: modRes.error || "Failed to regenerate talk title" };
      }

      return {
        success: true,
        title: rawContent.replace(/<[^>]*>/g, "").trim(),
      };
    }

    if (params.targetField === "description") {
      const modRes = await modifyBevyAiEventContent({
        field: "description",
        change: "shorter",
        title: params.currentTitle || "Technical Session",
        description: params.currentDescription || params.topicPrompt,
        maxLength: 300,
        minLength: 20,
      });

      const rawContent =
        modRes.data?.description || modRes.data?.result || modRes.data?.modified_content || modRes.data?.text;
      if (!modRes.success || !rawContent) {
        return { success: false, error: modRes.error || "Failed to regenerate talk description" };
      }

      let cleanDesc = rawContent.replace(/<[^>]*>/g, "").trim();
      cleanDesc = cleanDesc
        .replace(/^(Join us for (an exciting|a)|In this event,|Welcome to our event,|RSVP now and).*?[.!?]\s*/i, "")
        .replace(/(Don't miss out|Secure your spot|See you there|RSVP today).*$/i, "")
        .trim();

      if (cleanDesc.length > 295) {
        cleanDesc = `${cleanDesc.slice(0, 292)}...`;
      }

      return {
        success: true,
        description: cleanDesc,
      };
    }

    return { success: false, error: "Invalid targetField." };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Error generating AI content.") };
  }
}

/**
 * Syncs speaker confirmation record to Bevy People roster (organizer only).
 */
export async function syncSpeakerConfirmationToBevyAction(
  confirmationId: string,
  eventId: string | number,
): Promise<{ success: boolean; bevy_person_id?: number; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const rawConf = await getFirestoreDoc("event_speaker_confirmations", confirmationId);
    if (!rawConf) {
      return { success: false, error: "Speaker confirmation not found." };
    }
    const confirmation = rawConf as unknown as EventSpeakerConfirmation;

    const { firstName, lastName } = splitFullName(confirmation.full_name);
    const title = `${confirmation.job_title}${confirmation.company_institution ? ` at ${confirmation.company_institution}` : ""}`;

    if (confirmation.bevy_person_id) {
      const updateRes = await updateBevyPerson(Number(confirmation.bevy_person_id), eventId, {
        first_name: firstName,
        last_name: lastName,
        title,
        bio: confirmation.talk_title ? `Speaker for: ${confirmation.talk_title}` : "",
      });
      if (!updateRes.success) {
        return { success: false, error: updateRes.error };
      }
      return { success: true, bevy_person_id: Number(confirmation.bevy_person_id) };
    }

    const createRes = await createBevyPerson(eventId, {
      first_name: firstName,
      last_name: lastName,
      title,
      bio: confirmation.talk_title ? `Speaker for: ${confirmation.talk_title}` : "",
      picture: confirmation.speaker_profile_url || "",
    });

    if (!createRes.success || !createRes.data) {
      return { success: false, error: createRes.error || "Failed to create person in Bevy." };
    }

    const bevyPersonId = createRes.data.id;
    await patchFirestoreDoc(
      "event_speaker_confirmations",
      confirmationId,
      {
        bevy_person_id: bevyPersonId,
        bevy_synced: true,
        bevy_synced_at: new Date().toISOString(),
      },
      true,
    );

    // Sync to event presenter role list (speakers, mentors, facilitators, panelists, judges, moderators, hosts)
    try {
      const eventDoc = await getFirestoreEventByIdServer(String(eventId));
      if (eventDoc) {
        const roleKey = confirmation.presenter_role || "speakers";
        const currentList = Array.isArray(eventDoc[roleKey]) ? [...(eventDoc[roleKey] as BevySpeaker[])] : [];
        const existingIdx = currentList.findIndex(
          (s) => s.id === bevyPersonId || s.full_name?.toLowerCase() === confirmation.full_name.toLowerCase(),
        );

        const newSpeakerObj: BevySpeaker = {
          id: bevyPersonId,
          first_name: firstName,
          last_name: lastName,
          full_name: confirmation.full_name,
          title: confirmation.job_title,
          company: confirmation.company_institution,
          bio: confirmation.talk_description || confirmation.biography || `Speaker for ${confirmation.talk_title}`,
          picture: confirmation.speaker_profile_url ? { url: confirmation.speaker_profile_url } : undefined,
          picture_url: confirmation.speaker_profile_url,
          speaker_type: confirmation.talk_type,
          event_person_id: bevyPersonId,
        };

        if (existingIdx >= 0) {
          currentList[existingIdx] = { ...currentList[existingIdx], ...newSpeakerObj };
        } else {
          currentList.push(newSpeakerObj);
        }

        await patchFirestoreDoc("events", String(eventId), { [roleKey]: currentList }, true);
        await updateBevyEvent(eventId, { [roleKey]: currentList });
      }
    } catch (eventSyncErr) {
      console.warn("[syncSpeakerConfirmationToBevyAction] Failed updating event presenter array:", eventSyncErr);
    }

    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true, bevy_person_id: bevyPersonId };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to sync speaker to Bevy.") };
  }
}

export interface AddManualSpeakerConfirmationInput {
  event_id: string | number;
  full_name: string;
  display_name?: string;
  speaker_email: string;
  job_title: string;
  company_institution: string;
  speaker_profile_url?: string;
  talk_type: string;
  talk_title: string;
  talk_description?: string;
  session_slot?: string;
  biography?: string;
  bevy_person_id?: number | null;
  linkedin_url?: string;
  twitter_url?: string;
  portfolio_url?: string;
  is_from_google_ecosystem?: string;
  ecosystem_details?: string;
  presenter_role?: "speakers" | "mentors" | "facilitators" | "panelists" | "judges" | "moderators" | "hosts";
  send_invitation_email?: boolean;
}

/**
 * Allows organizers to manually add a confirmed speaker to the roster,
 * either by picking an existing Bevy person from Algolia search or inputting manually.
 * Enforces deduplication on email and existing confirmations.
 */
export async function addManualSpeakerConfirmationAction(
  input: AddManualSpeakerConfirmationInput,
): Promise<{ success: boolean; confirmationId?: string; error?: string }> {
  try {
    if (!(await isAuthorizedOrganizerSession())) {
      return { success: false, error: "Unauthorized: Organizer session required." };
    }

    const eventDoc = await getFirestoreEventByIdServer(String(input.event_id));
    if (!eventDoc) {
      return { success: false, error: "Event not found." };
    }

    const cleanEmail = input.speaker_email.trim().toLowerCase();
    const existing = await queryFirestoreDocs<EventSpeakerConfirmation>("event_speaker_confirmations", [
      {
        fieldFilter: {
          field: { fieldPath: "event_id" },
          op: "EQUAL",
          value: { stringValue: String(input.event_id) },
        },
      },
    ]);

    const isDup = existing.some(
      (c) =>
        c.speaker_email?.toLowerCase() === cleanEmail ||
        (input.bevy_person_id && c.bevy_person_id === input.bevy_person_id),
    );
    if (isDup) {
      return {
        success: false,
        error: `A speaker profile with email ${cleanEmail} is already confirmed for this event.`,
      };
    }

    const confirmationId = buildSpeakerConfirmationDocId(input.event_id, cleanEmail);
    const now = new Date().toISOString();

    const record: EventSpeakerConfirmation = {
      id: confirmationId,
      event_id: String(input.event_id),
      full_name: input.full_name.trim(),
      display_name: input.display_name?.trim() || input.full_name.trim(),
      speaker_email: cleanEmail,
      job_title: input.job_title.trim(),
      company_institution: input.company_institution.trim(),
      speaker_profile_url: input.speaker_profile_url?.trim(),
      talk_type: input.talk_type,
      talk_title: input.talk_title.trim(),
      talk_description: input.talk_description?.trim(),
      session_slot: input.session_slot?.trim() || undefined,
      biography: input.biography?.trim(),
      linkedin_url: input.linkedin_url?.trim(),
      twitter_url: input.twitter_url?.trim(),
      portfolio_url: input.portfolio_url?.trim(),
      is_from_google_ecosystem: input.is_from_google_ecosystem,
      ecosystem_details: input.ecosystem_details?.trim(),
      presenter_role: input.presenter_role || "speakers",
      can_share_slides: "Yes",
      bevy_person_id: input.bevy_person_id || null,
      bevy_synced: Boolean(input.bevy_person_id),
      bevy_synced_at: input.bevy_person_id ? now : undefined,
      created_at: now,
      updated_at: now,
      invitation_email_sent: false,
      calendar_invite_sent: false,
    };

    // If bevy_person_id is provided, update existing Bevy person; otherwise create new person in Bevy
    if (record.bevy_person_id) {
      try {
        const { firstName, lastName } = splitFullName(record.full_name);
        const title = `${record.job_title}${record.company_institution ? ` at ${record.company_institution}` : ""}`;
        await updateBevyPerson(Number(record.bevy_person_id), input.event_id, {
          first_name: firstName,
          last_name: lastName,
          title,
          bio:
            record.talk_description ||
            record.biography ||
            (record.talk_title ? `Speaker for: ${record.talk_title}` : ""),
          picture: record.speaker_profile_url || undefined,
        });
      } catch (bevyUpdateErr) {
        console.warn("[addManualSpeakerConfirmationAction] updateBevyPerson failed:", bevyUpdateErr);
      }
    } else {
      try {
        const { firstName, lastName } = splitFullName(record.full_name);
        const title = `${record.job_title}${record.company_institution ? ` at ${record.company_institution}` : ""}`;
        const createRes = await createBevyPerson(input.event_id, {
          first_name: firstName,
          last_name: lastName,
          title,
          bio:
            record.talk_description ||
            record.biography ||
            (record.talk_title ? `Speaker for: ${record.talk_title}` : ""),
          picture: record.speaker_profile_url || "",
        });
        if (createRes.success && createRes.data?.id) {
          record.bevy_person_id = createRes.data.id;
          record.bevy_synced = true;
          record.bevy_synced_at = new Date().toISOString();
        }
      } catch (bevyCreateErr) {
        console.warn("[addManualSpeakerConfirmationAction] createBevyPerson failed:", bevyCreateErr);
      }
    }

    if (input.send_invitation_email) {
      const emailResult = await dispatchSpeakerInvitationEmail(eventDoc, record);
      if (emailResult.success) {
        record.invitation_email_sent = true;
        record.invitation_email_sent_at = new Date().toISOString();
      } else {
        record.invitation_email_error = emailResult.error?.slice(0, 950);
      }
    }

    await patchFirestoreDoc(
      "event_speaker_confirmations",
      confirmationId,
      record as unknown as Record<string, unknown>,
      true,
    );

    // Sync to event presenter role list (speakers, mentors, facilitators, panelists, judges, moderators, hosts)
    try {
      const roleKey = record.presenter_role || "speakers";
      const currentList = Array.isArray(eventDoc[roleKey]) ? [...(eventDoc[roleKey] as BevySpeaker[])] : [];
      const { firstName, lastName } = splitFullName(record.full_name);

      const newSpeakerObj: BevySpeaker = {
        id: record.bevy_person_id || undefined,
        first_name: firstName,
        last_name: lastName,
        full_name: record.full_name,
        title: record.job_title,
        company: record.company_institution,
        bio: record.talk_description || record.biography || `Speaker for ${record.talk_title}`,
        picture: record.speaker_profile_url ? { url: record.speaker_profile_url } : undefined,
        picture_url: record.speaker_profile_url,
        speaker_type: record.talk_type,
        event_person_id: record.bevy_person_id || undefined,
      };

      const existingIdx = currentList.findIndex(
        (s) =>
          (record.bevy_person_id && s.id === record.bevy_person_id) ||
          s.full_name?.toLowerCase() === record.full_name.toLowerCase(),
      );

      if (existingIdx >= 0) {
        currentList[existingIdx] = { ...currentList[existingIdx], ...newSpeakerObj };
      } else {
        currentList.push(newSpeakerObj);
      }

      await patchFirestoreDoc("events", String(input.event_id), { [roleKey]: currentList }, true);
      await updateBevyEvent(input.event_id, { [roleKey]: currentList });
    } catch (eventSyncErr) {
      console.warn("[addManualSpeakerConfirmationAction] Failed updating event presenter array:", eventSyncErr);
    }

    revalidatePath(`/dashboard/events/${input.event_id}`);
    return { success: true, confirmationId };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to add speaker.") };
  }
}

export interface ExistingEventSlideOption {
  id: string;
  title: string;
  url: string;
  label: string;
}

export interface OfficialSlidePresetOption {
  id: string;
  label: string;
  url: string;
  is_default?: boolean;
}

/**
 * Loads official Short.io slide templates dynamically merged with static fallbacks,
 * plus slide templates from past and existing events in Firestore.
 */
export async function getExistingEventSlideTemplateOptionsAction(currentEventId: string | number): Promise<{
  success: boolean;
  options: ExistingEventSlideOption[];
  presets: Record<string, OfficialSlidePresetOption>;
}> {
  const options: ExistingEventSlideOption[] = [];
  const presets: Record<string, OfficialSlidePresetOption> = {
    gdg_default: { ...SPEAKER_SLIDE_TEMPLATE_PRESETS.gdg_default },
    devfest26: { ...SPEAKER_SLIDE_TEMPLATE_PRESETS.devfest26 },
  };

  // 1. Fetch dynamic Short.io link titles
  try {
    const domainId = process.env.SHORTIO_DOMAIN_ID;
    const apiKey = process.env.SHORTIO_API_KEY;
    if (domainId && apiKey) {
      const shortRes = await fetch(`https://api.short.io/api/links?domain_id=${domainId}&limit=150`, {
        headers: {
          authorization: apiKey,
          accept: "application/json",
        },
        signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(4000) : undefined,
      });
      if (shortRes.ok) {
        const shortData = (await shortRes.json()) as {
          links?: Array<{ path?: string; title?: string; secureShortURL?: string }>;
        };
        const links = shortData.links || [];
        for (const l of links) {
          if (!l.path) continue;
          if (l.path === "gdg-slide-template" && l.title?.trim()) {
            presets.gdg_default.label = l.title.trim();
            if (l.secureShortURL) presets.gdg_default.url = l.secureShortURL;
          } else if (
            (l.path === "devfest26-slide-template" || l.path === "devfest26-speaker-template") &&
            l.title?.trim()
          ) {
            presets.devfest26.label = l.title.trim();
            if (l.secureShortURL) presets.devfest26.url = l.secureShortURL;
          }
        }
      }
    }
  } catch (shortErr) {
    console.warn("[getExistingEventSlideTemplateOptionsAction] Could not refresh Short.io link titles:", shortErr);
  }

  // 2. Fetch past/existing events
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!projectId || !apiKey) return { success: true, options, presets };

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/events?pageSize=100&key=${apiKey}`;
    const res = await fetch(url, {
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6000) : undefined,
    });
    if (!res.ok) return { success: true, options: [], presets };

    const data = (await res.json()) as {
      documents?: Array<{
        name: string;
        fields?: Record<
          string,
          {
            stringValue?: string;
            mapValue?: { fields?: Record<string, { stringValue?: string }> };
            arrayValue?: {
              values?: Array<{
                mapValue?: { fields?: Record<string, { stringValue?: string }> };
              }>;
            };
          }
        >;
      }>;
    };

    const docs = data.documents || [];
    for (const doc of docs) {
      const docId = doc.name.split("/").pop();
      if (String(docId) === String(currentEventId)) continue;
      const f = doc.fields || {};
      const evTitle = f.title?.stringValue || `Event #${docId}`;

      // 1. Custom slide template URL on the event's speaker_config
      const customSpeakerUrl = f.speaker_config?.mapValue?.fields?.custom_slide_template_url?.stringValue?.trim();
      if (customSpeakerUrl) {
        options.push({
          id: `event_speaker_${docId}`,
          title: evTitle,
          url: customSpeakerUrl,
          label: `${evTitle} - Custom Speaker Template`,
        });
      }

      // 2. Presentation slides
      const slides = f.presentation_slides?.arrayValue?.values;
      if (Array.isArray(slides)) {
        for (let i = 0; i < slides.length; i++) {
          const sf = slides[i].mapValue?.fields || {};
          const slideUrl = sf.slides_url?.stringValue?.trim();
          const slideTitle =
            sf.title?.stringValue?.trim() || sf.slides_title?.stringValue?.trim() || "Presentation Slide";
          if (slideUrl) {
            options.push({
              id: `event_slide_${docId}_${i}`,
              title: evTitle,
              url: slideUrl,
              label: `${evTitle} - ${slideTitle}`,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[getExistingEventSlideTemplateOptionsAction] Error:", err);
  }
  return { success: true, options, presets };
}

/**
 * Updates the speaker invitation email template for an event.
 */
export async function updateEventSpeakerEmailTemplateAction(
  eventId: string | number,
  templateHtml: string,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  try {
    const existing = await getFirestoreEventByIdServer(String(eventId));
    const mergedTemplates = {
      ...(existing?.email_templates || {}),
      speaker_invitation: templateHtml,
    };

    await patchFirestoreDoc(
      "events",
      String(eventId),
      { email_templates: mergedTemplates as unknown as Record<string, unknown> },
      true,
    );
    revalidatePath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to update speaker invitation email template.") };
  }
}
