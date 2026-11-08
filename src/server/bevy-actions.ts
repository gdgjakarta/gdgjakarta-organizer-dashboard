"use server";
import { revalidatePath } from "next/cache";

import {
  type AddBevyChapterTeamMemberParams,
  addBevyChapterTeamMember,
  createBevyExternalEvent,
  deleteBevyAttendee,
  deleteBevyChapterTeamMember,
  findBevyAttendeeIdByEmail,
  generateBevyAiEventDetails,
  getAllBevyChapterEvents,
  getAllBevyEventAttendees,
  getBevyChapterEvents,
  getBevyChapterMembers,
  getBevyChapterTeams,
  getBevyEventAttendees,
  getMemberById,
  importMemberToBevy,
  modifyBevyAiEventContent,
  putBevyAttendeeCheckIn,
  searchBevyChapterMembers,
  type UpdateBevyChapterTeamMemberParams,
  updateBevyChapterTeamMember,
  updateBevyEvent,
} from "@/lib/bevy/client";
import type {
  BevyAiContentModificationParams,
  BevyChapterTeamMember,
  BevyCreateEventInput,
  BevyUpdateEventInput,
  BevyUser,
} from "@/lib/bevy/types";

/**
 * Server action to fetch Bevy chapter events safely on the server
 */
export async function fetchBevyChapterEventsAction(
  pageSize = 100,
  page = 1,
  includeHidden = true,
  status = "Published",
) {
  return await getBevyChapterEvents(undefined, pageSize, page, includeHidden, status);
}

/**
 * Server action to fetch all Bevy chapter events across all pages safely on the server
 */
export async function fetchAllBevyChapterEventsAction(includeHidden = true, status = "All") {
  return await getAllBevyChapterEvents(undefined, includeHidden, status);
}

export async function getAllEventsAction(includeHidden = true, status = "All") {
  return await fetchAllBevyChapterEventsAction(includeHidden, status);
}

import { isAuthorizedOrganizerSession } from "./auth-guard";

/**
 * Server action to fetch Bevy chapter members safely on the server.
 * Protected: requires an active organizer session.
 */
export async function fetchBevyChapterMembersAction(pageSize = 200, page = 1, orderBy = "-created_date") {
  if (!(await isAuthorizedOrganizerSession())) {
    console.warn("[Security] Blocked unauthorized attempt to fetch Bevy chapter members");
    return { count: 0, results: [] };
  }
  return await getBevyChapterMembers(undefined, pageSize, page, orderBy);
}

/**
 * Server action to search across all Bevy chapter members using Bevy's Algolia index.
 * Protected: requires an active organizer session.
 */
export async function searchBevyChapterMembersAction(query: string) {
  if (!(await isAuthorizedOrganizerSession())) {
    console.warn("[Security] Blocked unauthorized attempt to search Bevy chapter members");
    return [];
  }
  return await searchBevyChapterMembers(query);
}

/**
 * Server action to fetch Bevy chapter teams safely on the server.
 * Protected: requires an active organizer session.
 */
export async function fetchBevyChapterTeamsAction() {
  if (!(await isAuthorizedOrganizerSession())) {
    console.warn("[Security] Blocked unauthorized attempt to fetch Bevy chapter teams");
    return [];
  }
  return await getBevyChapterTeams();
}

/**
 * Server action to look up a user on Bevy by email.
 * Protected: requires an active organizer session.
 */
export async function findBevyUserByEmailAction(email: string): Promise<{
  success: boolean;
  data?: BevyUser | null;
  error?: string;
}> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized. Organizer session required." };
  }

  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail?.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  try {
    const result = await getMemberById(cleanEmail);
    if (!result.ok || !result.data) {
      return { success: false, error: "User not found on Bevy. They may need to create an account first." };
    }
    return { success: true, data: result.data };
  } catch (error) {
    console.error("[findBevyUserByEmailAction] Error:", error);
    return { success: false, error: "Failed to find user on Bevy." };
  }
}

/**
 * Server action to add a member to the Bevy chapter team.
 * Protected: requires an active organizer session.
 */
export async function addBevyChapterTeamMemberAction(params: AddBevyChapterTeamMemberParams): Promise<{
  success: boolean;
  data?: BevyChapterTeamMember | null;
  error?: string;
}> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized. Organizer session required." };
  }

  const result = await addBevyChapterTeamMember(params);
  if (result.success) {
    try {
      revalidatePath("/dashboard/members");
      revalidatePath("/dashboard/organizer");
    } catch (e) {
      console.debug("[revalidatePath] Cache revalidation skipped:", e);
    }
  }
  return result;
}

