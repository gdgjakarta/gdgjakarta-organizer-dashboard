"use client";

import { collection, doc, getDocs, writeBatch } from "firebase/firestore";

import { resolveEventAudience } from "@/lib/bevy/audience";
import { splitFullName } from "@/lib/utils";
import {
  fetchAllBevyChapterMembersAction,
  fetchBevyChapterEventsAction,
  fetchBevyChapterTeamsAction,
} from "@/server/bevy-actions";

import { db, sanitizeFirestoreData, updateSyncMetadata } from "./client";
import type { FirestoreEvent } from "./types";

function cleanPayload<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return sanitizeFirestoreData(obj);
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
    const eventsResponse = await fetchBevyChapterEventsAction(100, 1, true, "Published");
    const bevyEvents = (eventsResponse?.results ?? []).filter((e) =>
      e.status ? e.status.toLowerCase() === "published" : true,
    );

    if (bevyEvents.length === 0) {
      return { success: true, totalSynced: 0 };
    }

    const batch = writeBatch(db);
    const now = new Date().toISOString();

    // Query existing event IDs to distinguish newly detected events
    const existingEventsSnap = await getDocs(collection(db, "events"));
    const existingIds = new Set(existingEventsSnap.docs.map((d) => d.id));

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

      const { audienceType, isVirtual } = resolveEventAudience(event.audience_type, event.is_virtual_event);

      const rawEventPayload: Record<string, unknown> = {
        id: eventId,
        title: event.title || "Untitled Event",
        description: event.description ?? null,
        description_short: event.description_short ?? null,
        status,
        start_date: event.start_date || now,
        end_date: event.end_date || event.start_date || now,
        picture_url:
          event.picture?.url ||
          event.picture?.thumbnail_url ||
          event.cropped_picture_url ||
          event.banner?.url ||
          event.banner?.thumbnail_url ||
          event.cropped_banner_url ||
          null,
        banner_url:
          event.banner?.url ||
          event.banner?.thumbnail_url ||
          event.cropped_banner_url ||
          event.picture?.url ||
          event.cropped_picture_url ||
          null,
        event_type_title: event.event_type_title || "Standard Event",
        audience_type: audienceType,
        is_virtual: isVirtual,
        venue:
          event.venue_name || event.venue_address || event.venue_city
            ? {
                name: event.venue_name,
                address: event.venue_address,
                city: event.venue_city,
              }
            : null,
        url: event.url || event.cohost_registration_url || null,
        static_url: event.static_url || null,
        tags: event.tags || [],
        is_hidden: Boolean(event.is_hidden || (event as { hidden?: boolean }).hidden),
        is_test: Boolean(event.is_test),
        total_registrations: event.total_attendees ?? 0,
        total_approved: event.total_attendees ?? 0,
        total_checked_in: event.checkin_count ?? 0,
        synced_from_bevy_at: now,
        updated_at: now,
      };

      if (!existingIds.has(eventId)) {
        rawEventPayload.registration_status = "Closed";
        rawEventPayload.custom_questions = [];
      }

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
 * Preserves primary Auth UID documents, never spawns duplicate numeric ID docs for existing members,
 * and chunks writes across Firestore batches to safely support higher sync volumes.
 */
