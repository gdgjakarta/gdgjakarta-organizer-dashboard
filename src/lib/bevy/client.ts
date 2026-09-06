import { BEVY_CONFIG } from "@/config/bevy-config";

import type { BevyChapterTeamMember, BevyUser, OrganizerValidationResult } from "./types";

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
 * In Bevy API: endpoint /api/chapter/642 (or /api/chapter/{chapterId}) returns
 * the full chapter details including the `chapter_team` array containing all organizers and roles.
 */
export async function getBevyChapterTeams(chapterId: string = BEVY_CONFIG.chapterId): Promise<BevyChapterTeamMember[]> {
  console.log(`[Bevy Auth] Fetching GDG Jakarta chapter teams for chapterId: ${chapterId}`);

  // Fetch chapter details which has the chapter_team array
  const chapterData = await bevyFetch<{
    id?: number;
    title?: string;
    chapter_team?: BevyChapterTeamMember[];
  }>(`/chapter/${chapterId}`);

  if (chapterData?.chapter_team && Array.isArray(chapterData.chapter_team)) {
    console.log(`[Bevy Auth] Retrieved ${chapterData.chapter_team.length} organizers/team members from Bevy`);
    return chapterData.chapter_team;
  }

  // Fallback to chapter slug
  if (BEVY_CONFIG.chapterSlug && BEVY_CONFIG.chapterSlug !== chapterId) {
    const slugData = await bevyFetch<{
      chapter_team?: BevyChapterTeamMember[];
    }>(`/chapter/${BEVY_CONFIG.chapterSlug}`);

    if (slugData?.chapter_team && Array.isArray(slugData.chapter_team)) {
      console.log(`[Bevy Auth] Retrieved ${slugData.chapter_team.length} team members via slug`);
      return slugData.chapter_team;
    }
  }

  console.warn("[Bevy Auth] No chapter_team array found in Bevy chapter response");
  return [];
}

/**
 * Step 4: Validate Organizer with the exact 4-step logic:
 * 1. Takes user email from Google Auth
 * 2. Gets Bevy User ID from email (via GET /api/user/{email})
 * 3. Gets GDG Jakarta Chapter Team (via GET /api/chapter/642 which returns the chapter_team array of all organizers)
 * 4. Compares Bevy User ID:
 *    - Searches chapter_team for a member matching `bevyUserId`
 *    - Assigns the exact role directly from Bevy (`matchedMember.role.name` or `matchedMember.role` or `matchedMember.title`)
 */
export async function validateBevyOrganizer(email: string): Promise<OrganizerValidationResult> {
  try {
    console.log(`[Bevy Auth] Step 2: Fetching Bevy user for email: ${email}`);

    // 1. Get Bevy User ID from Bevy
    const bevyUser = await getBevyUserByEmail(email);
    const bevyUserId = bevyUser?.id ? String(bevyUser.id) : null;

    if (!bevyUser || !bevyUserId) {
      console.warn(`[Bevy Auth] User with email ${email} not registered on Bevy platform.`);
      return {
        isValidOrganizer: false,
        role: "Member",
        bevyUserId: null,
        chapterRole: "Member",
        bevyUser: null,
      };
    }

    console.log(`[Bevy Auth] Found Bevy User ID: ${bevyUserId} (${bevyUser.full_name ?? email})`);

    // 2. Get GDG Jakarta Chapter Teams (list of all organizers)
    console.log("[Bevy Auth] Step 3: Fetching GDG Jakarta chapter team list...");
    const chapterTeams = await getBevyChapterTeams();

    // 3. Step 4: Compare bevyUserId with chapter_team members
    if (chapterTeams.length > 0) {
      const matchedMember = chapterTeams.find((m) => {
        const teamMemberUserId = m.user?.id || m.user_id;
        return teamMemberUserId && String(teamMemberUserId) === String(bevyUserId);
      });

      if (matchedMember) {
        // Extract exact role from Bevy (role can be object { id, name } or string)
        const roleObj = matchedMember.role as unknown;
        console.log("roleObj", roleObj);
        let roleName = "Organizer";

        if (typeof roleObj === "object" && roleObj !== null && "name" in roleObj) {
          roleName = String((roleObj as { name: string }).name);
        } else if (typeof matchedMember.role === "string" && matchedMember.role) {
          roleName = matchedMember.role;
        } else if (matchedMember.title) {
          roleName = matchedMember.title;
        }

        console.log(
          `[Bevy Auth] MATCH FOUND! Bevy User ID ${bevyUserId} is in GDG Jakarta team with Role: "${roleName}"`,
        );

        return {
          isValidOrganizer: true,
          role: roleName,
          bevyUserId,
          chapterRole: roleName,
          chapterTeamMember: matchedMember,
          bevyUser,
        };
      }
    }

    // If bevyUserId is not in chapter_team, they are a community Member
    console.log(`[Bevy Auth] User ${email} (ID: ${bevyUserId}) is not in GDG Jakarta Chapter Team list.`);
    return {
      isValidOrganizer: false,
      role: "Member",
      bevyUserId,
      chapterRole: "Member",
      bevyUser,
    };
  } catch (error) {
    console.error("[validateBevyOrganizer Error]", error);
    return {
      isValidOrganizer: false,
      role: "Member",
      bevyUserId: null,
      chapterRole: null,
    };
  }
}
