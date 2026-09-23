import { isAuthorizedOrganizerEmail } from "@/config/auth-config";
import { BEVY_CONFIG } from "@/config/bevy-config";

import type {
  BevyChapterTeamMember,
  BevyEvent,
  BevyEventsResponse,
  BevyMembersResponse,
  BevyUser,
  OrganizerValidationResult,
} from "./types";

/**
 * Server-only fetch wrapper for Bevy API
 */
export async function bevyFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  const url = `${BEVY_CONFIG.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json; version=bevy.1.0",
    "User-Agent": "GDGJakarta-Dashboard/1.0.0",
    ...(BEVY_CONFIG.csrfToken ? { "X-Csrftoken": BEVY_CONFIG.csrfToken } : {}),
    ...(BEVY_CONFIG.cookie ? { Cookie: BEVY_CONFIG.cookie } : {}),
    ...(BEVY_CONFIG.apiToken ? { Authorization: `Token ${BEVY_CONFIG.apiToken}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      cache: "no-store", // Always fetch fresh user validation from Bevy
    });

    if (!response.ok) {
      console.warn(`[Bevy API] Request to ${url} returned status ${response.status}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`[Bevy API Error] Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Step 2: Get Bevy User ID by Email
 * In Bevy API: endpoint /api/user/{email} accepts email directly as the identifier parameter
 */
export async function getBevyUserByEmail(email: string): Promise<BevyUser | null> {
  if (!email) return null;

  console.log(`[Bevy Auth] Fetching Bevy user with param email: ${email}`);

  // 1. Direct param: /api/user/{email}
  const directResult = await bevyFetch<BevyUser | { user?: BevyUser; results?: BevyUser[] }>(
    `/user/${encodeURIComponent(email)}`,
  );

  if (directResult) {
    console.log("[Bevy Auth] Response from /api/user/{email}:", directResult);
    if ("id" in directResult && directResult.id) {
      return directResult as BevyUser;
    }
    if ("user" in directResult && directResult.user) {
      return directResult.user;
    }
    if ("results" in directResult && directResult.results && directResult.results.length > 0) {
      return directResult.results[0];
    }
  }

  // 2. Query param fallback: /api/user/?search={email}
  const searchResult = await bevyFetch<{ results?: BevyUser[]; user?: BevyUser }>(
    `/user/?search=${encodeURIComponent(email)}`,
  );

  if (searchResult?.results && searchResult.results.length > 0) {
    console.log("[Bevy Auth] Found user via search param:", searchResult.results[0]);
    return searchResult.results[0];
  }

  if (searchResult?.user) {
    return searchResult.user;
  }

  console.warn(`[Bevy Auth] No Bevy user found for email: ${email}`);
  return null;
}

/**
 * Step 3: Get List of Chapter Teams from Bevy
 * Endpoint: /api/chapter_team/?chapter_slug={chapterSlug} or /api/chapter_team/?chapter_id={chapterId}
 */
/**
 * Step 3: Get List of GDG Jakarta Chapter Teams from Bevy
 * In Bevy API: endpoint /api/chapter/642/team returns the team members list
 * with { count, results: [...] }.
 */
export async function getBevyChapterTeams(chapterId: string = BEVY_CONFIG.chapterId): Promise<BevyChapterTeamMember[]> {
  console.log(`[Bevy Auth] Fetching GDG Jakarta chapter teams for chapterId: ${chapterId}`);

  // 1. Fetch team members from the dedicated chapter team endpoint: /chapter/{chapterId}/team
  const teamData = await bevyFetch<{
    count?: number;
    results?: BevyChapterTeamMember[];
  }>(`/chapter/${chapterId}/team`);

  if (teamData?.results && Array.isArray(teamData.results)) {
    console.log(
      `[Bevy Auth] Retrieved ${teamData.results.length} organizers/team members from Bevy /chapter/${chapterId}/team`,
    );
    return teamData.results;
  }

  // 2. Fallback to chapter details endpoint: /chapter/{chapterId}
  const chapterData = await bevyFetch<{
    id?: number;
    title?: string;
    chapter_team?: BevyChapterTeamMember[];
  }>(`/chapter/${chapterId}`);

  if (chapterData?.chapter_team && Array.isArray(chapterData.chapter_team)) {
    console.log(
      `[Bevy Auth] Retrieved ${chapterData.chapter_team.length} organizers/team members from /chapter/${chapterId}`,
    );
    return chapterData.chapter_team;
  }

  // 3. Fallback to chapter slug
  if (BEVY_CONFIG.chapterSlug && BEVY_CONFIG.chapterSlug !== chapterId) {
    const slugData = await bevyFetch<{
      count?: number;
      results?: BevyChapterTeamMember[];
      chapter_team?: BevyChapterTeamMember[];
    }>(`/chapter/${BEVY_CONFIG.chapterSlug}/team`);

    if (slugData?.results && Array.isArray(slugData.results)) {
      return slugData.results;
    }
  }

  console.warn("[Bevy Auth] No chapter team found in Bevy response");
  return [];
}

/**
 * Validates whether an email belongs to an authorized organizer.
 * Verifies strictly through:
 * 1. Explicit Authorized Organizer Emails whitelist (auth-config).
 * 2. Exact unmasked email or username match from Bevy Chapter Team API.
 */
export async function validateBevyOrganizer(email: string, displayName?: string): Promise<OrganizerValidationResult> {
  try {
    if (!email) {
      return {
        isValidOrganizer: false,
        role: "Member",
        bevyUserId: null,
        chapterRole: "Member",
        bevyUser: null,
      };
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[Bevy Auth] Validating organizer status for: ${normalizedEmail} (Name: ${displayName ?? "N/A"})`);

    // 1. Check explicit authorized organizer whitelist first
    const isWhitelisted = isAuthorizedOrganizerEmail(normalizedEmail);

    // 2. Fetch GDG Jakarta chapter team list
    const chapterTeams = await getBevyChapterTeams();

    // 3. Match against chapter team members (STRICT EXACT MATCH ONLY - NO MASKED WILDCARDS)
    let matchedMember: BevyChapterTeamMember | undefined;

    if (chapterTeams.length > 0) {
      matchedMember = chapterTeams.find((m) => {
        const teamEmail = m.user?.email?.toLowerCase()?.trim() || "";
        const teamUsername = m.user?.username?.toLowerCase()?.trim() || "";

        // Unmasked exact email match only (ignore privacy-masked strings containing '*')
        if (teamEmail && !teamEmail.includes("*") && teamEmail === normalizedEmail) {
          return true;
        }

        // Exact username match (if username is an exact email)
        if (teamUsername && !teamUsername.includes("*") && teamUsername === normalizedEmail) {
          return true;
        }

        return false;
      });
    }

    if (isWhitelisted || matchedMember) {
      const teamMemberUserId = matchedMember?.user?.id || matchedMember?.user_id;
      const bevyUserId = teamMemberUserId ? String(teamMemberUserId) : null;

      // Extract role title from Bevy or default to Organizer
      const roleObj = matchedMember?.role as unknown;
      let roleName = "Organizer";

      if (typeof roleObj === "object" && roleObj !== null && "name" in roleObj) {
        roleName = String((roleObj as { name: string }).name);
      } else if (typeof matchedMember?.role === "string" && matchedMember.role) {
        roleName = matchedMember.role;
      } else if (matchedMember?.title) {
        roleName = matchedMember.title;
      }

      console.log(`[Bevy Auth] Organizer verified! ${normalizedEmail} with Role: "${roleName}"`);

      return {
        isValidOrganizer: true,
        role: roleName,
        bevyUserId,
        chapterRole: matchedMember?.title || roleName,
        chapterTeamMember: matchedMember,
        bevyUser: matchedMember?.user ?? null,
      };
    }

    // 4. Default: User is a regular community member
    console.log(`[Bevy Auth] User ${normalizedEmail} is verified as community Member.`);
    return {
      isValidOrganizer: false,
      role: "Member",
      bevyUserId: null,
      chapterRole: "Member",
      bevyUser: null,
    };
  } catch (error) {
    console.error("[validateBevyOrganizer Error]", error);
    return {
      isValidOrganizer: false,
      role: "Member",
      bevyUserId: null,
      chapterRole: "Member",
      bevyUser: null,
    };
  }
}

/**
 * Fetch registered chapter community members from Bevy
 */
export async function getBevyChapterMembers(
  chapterId: string = BEVY_CONFIG.chapterId,
  pageSize = 200,
  page = 1,
): Promise<BevyMembersResponse | null> {
  const result = await bevyFetch<BevyMembersResponse>(
    `/chapter/${chapterId}/member?page_size=${pageSize}&page=${page}`,
  );
  return result;
}

/**
 * Fetch events for a given chapter from Bevy
 */
export async function getBevyChapterEvents(
  chapterId: string = BEVY_CONFIG.chapterId,
  pageSize = 100,
  page = 1,
): Promise<BevyEventsResponse | null> {
  const result = await bevyFetch<BevyEventsResponse>(`/chapter/${chapterId}/event?page_size=${pageSize}&page=${page}`);
  return result;
}

/**
 * Fetch full event details by ID directly from Bevy
 */
export async function getBevyEventById(eventId: string | number): Promise<BevyEvent | null> {
  if (!eventId) return null;
  const result = await bevyFetch<BevyEvent>(`/event/${eventId}`);
  return result;
}