/**
 * Server action to remove a member from the Bevy chapter team.
 * Protected: requires an active organizer session.
 */
export async function deleteBevyChapterTeamMemberAction(teamMemberId: string | number): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized. Organizer session required." };
  }

  const result = await deleteBevyChapterTeamMember(teamMemberId);
  if (result.success) {
    try {
      revalidatePath("/dashboard/members");
      revalidatePath("/dashboard/organizer");
    } catch (e) {
      console.debug("[revalidatePath] Cache revalidation skipped:", e);
    }
  }
  return result;
}

/**
 * Server action to update a member on the Bevy chapter team.
 * Protected: requires an active organizer session.
 */
export async function updateBevyChapterTeamMemberAction(params: UpdateBevyChapterTeamMemberParams): Promise<{
  success: boolean;
  data?: BevyChapterTeamMember | null;
  error?: string;
}> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized. Organizer session required." };
  }

  const result = await updateBevyChapterTeamMember(params);
  if (result.success) {
    try {
      revalidatePath("/dashboard/members");
      revalidatePath("/dashboard/organizer");
    } catch (e) {
      console.debug("[revalidatePath] Cache revalidation skipped:", e);
    }
  }
  return result;
}

/**
 * Server action to fetch a Bevy member by ID or email.
 * Protected: requires an active organizer session.
 */
export async function fetchBevyMemberByIdAction(identifier: string) {
  if (!(await isAuthorizedOrganizerSession())) {
    console.warn(`[Security] Blocked unauthorized attempt to fetch Bevy member by ID: ${identifier}`);
    return null;
  }
  return await getMemberById(identifier);
}

/**
 * Server action to import a new member into Bevy via the GDG Jakarta webhook
 */
export async function importBevyMemberAction(params: { firstName: string; lastName?: string; email: string }) {
  return await importMemberToBevy(params);
}

/**
 * Server action to fetch Bevy event attendees safely on the server.
 * Protected: requires an active organizer session.
 */
export async function fetchBevyEventAttendeesAction(eventId: string | number, pageSize = 200, page = 1) {
  if (!(await isAuthorizedOrganizerSession())) {
    console.warn("[Security] Blocked unauthorized attempt to fetch Bevy event attendees");
    return { count: 0, results: [] };
  }
  return await getBevyEventAttendees(eventId, undefined, { pageSize, page });
}

/**
 * Server action to fetch all Bevy event attendees across all pages safely on the server.
 * Protected: requires an active organizer session.
 */
export async function fetchAllBevyEventAttendeesAction(eventId: string | number) {
  if (!(await isAuthorizedOrganizerSession())) {
    console.warn("[Security] Blocked unauthorized attempt to fetch all Bevy event attendees");
    return { success: false, count: 0, results: [], error: "Unauthorized session" };
  }
  return await getAllBevyEventAttendees(eventId);
}

/**
 * Server action to toggle check-in for an attendee in Bevy.
 * Protected: requires an active organizer session.
 */
export async function checkInBevyAttendeeAction(eventId: string | number, attendeeId: number, isCheckedIn: boolean) {
  if (!(await isAuthorizedOrganizerSession())) {
    console.warn("[Security] Blocked unauthorized attempt to check in Bevy attendee");
    return { success: false, error: "Unauthorized session" };
  }
  return await putBevyAttendeeCheckIn(eventId, attendeeId, isCheckedIn);
}

/**
 * Server action to delete an attendee from Bevy using session spoofing.
 * Protected: requires an active organizer session.
 *
 * Endpoint: DELETE https://gdg.community.dev/api/attendee/{attendeeId}/
 */
export async function deleteBevyAttendeeAction(attendeeId: string | number, eventId?: string | number) {
  if (!(await isAuthorizedOrganizerSession())) {
    console.warn("[Security] Blocked unauthorized attempt to delete Bevy attendee");
    return { success: false, error: "Unauthorized session" };
  }
  return await deleteBevyAttendee(attendeeId, eventId);
}

/**
 * Server action to batch delete attendees from Bevy using session spoofing.
 * Protected: requires an active organizer session.
 */
export async function deleteBatchBevyAttendeesAction(attendeeIds: (string | number)[], eventId?: string | number) {
  if (!(await isAuthorizedOrganizerSession())) {
    console.warn("[Security] Blocked unauthorized attempt to batch delete Bevy attendees");
    return { success: false, error: "Unauthorized session" };
  }
  const results = await Promise.allSettled(attendeeIds.map((id) => deleteBevyAttendee(id, eventId)));
  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
  return { success: true, count: succeeded, total: attendeeIds.length };
}

