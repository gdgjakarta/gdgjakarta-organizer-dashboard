"use server";

import { revalidatePath } from "next/cache";

import {
  getEventRegistrations,
  getMemberRegistrations,
  getSyncMetadata,
  registerMemberForEvent,
  updateRegistrationStatus,
} from "@/lib/firestore/client";
import { syncAllBevyData, syncBevyEventsToFirestore, syncBevyMembersToFirestore } from "@/lib/firestore/sync-service";
import type { FirestoreRegistration, RegistrationStatus } from "@/lib/firestore/types";

/**
 * Triggers a full sync from Bevy into Firestore.
 */
export async function triggerSyncAction() {
  const result = await syncAllBevyData();
  revalidatePath("/dashboard/organizer");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/members");
  return result;
}

/**
 * Triggers events-only sync.
 */
export async function triggerEventsSyncAction() {
  const result = await syncBevyEventsToFirestore();
  revalidatePath("/dashboard/events");
  return result;
}

/**
 * Triggers members-only sync.
 */
export async function triggerMembersSyncAction() {
  const result = await syncBevyMembersToFirestore();
  revalidatePath("/dashboard/members");
  return result;
}

/**
 * Fetch registrations for an event.
 */
export async function fetchEventRegistrationsAction(eventId: string) {
  return await getEventRegistrations(eventId);
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
  revalidatePath("/dashboard/events");
  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true };
}

/**
 * Register a member for an event.
 */
export async function registerForEventAction(registration: Omit<FirestoreRegistration, "id">) {
  try {
    const regId = await registerMemberForEvent(registration);
    revalidatePath("/dashboard/events");
    revalidatePath(`/dashboard/events/${registration.event_id}`);
    revalidatePath("/dashboard/member");
    revalidatePath("/dashboard/organizer");
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
