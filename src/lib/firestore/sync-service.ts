import { doc, writeBatch } from "firebase/firestore";

import { db } from "@/config/firebase";
import { getBevyChapterEvents, getBevyChapterMembers, getBevyChapterTeams } from "@/lib/bevy/client";

import { updateSyncMetadata } from "./client";
import type { FirestoreEvent } from "./types";

function cleanPayload<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Syncs events from Bevy into Firestore.
 * Preserves custom registration fields and dashboard configurations using merge writes.
 */
export async function syncBevyEventsToFirestore(): Promise<{
  success: boolean;
  totalSynced: number;
  error?: string;
}> {
  try {
    const eventsResponse = await getBevyChapterEvents(undefined, 100, 1);
    const bevyEvents = eventsResponse?.results ?? [];

    if (bevyEvents.length === 0) {
      return { success: true, totalSynced: 0 };
    }

    const batch = writeBatch(db);
    const now = new Date().toISOString();

    for (const event of bevyEvents) {
      const eventId = String(event.id);
      const docRef = doc(db, "events", eventId);

      const rawStatus = event.status || (event.completed ? "Completed" : "Published");
      let status: FirestoreEvent["status"] = "Published";
      if (rawStatus === "Canceled" || rawStatus === "Cancelled") {
        status = "Canceled";
      } else if (rawStatus === "Draft") {
        status = "Draft";
      } else if (rawStatus === "Completed" || event.completed) {
        status = "Completed";
      }

      const rawEventPayload: Record<string, unknown> = {
        id: eventId,
        title: event.title || "Untitled Event",
        description: event.description ?? null,
        description_short: event.description_short ?? null,
        status,
        start_date: event.start_date || now,
        end_date: event.end_date || event.start_date || now,
        picture_url: event.picture?.thumbnail_url || event.picture?.url || event.banner?.thumbnail_url || null,
        banner_url: event.banner?.url || event.cropped_banner_url || null,
        event_type_title: event.event_type_title || "Standard Event",
        audience_type: event.audience_type || (event.is_virtual_event ? "VIRTUAL" : "IN_PERSON"),
        is_virtual: Boolean(event.is_virtual_event || event.audience_type === "VIRTUAL"),
        url: event.url || event.cohost_registration_url || null,
        static_url: event.static_url || null,
        tags: event.tags || [],
        requires_approval: false, // Default to open RSVP unless modified by organizer
        total_registrations: event.total_attendees ?? 0,
        total_approved: event.total_attendees ?? 0,
        total_checked_in: event.checkin_count ?? 0,
        synced_from_bevy_at: now,
        updated_at: now,
      };

      batch.set(docRef, cleanPayload(rawEventPayload), { merge: true });
    }

    await batch.commit();

    await updateSyncMetadata({
      last_synced_events_at: now,
      total_events_synced: bevyEvents.length,
      status: "success",
    });

    return { success: true, totalSynced: bevyEvents.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Sync Service] syncBevyEventsToFirestore failed:", error);
    await updateSyncMetadata({ status: "error", error_message: errorMsg });
    return { success: false, totalSynced: 0, error: errorMsg };
  }
}

/**
 * Syncs chapter members & core team from Bevy into Firestore.
 */
export async function syncBevyMembersToFirestore(): Promise<{
  success: boolean;
  totalSynced: number;
  error?: string;
}> {
  try {
    const [teamMembers, membersResponse] = await Promise.all([
      getBevyChapterTeams(),
      getBevyChapterMembers(undefined, 200, 1),
    ]);

    const teamMap = new Map<string, string>();
    for (const tm of teamMembers) {
      const email = tm.user?.email?.toLowerCase();
      const userId = tm.user?.id ? String(tm.user.id) : String(tm.user_id || "");
      let roleTitle = "Organizer";

      if (typeof tm.role === "object" && tm.role !== null && "name" in tm.role && tm.role.name) {
        roleTitle = tm.role.name;
      } else if (typeof tm.role === "string" && tm.role) {
        roleTitle = tm.role;
      } else if (tm.title) {
        roleTitle = tm.title;
      }

      if (email) teamMap.set(email, roleTitle);
      if (userId) teamMap.set(`id:${userId}`, roleTitle);
    }

    const fetchedMembers = membersResponse?.results || [];
    if (fetchedMembers.length === 0 && teamMembers.length === 0) {
      return { success: true, totalSynced: 0 };
    }

    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let count = 0;

    for (const m of fetchedMembers) {
      const email = m.user.email || `user_${m.user.id}@community.dev`;
      const userId = String(m.user.id);
      const organizerRole = teamMap.get(email.toLowerCase()) || teamMap.get(`id:${userId}`) || null;

      const memberDocRef = doc(db, "members", userId);
      const rawMemberPayload: Record<string, unknown> = {
        id: userId,
        bevy_user_id: m.user.id,
        name: m.user.full_name || "Community Member",
        email,
        role: organizerRole || "Member",
        chapter_role: organizerRole || null,
        team: organizerRole ? "Core Team" : "Community",
        status: "Active",
        joined_date: m.created_date || now,
        avatar_url: m.user.avatar?.url || null,
        events_registered_count: m.events_registered_count ?? 0,
        synced_from_bevy_at: now,
        updated_at: now,
      };

      batch.set(memberDocRef, cleanPayload(rawMemberPayload), { merge: true });
      count++;
    }

    await batch.commit();

    await updateSyncMetadata({
      last_synced_members_at: now,
      total_members_synced: count,
      status: "success",
    });

    return { success: true, totalSynced: count };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Sync Service] syncBevyMembersToFirestore failed:", error);
    await updateSyncMetadata({ status: "error", error_message: errorMsg });
    return { success: false, totalSynced: 0, error: errorMsg };
  }
}

/**
 * Full synchronization of both Events and Members.
 */
export async function syncAllBevyData(): Promise<{
  eventsSynced: number;
  membersSynced: number;
  success: boolean;
  error?: string;
}> {
  await updateSyncMetadata({ status: "syncing" });

  const eventsResult = await syncBevyEventsToFirestore();
  const membersResult = await syncBevyMembersToFirestore();

  const success = eventsResult.success && membersResult.success;
  return {
    eventsSynced: eventsResult.totalSynced,
    membersSynced: membersResult.totalSynced,
    success,
    error: eventsResult.error ?? membersResult.error,
  };
}
