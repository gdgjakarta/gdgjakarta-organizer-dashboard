"use server";
import {
  getAllBevyChapterEvents,
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

import { cookies } from "next/headers";

/**
 * Verifies that the caller has an active, authenticated organizer session.
 */
async function isAuthorizedOrganizerSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const role = cookieStore.get("auth_role")?.value;
    return Boolean(token) && (role === "organizer" || role === "core_team" || role === "googler");
  } catch {
    return false;
  }
}

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
export async function importBevyMemberAction(params: { firstName: string; lastName: string; email: string }) {
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
