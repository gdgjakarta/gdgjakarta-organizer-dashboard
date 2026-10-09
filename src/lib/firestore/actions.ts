"use client";

import { revalidateDashboardPath } from "@/server/server-actions";

import type { FirestoreRegistration, RegistrationStatus } from "./types";

/**
 * Triggers a full sync from Bevy into Firestore on the client.
 */
export async function triggerSyncAction() {
  const { syncAllBevyData } = await import("./sync-service");
  const result = await syncAllBevyData();
  await revalidateDashboardPath("/dashboard/organizer");
  await revalidateDashboardPath("/dashboard/events");
  await revalidateDashboardPath("/dashboard/members");
  return result;
}

/**
 * Triggers events-only sync on the client.
 */
export async function triggerEventsSyncAction() {
  const { syncBevyEventsToFirestore } = await import("./sync-service");
  const result = await syncBevyEventsToFirestore();
  await revalidateDashboardPath("/dashboard/events");
  return result;
}

/**
 * Triggers members-only sync on the client.
 */
export async function triggerMembersSyncAction() {
  const { syncBevyMembersToFirestore } = await import("./sync-service");
  const result = await syncBevyMembersToFirestore();
  await revalidateDashboardPath("/dashboard/members");
  return result;
}

/**
 * Fetch registrations for an event.
 */
export async function fetchEventRegistrationsAction(eventId: string) {
  const { getEventRegistrations } = await import("./client");
  return await getEventRegistrations(eventId);
}

/**
 * Check if a specific member/email is registered for an event.
 */
export async function checkEventRegistrationAction(eventId: string, memberId?: string, email?: string) {
  const { checkExistingRegistration } = await import("./client");
  return await checkExistingRegistration(eventId, memberId, email);
}

/**
 * Fetch registrations for a specific member by ID or email.
 */
export async function fetchMemberRegistrationsAction(memberId?: string, email?: string) {
  const { getMemberRegistrations } = await import("./client");
  return await getMemberRegistrations(memberId, email);
}

/**
 * Update registration status (Approve / Reject / Waitlist / Attend)
 */
export async function updateRegistrationStatusAction(
  registrationId: string,
  eventId: string,
  status: RegistrationStatus,
  reviewer?: { id: string; name: string; email?: string },
  notes?: string,
) {
  const { updateRegistrationStatus } = await import("./client");
  await updateRegistrationStatus(registrationId, eventId, status, reviewer, notes);
  await revalidateDashboardPath("/dashboard/events");
  await revalidateDashboardPath(`/dashboard/events/${eventId}`);
  return { success: true };
}

/**
 * Update answers and session on an existing pending registration.
 */
