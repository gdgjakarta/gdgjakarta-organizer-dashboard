"use server";
import {
  getAllBevyChapterEvents,
  getBevyChapterEvents,
  getBevyChapterMembers,
  getBevyChapterTeams,
  getMemberById,
  importMemberToBevy,
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

/**
 * Server action to fetch Bevy chapter members safely on the server
 */
export async function fetchBevyChapterMembersAction(pageSize = 200, page = 1, orderBy = "-created_date") {
  return await getBevyChapterMembers(undefined, pageSize, page, orderBy);
}

/**
 * Server action to fetch Bevy chapter teams safely on the server
 */
export async function fetchBevyChapterTeamsAction() {
  return await getBevyChapterTeams();
}

/**
 * Server action to fetch a Bevy member by ID or email
 */
export async function fetchBevyMemberByIdAction(identifier: string) {
  return await getMemberById(identifier);
}

/**
 * Server action to import a new member into Bevy via the GDG Jakarta webhook
 */
export async function importBevyMemberAction(params: { firstName: string; lastName: string; email: string }) {
  return await importMemberToBevy(params);
}
