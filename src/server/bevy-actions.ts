"use server";
import {
  deleteBevyAttendee,
  findBevyAttendeeIdByEmail,
  getAllBevyChapterEvents,
  getAllBevyEventAttendees,
  getBevyChapterEvents,
  getBevyChapterMembers,
  getBevyChapterTeams,
  getBevyEventAttendees,
  getMemberById,
  importMemberToBevy,
  putBevyAttendeeCheckIn,
} from "@/lib/bevy/client";

/**
 * Server action to fetch Bevy chapter events safely on the server
 */
export async function fetchBevyChapterEventsAction(
  pageSize = 100,
  page = 1,
  includeHidden = false,
  status = "Published",
) {
  return await getBevyChapterEvents(undefined, pageSize, page, includeHidden, status);
}

/**
 * Server action to fetch all Bevy chapter events across all pages safely on the server
 */
export async function fetchAllBevyChapterEventsAction(includeHidden = false, status = "All") {
  return await getAllBevyChapterEvents(undefined, includeHidden, status);
}

export const getAllEventsAction = fetchAllBevyChapterEventsAction;

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
