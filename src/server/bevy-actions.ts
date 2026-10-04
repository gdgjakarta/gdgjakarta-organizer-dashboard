"use server";

import { getBevyChapterEvents, getBevyChapterMembers, getBevyChapterTeams } from "@/lib/bevy/client";

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
