import { BEVY_CONFIG } from "@/config/bevy-config";

import type {
  BevyChapterTeamMember,
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
 * Helper to match an unmasked incoming email against Bevy's privacy-masked email string.
 * Example: 'rizkyfir@gmail.com' matches 'r*******@gmail.com'
 */
function matchesMaskedEmail(email: string, maskedEmail?: string): boolean {
  if (!email || !maskedEmail) return false;
  const [local, domain] = email.toLowerCase().trim().split("@");
  const [mLocal, mDomain] = maskedEmail.toLowerCase().trim().split("@");
  if (!local || !domain || !mLocal || !mDomain) return false;
  if (domain !== mDomain) return false;

  // Mask pattern: e.g. "r*******" where first char is preserved and rest are stars
  if (mLocal.startsWith(local[0])) {
    const starCount = (mLocal.match(/\*/g) || []).length;
    // Length matching or prefix matching
    if (mLocal.length === local.length && /^\*+$/.test(mLocal.slice(1))) {
      return true;
    }
    if (/^\*+$/.test(mLocal.slice(1)) && local.length >= starCount && starCount > 3) {
      return true;
    }
  }
  return false;
}

function normalizeClean(str?: string): string {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nameMatches(displayName?: string, firstName?: string, lastName?: string): boolean {
  if (!displayName) return false;
  const gNorm = normalizeClean(displayName);
  const bFullNorm = normalizeClean(`${firstName || ""} ${lastName || ""}`);
  const bFirstNorm = normalizeClean(firstName || "");

  if (!gNorm || !bFullNorm) return false;
  if (gNorm === bFullNorm) return true;
  if (gNorm.startsWith(bFirstNorm) && bFirstNorm.length >= 3) return true;
  if (bFullNorm.startsWith(gNorm) && gNorm.length >= 3) return true;
  return false;
}

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
 * Validates whether an email belongs to the GDG Jakarta Bevy chapter team (Organizers / Leads).
 * Fetches the GDG Jakarta chapter team list (via GET /api/chapter/642/team) and matches by:
 * 1. Exact email match or domain
 * 2. Privacy-masked email match (e.g. 'r*******@gmail.com')
 * 3. Display name and domain match with team members
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

    // 1. Fetch GDG Jakarta chapter team list
    const chapterTeams = await getBevyChapterTeams();

    // 2. Match against chapter team members
    if (chapterTeams.length > 0) {
      const matchedMember = chapterTeams.find((m) => {
        const teamEmail = m.user?.email?.toLowerCase()?.trim() || "";
        const teamUsername = m.user?.username?.toLowerCase()?.trim() || "";

        // Exact email or username match
        if (teamEmail === normalizedEmail || (teamUsername && teamUsername === normalizedEmail)) {
          return true;
        }

        // Masked email match
        if (teamEmail && matchesMaskedEmail(normalizedEmail, teamEmail)) {
          return true;
        }

        // Name match (if display name provided) + matching email domain
        if (displayName && nameMatches(displayName, m.user?.first_name, m.user?.last_name)) {
          const emailDomain = normalizedEmail.split("@")[1];
          if (teamEmail && emailDomain && teamEmail.endsWith(`@${emailDomain}`)) {
            return true;
          }
        }

        return false;
      });

      if (matchedMember) {
        const teamMemberUserId = matchedMember.user?.id || matchedMember.user_id;
        const bevyUserId = teamMemberUserId ? String(teamMemberUserId) : null;

        // Extract exact role from Bevy (role can be object { id, name } or string)
        const roleObj = matchedMember.role as unknown;
        let roleName = "Organizer";

        if (typeof roleObj === "object" && roleObj !== null && "name" in roleObj) {
          roleName = String((roleObj as { name: string }).name);
        } else if (typeof matchedMember.role === "string" && matchedMember.role) {
          roleName = matchedMember.role;
        } else if (matchedMember.title) {
          roleName = matchedMember.title;
        }

        console.log(
          `[Bevy Auth] Organizer found! ${normalizedEmail} (Bevy ID: ${bevyUserId}) is in GDG Jakarta team with Role: "${roleName}" (${matchedMember.title ?? ""})`,
        );

        return {
          isValidOrganizer: true,
          role: roleName,
          bevyUserId,
          chapterRole: matchedMember.title || roleName,
          chapterTeamMember: matchedMember,
          bevyUser: matchedMember.user ?? null,
        };
      }
    }

    // 3. User is a community member
    console.log(`[Bevy Auth] User ${normalizedEmail} is a community Member.`);
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
      chapterRole: null,
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