export async function updateRegistrationAnswersAction(
  registrationId: string,
  eventId: string,
  data: {
    answers: Record<string, unknown>;
    session_id?: string;
    session_title?: string;
  },
) {
  try {
    const { updateRegistrationAnswers } = await import("./client");
    await updateRegistrationAnswers(registrationId, eventId, data);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath("/dashboard/my-events");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update registration answers.";
    console.error("[updateRegistrationAnswersAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Register a member for an event.
 */
export async function registerForEventAction(registration: Omit<FirestoreRegistration, "id">) {
  try {
    if (!registration.member_id || !registration.member_email.trim()) {
      return {
        success: false,
        error: "You must join the community by signing in with Google before registering.",
      };
    }
    const { registerMemberForEvent } = await import("./client");
    const regId = await registerMemberForEvent(registration);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath(`/dashboard/events/${registration.event_id}`);
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/organizer");
    return { success: true, registrationId: regId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to register for event.";
    console.error("[registerForEventAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Get sync metadata status.
 */
export async function fetchSyncMetadataAction() {
  const { getSyncMetadata } = await import("./client");
  return await getSyncMetadata();
}

/**
 * Fetch and save FAQ content
 */
export async function fetchFaqContentAction() {
  const { getFaqContentDoc } = await import("./client");
  return await getFaqContentDoc();
}

export async function saveFaqContentAction(content: import("@/lib/content/types").FaqContent) {
  try {
    const { saveFaqContentDoc } = await import("./client");
    await saveFaqContentDoc(content);
    await revalidateDashboardPath("/faq");
    await revalidateDashboardPath("/dashboard/faq");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save FAQ content";
    console.error("[saveFaqContentAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Fetch and save Partnership content
 */
export async function fetchPartnershipContentAction() {
  const { getPartnershipContentDoc } = await import("./client");
  return await getPartnershipContentDoc();
}

export async function savePartnershipContentAction(content: import("@/lib/content/types").PartnershipContent) {
  try {
    const { savePartnershipContentDoc } = await import("./client");
    await savePartnershipContentDoc(content);
    await revalidateDashboardPath("/partnership");
    await revalidateDashboardPath("/dashboard/partnership");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save Partnership content";
    console.error("[savePartnershipContentAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event tickets and per-person purchase limits
 */
export async function updateEventTicketsAction(
  eventId: string,
  tickets: import("./types").EventTicketTier[],
  maxTicketsPerPerson?: number | null,
) {
  try {
    const { updateEventTickets } = await import("./client");
    await updateEventTickets(eventId, tickets, maxTicketsPerPerson);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save tickets.";
    console.error("[updateEventTicketsAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event merchandise items and purchase limits
 */
export async function updateEventMerchandiseAction(
  eventId: string,
  merchandise: import("./types").EventMerchandiseItem[],
  maxMerchandisePerPerson?: number | null,
) {
  try {
    const { updateEventMerchandise } = await import("./client");
    await updateEventMerchandise(eventId, merchandise, maxMerchandisePerPerson);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save merchandise.";
    console.error("[updateEventMerchandiseAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event email templates for n8n automation
 */
export async function updateEventEmailTemplatesAction(
  eventId: string,
  emailTemplates: import("./types").EventEmailTemplates,
) {
  try {
    const { updateEventEmailTemplates } = await import("./client");
    await updateEventEmailTemplates(eventId, emailTemplates);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save email templates.";
    console.error("[updateEventEmailTemplatesAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update attendee check-in state in Firestore
 */
export async function updateRegistrationCheckInAction(
  registrationId: string,
  eventId: string,
  isCheckedIn: boolean,
  bevyAttendeeId?: number | null,
  checkinDate?: string | null,
) {
  try {
    const { updateRegistrationCheckIn } = await import("./client");
    await updateRegistrationCheckIn(registrationId, eventId, isCheckedIn, bevyAttendeeId, checkinDate);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update check-in status.";
    console.error("[updateRegistrationCheckInAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Update event highlights and post-event media
 */
export async function updateEventHighlightsMediaAction(
  eventId: string,
  data: {
    highlight_video_url?: string;
    highlight_video_title?: string;
    photo_album_url?: string;
    photo_album_title?: string;
    recap_description?: string;
    sessions?: import("./types").EventSession[];
  },
) {
  try {
    const { updateEventHighlightsMedia } = await import("./client");
    await updateEventHighlightsMedia(eventId, data);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save highlights and media.";
    console.error("[updateEventHighlightsMediaAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Remove an event registration so the attendee can re-register again.
 */
export async function deleteEventRegistrationAction(registrationId: string, eventId: string) {
  try {
    const { deleteEventRegistration } = await import("./client");
    await deleteEventRegistration(registrationId, eventId);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath("/dashboard/organizer");
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath(`/dashboard/member/events/${eventId}`);
    await revalidateDashboardPath(`/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove attendee registration.";
    console.error("[deleteEventRegistrationAction] error:", message);
    return { success: false, error: message };
  }
}

/**
 * Remove multiple event registrations in batch so attendees can re-register again.
 */
export async function deleteBatchEventRegistrationsAction(registrationIds: string[], eventId: string) {
  try {
    const { deleteBatchEventRegistrations } = await import("./client");
    await deleteBatchEventRegistrations(registrationIds, eventId);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    await revalidateDashboardPath("/dashboard/events");
    await revalidateDashboardPath("/dashboard/organizer");
    await revalidateDashboardPath("/dashboard/member");
    await revalidateDashboardPath("/dashboard/member/my-events");
    await revalidateDashboardPath(`/dashboard/member/events/${eventId}`);
    await revalidateDashboardPath(`/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove attendee registrations.";
    console.error("[deleteBatchEventRegistrationsAction] error:", message);
    return { success: false, error: message };
  }
}