/**
 * Server action to remove an attendee from Bevy by attendee ID or email.
 * Always called before removing attendee registration from dashboard.
 *
 * Endpoint: DELETE https://gdg.community.dev/api/attendee/{attendeeId}/
 */
export async function removeAttendeeFromBevyAction(params: {
  eventId: string | number;
  attendeeId?: string | number | null;
  attendeeEmail?: string | null;
}): Promise<{ success: boolean; error?: string; attendeeId?: number | string | null; notFoundOnBevy?: boolean }> {
  try {
    const { eventId, attendeeId, attendeeEmail } = params;
    const cleanEmail = attendeeEmail?.toLowerCase().trim();

    let resolvedId = attendeeId ? String(attendeeId).trim() : null;

    // If attendee ID is not provided or empty, resolve it from Bevy by email
    if (!resolvedId && cleanEmail) {
      console.log(
        `[removeAttendeeFromBevyAction] Looking up Bevy attendee ID by email ${cleanEmail} for event ${eventId}...`,
      );
      const foundId = await findBevyAttendeeIdByEmail(eventId, cleanEmail);
      if (foundId) {
        resolvedId = String(foundId);
        console.log(`[removeAttendeeFromBevyAction] Resolved Bevy attendee ID ${resolvedId} for ${cleanEmail}`);
      } else {
        console.log(
          `[removeAttendeeFromBevyAction] Attendee ${cleanEmail} not found on Bevy for event ${eventId}. Already absent.`,
        );
        return { success: true, notFoundOnBevy: true };
      }
    }

    if (!resolvedId) {
      console.warn(
        `[removeAttendeeFromBevyAction] Neither attendeeId nor matching attendeeEmail found for event ${eventId}.`,
      );
      return { success: true, notFoundOnBevy: true };
    }

    console.log(`[removeAttendeeFromBevyAction] Removing attendee ${resolvedId} from Bevy for event ${eventId}...`);
    const result = await deleteBevyAttendee(resolvedId, eventId);

    // If deletion returned 404 (already deleted) or success: true
    if (result.success || result.status === 404) {
      return { success: true, attendeeId: resolvedId };
    }

    // If first attempt with passed ID returned non-404 error, and email is available, try looking up fresh ID
    if (cleanEmail && resolvedId === String(attendeeId)) {
      console.log(
        `[removeAttendeeFromBevyAction] Attempt with provided ID ${resolvedId} failed (${result.error}). Retrying lookup by email ${cleanEmail}...`,
      );
      const freshId = await findBevyAttendeeIdByEmail(eventId, cleanEmail);
      if (freshId && String(freshId) !== resolvedId) {
        const retryResult = await deleteBevyAttendee(freshId, eventId);
        if (retryResult.success || retryResult.status === 404) {
          return { success: true, attendeeId: freshId };
        }
      }
    }

    return { success: false, error: result.error, attendeeId: resolvedId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to remove attendee from Bevy";
    console.error("[removeAttendeeFromBevyAction] error:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server action to fetch full Bevy event details (including agenda and speakers).
 */
export async function fetchBevyEventDetailAction(eventId: string | number) {
  const { getBevyEventById } = await import("@/lib/bevy/client");
  return await getBevyEventById(eventId);
}

/**
 * Server action to create a new Bevy event configured with external registration.
 */
export async function createBevyEventAction(input: BevyCreateEventInput) {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  const result = await createBevyExternalEvent(input);
  if (result.success && result.data?.id) {
    revalidatePath("/dashboard/events");
    revalidatePath("/events");
    revalidatePath(`/dashboard/events/${result.data.id}`);
  }
  return result;
}

/**
 * Server action to update an existing Bevy event (capacity, external ticket link, etc.).
 */
export async function updateBevyEventAction(eventId: string | number, payload: BevyUpdateEventInput) {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  const result = await updateBevyEvent(eventId, payload);
  if (result.success) {
    const finalStatus = result.data?.status || payload.status;
    const finalTitle = result.data?.title || payload.title;

    // Sync patched fields to Firestore doc if available
    try {
      const { patchFirestoreDoc } = await import("@/server/firestore-admin");
      const fsPatch: Record<string, unknown> = {};
      if (finalTitle !== undefined) fsPatch.title = finalTitle;
      if (payload.description !== undefined) fsPatch.description = payload.description;
      if (payload.description_short !== undefined) fsPatch.description_short = payload.description_short;
      if (payload.total_capacity !== undefined) fsPatch.total_capacity = Number(payload.total_capacity);
      if (finalStatus !== undefined) fsPatch.status = finalStatus;
      if (payload.tags !== undefined) fsPatch.tags = payload.tags;
      if (payload.audience_type !== undefined) fsPatch.audience_type = payload.audience_type;
      if (payload.virtual_event_type !== undefined) fsPatch.virtual_event_type = payload.virtual_event_type;
      if (payload.virtual_venue_link !== undefined) fsPatch.attendee_virtual_venue_link = payload.virtual_venue_link;
      if (result.data?.join_virtual_event_url) {
        fsPatch.join_virtual_event_url = result.data.join_virtual_event_url;
      }
      if (payload.virtual_event_instructions !== undefined)
        fsPatch.virtual_event_instructions = payload.virtual_event_instructions;
      if (payload.automatically_record_event !== undefined)
        fsPatch.automatically_record_event = payload.automatically_record_event;
      if (payload.moderated_qa_enabled !== undefined) fsPatch.moderated_qa_enabled = payload.moderated_qa_enabled;
      if (payload.chat_disabled !== undefined) fsPatch.chat_disabled = payload.chat_disabled;
      if (payload.is_many_to_many_virtual_event !== undefined)
        fsPatch.is_many_to_many_virtual_event = payload.is_many_to_many_virtual_event;
      if (payload.start_date !== undefined) fsPatch.start_date = payload.start_date;
      if (payload.end_date !== undefined) fsPatch.end_date = payload.end_date;
      if (payload.is_test !== undefined) fsPatch.is_test = payload.is_test;
      if (payload.is_hidden !== undefined) fsPatch.is_hidden = payload.is_hidden;
      fsPatch.custom_tickets_url = payload.custom_tickets_url || `https://gdgjakarta.com/events/${eventId}`;
      if (payload.agenda !== undefined) {
        fsPatch.agenda = typeof payload.agenda === "string" ? JSON.parse(payload.agenda) : payload.agenda;
      }
      if (payload.venue_name || payload.venue_address || payload.venue_city || payload.venue_zip_code) {
        fsPatch.venue = {
          name: payload.venue_name || "",
          address: payload.venue_address || "",
          city: payload.venue_city || "",
          zip_code: payload.venue_zip_code || "",
          country: payload.venue_country || "ID",
          state: payload.venue_state || "Daerah Khusus Ibukota Jakarta",
          latitude: payload.venue_latitude,
          longitude: payload.venue_longitude,
        };
      }

      if (Object.keys(fsPatch).length > 0) {
        await patchFirestoreDoc("events", String(eventId), fsPatch, true);
      }
    } catch (fsErr) {
      console.warn("[updateBevyEventAction] Non-fatal: failed to patch firestore doc:", fsErr);
    }

    revalidatePath("/dashboard/events");
    revalidatePath("/events");
    revalidatePath(`/dashboard/events/${eventId}`);
    revalidatePath(`/events/${eventId}`);
  }
  return result;
}

/**
 * Server action to cancel an event on Bevy before it starts ({ status: "Canceled" }).
 */
export async function cancelBevyEventAction(eventId: string | number) {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  const result = await updateBevyEvent(eventId, { status: "Canceled" });
  if (result.success) {
    // Also mark in Firestore if doc exists
    try {
      const { patchFirestoreDoc } = await import("@/server/firestore-admin");
      await patchFirestoreDoc("events", String(eventId), { status: "Canceled" }, true);
    } catch (fsErr) {
      console.warn("[cancelBevyEventAction] Non-fatal: failed to patch firestore status:", fsErr);
    }

    revalidatePath("/dashboard/events");
    revalidatePath("/events");
    revalidatePath(`/dashboard/events/${eventId}`);
    revalidatePath(`/events/${eventId}`);
  }
  return result;
}

/**
 * Server action to generate event title and description using Bevy's AI endpoint.
 */
export async function generateBevyAiEventAction(topic: string) {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  return await generateBevyAiEventDetails(topic);
}

/**
 * Server action to modify (regenerate, shorten, rewrite) event title or description via Bevy AI.
 */
export async function modifyBevyAiEventContentAction(params: BevyAiContentModificationParams) {
  if (!(await isAuthorizedOrganizerSession())) {
    return { success: false, error: "Unauthorized: Organizer privileges required" };
  }

  return await modifyBevyAiEventContent(params);
}