export async function syncBevyMembersToFirestore(maxMembers = 1000): Promise<{
  success: boolean;
  totalSynced: number;
  error?: string;
}> {
  try {
    const [teamMembers, membersResponse, existingMembersSnap] = await Promise.all([
      fetchBevyChapterTeamsAction(),
      fetchAllBevyChapterMembersAction(maxMembers),
      getDocs(collection(db, "members")),
    ]);

    // Build index of existing Firestore members to deduplicate and prevent resurrecting numeric Bevy doc IDs
    const existingByEmail = new Map<string, { id: string; email: string; isAuthUid: boolean }>();
    const existingByBevyId = new Map<string, { id: string; email: string; isAuthUid: boolean }>();

    for (const d of existingMembersSnap.docs) {
      const data = d.data();
      const docId = d.id;
      const isAuthUid = !/^\d+$/.test(docId) && docId.length > 15;
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      const bevyId = data.bevy_user_id != null ? String(data.bevy_user_id).trim() : "";

      const record = { id: docId, email, isAuthUid };

      if (email && !email.includes("***") && !email.startsWith("user_") && email.includes("@")) {
        const prev = existingByEmail.get(email);
        // Prioritize Auth UID documents
        if (!prev || (!prev.isAuthUid && isAuthUid)) {
          existingByEmail.set(email, record);
        }
      }

      if (bevyId && bevyId !== "none" && bevyId !== "null" && bevyId !== "0" && bevyId !== "undefined") {
        const prev = existingByBevyId.get(bevyId);
        if (!prev || (!prev.isAuthUid && isAuthUid)) {
          existingByBevyId.set(bevyId, record);
        }
      }
    }

    interface TeamInfo {
      roleTitle: string;
      avatarUrl?: string | null;
      company?: string | null;
    }
    const teamMap = new Map<string, TeamInfo>();
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

      const teamInfo: TeamInfo = {
        roleTitle,
        avatarUrl: tm.user?.avatar?.url || tm.user?.avatar?.thumbnail_url || null,
        company: tm.user?.company || null,
      };

      if (email) teamMap.set(email, teamInfo);
      if (userId) teamMap.set(`id:${userId}`, teamInfo);
    }

    const fetchedMembers = membersResponse?.results || [];
    if (fetchedMembers.length === 0 && teamMembers.length === 0) {
      return { success: true, totalSynced: 0 };
    }

    const now = new Date().toISOString();
    let count = 0;
    const processedUserIds = new Set<string>();

    // Chunking writes across 400-doc batches to remain strictly below Firestore's 500 limit
    let currentBatch = writeBatch(db);
    let batchOpsCount = 0;

    const commitBatchIfFull = async () => {
      if (batchOpsCount >= 400) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        batchOpsCount = 0;
      }
    };

    for (const m of fetchedMembers) {
      const rawEmail = (m.user.email || "").trim();
      const cleanEmail = rawEmail.toLowerCase();
      const userId = String(m.user.id);
      processedUserIds.add(userId);

      // Determine authoritative target document ID:
      // Check if an existing member doc exists by clean email or by Bevy ID
      const existingMatch =
        (cleanEmail && !cleanEmail.includes("***") && !cleanEmail.startsWith("user_")
          ? existingByEmail.get(cleanEmail)
          : null) || existingByBevyId.get(userId);

      const targetDocId = existingMatch ? existingMatch.id : userId;

      const teamInfo = teamMap.get(cleanEmail) || teamMap.get(`id:${userId}`) || null;
      const organizerRole = teamInfo?.roleTitle || null;
      const displayName = m.user.full_name?.trim() || cleanEmail.split("@")[0] || "Community Member";
      const { firstName, lastName } = splitFullName(m.user.full_name?.trim() || displayName);

      const memberDocRef = doc(db, "members", targetDocId);

      // Never replace a real clean email with a placeholder user_* email
      const finalEmail =
        rawEmail && !rawEmail.includes("***") ? rawEmail : existingMatch?.email || `user_${m.user.id}@community.dev`;

      const rawMemberPayload: Record<string, unknown> = {
        id: targetDocId,
        bevy_user_id: m.user.id,
        bevy_member_id: m.id || null,
        name: displayName,
        first_name: firstName || null,
        last_name: lastName || null,
        email: finalEmail,
        role: organizerRole || "Member",
        chapter_role: organizerRole || null,
        team: organizerRole ? "Core Team" : "Community",
        status: "Active",
        joined_date: m.created_date || now,
        raw_created_date: m.created_date || now,
        avatar_url: teamInfo?.avatarUrl || m.user.avatar?.url || null,
        profile_url: m.user.profile_url || null,
        is_email_verified: Boolean(m.user.is_email_verified),
        company: teamInfo?.company || null,
        events_registered_count: m.events_registered_count ?? 0,
        synced_from_bevy_at: now,
        updated_at: now,
      };

      currentBatch.set(memberDocRef, cleanPayload(rawMemberPayload), { merge: true });
      batchOpsCount++;
      count++;
      await commitBatchIfFull();
    }

    // Explicitly guarantee all Chapter Team Members are synced into Firestore members collection
    for (const tm of teamMembers) {
      const userId = tm.user?.id ? String(tm.user.id) : String(tm.user_id || "");
      if (!userId || processedUserIds.has(userId)) continue;
      processedUserIds.add(userId);

      const rawEmail = (tm.user?.email || "").trim();
      const cleanEmail = rawEmail.toLowerCase();

      const existingMatch =
        (cleanEmail && !cleanEmail.includes("***") && !cleanEmail.startsWith("user_")
          ? existingByEmail.get(cleanEmail)
          : null) || existingByBevyId.get(userId);

      const targetDocId = existingMatch ? existingMatch.id : userId;

      const teamInfo = teamMap.get(cleanEmail) || teamMap.get(`id:${userId}`) || null;
      const organizerRole = teamInfo?.roleTitle || "Organizer";
      const displayName =
        tm.user?.full_name?.trim() ||
        [tm.user?.first_name, tm.user?.last_name].filter(Boolean).join(" ").trim() ||
        cleanEmail.split("@")[0] ||
        "Community Organizer";
      const { firstName, lastName } = splitFullName(displayName);

      const memberDocRef = doc(db, "members", targetDocId);
      const finalEmail = rawEmail || existingMatch?.email || "";

      const rawMemberPayload: Record<string, unknown> = {
        id: targetDocId,
        bevy_user_id: tm.user?.id ?? tm.user_id ?? userId,
        name: displayName,
        first_name: firstName || null,
        last_name: lastName || null,
        email: finalEmail,
        role: organizerRole,
        chapter_role: organizerRole,
        team: "Core Team",
        status: "Active",
        joined_date: now,
        raw_created_date: now,
        avatar_url: teamInfo?.avatarUrl || tm.user?.avatar?.url || null,
        company: teamInfo?.company || tm.user?.company || null,
        synced_from_bevy_at: now,
        updated_at: now,
      };

      currentBatch.set(memberDocRef, cleanPayload(rawMemberPayload), { merge: true });
      batchOpsCount++;
      count++;
      await commitBatchIfFull();
    }

    if (batchOpsCount > 0) {
      await currentBatch.commit();
    }

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
