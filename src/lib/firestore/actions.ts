"use client";

import { revalidateDashboardPath } from "@/server/server-actions";

import {
  checkExistingRegistration,
  getEventRegistrations,
  getMemberRegistrations,
  getSyncMetadata,
  registerMemberForEvent,
  updateRegistrationStatus,
} from "./client";
import { syncAllBevyData, syncBevyEventsToFirestore, syncBevyMembersToFirestore } from "./sync-service";
import type { FirestoreRegistration, RegistrationStatus } from "./types";

/**
 * Triggers a full sync from Bevy into Firestore on the client.
 */
export async function triggerSyncAction() {
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
  const result = await syncBevyEventsToFirestore();
  await revalidateDashboardPath("/dashboard/events");
  return result;
}

/**
 * Triggers members-only sync on the client.
 */
export async function triggerMembersSyncAction() {
  const result = await syncBevyMembersToFirestore();
  await revalidateDashboardPath("/dashboard/members");
  return result;
}

/**
 * Fetch registrations for an event.
 */
export async function fetchEventRegistrationsAction(eventId: string) {
  return await getEventRegistrations(eventId);
}

/**
 * Check if a specific member/email is registered for an event.
 */
export async function checkEventRegistrationAction(eventId: string, memberId?: string, email?: string) {
  return await checkExistingRegistration(eventId, memberId, email);
}

/**
 * Fetch registrations for a specific member by ID or email.
 */
export async function fetchMemberRegistrationsAction(memberId?: string, email?: string) {
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
  return await getSyncMetadata();
}
