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
  reviewer?: { id: string; name: string },
  notes?: string,
) {
  const { updateRegistrationStatus } = await import("./client");
  await updateRegistrationStatus(registrationId, eventId, status, reviewer, notes);
  await revalidateDashboardPath("/dashboard/events");
  await revalidateDashboardPath(`/dashboard/events/${eventId}`);
  return { success: true };
}

/**
 * Register a member for an event.
 */
export async function registerForEventAction(registration: Omit<FirestoreRegistration, "id">) {
  try {
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
 * Update event merchandise items
 */
export async function updateEventMerchandiseAction(
  eventId: string,
  merchandise: import("./types").EventMerchandiseItem[],
) {
  try {
    const { updateEventMerchandise } = await import("./client");
    await updateEventMerchandise(eventId, merchandise);
    await revalidateDashboardPath(`/dashboard/events/${eventId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save merchandise.";
    console.error("[updateEventMerchandiseAction] error:", message);
    return { success: false, error: message };
  }
}
