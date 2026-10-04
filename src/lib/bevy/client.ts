import { isAuthorizedOrganizerEmail } from "@/config/auth-config";
import { BEVY_CONFIG, getBevyAuthCredentials } from "@/config/bevy-config";

import {
  type BevyChapterTeamMember,
  type BevyEvent,
  type BevyEventsResponse,
  type BevyMembersResponse,
  type BevySponsor,
  type BevyUser,
  ChapterRole,
  getChapterRoleById,
  isChapterTeamRole,
  type OrganizerValidationResult,
} from "./types";

/**
 * Server-only fetch wrapper for Bevy API.
 * Dynamically resolves session cookies and CSRF tokens from Firebase Remote Config
 * (keys: cfg_bevy_cookie, cfg_bevy_x_csrftoken) aligned with KawalEvent.
 */
export async function bevyFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<T | null> {
  const url = `${BEVY_CONFIG.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  // Dynamically resolve Bevy session cookies and CSRF tokens from Remote Config (like KawalEvent)
  const { cookie, csrfToken } = await getBevyAuthCredentials(chapterId);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json; version=bevy.1.0",
    "User-Agent": "GDGJakarta-Dashboard/1.0.0",
    ...(csrfToken ? { "X-Csrftoken": csrfToken } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
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
 * Retrieve user details by ID or email from Bevy.
 * Matches KawalEvent AuthRemoteDataSourceImpl.getUserById
 *
 * @param userId The ID or email of the user to retrieve.
 * @param fields Allows specifying what fields to return for each user separated by commas.
 */
export async function getUserById(
  userId: string,
  fields?: string,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyUser | null> {
  if (!userId) return null;

  const cleanUserId = userId.trim().replace(/\/+$/, "");
  const isAllDigits = /^\d+$/.test(cleanUserId);
  const formattedUserId = isAllDigits ? `${cleanUserId}/` : encodeURIComponent(cleanUserId);
  const endpoint = fields
    ? `/user/${formattedUserId}?fields=${encodeURIComponent(fields)}`
    : `/user/${formattedUserId}`;

  console.log(`[Bevy Auth] Calling getUserById: ${cleanUserId} -> ${endpoint}`);

  const directResult = await bevyFetch<BevyUser | { user?: BevyUser; results?: BevyUser[] }>(endpoint, {}, chapterId);

  if (directResult) {
    if ("id" in directResult && directResult.id) {
      return directResult as BevyUser;
    }
    if ("user" in directResult && directResult.user) {
      return directResult.user;
    }
    if ("results" in directResult && Array.isArray(directResult.results) && directResult.results.length > 0) {
      return directResult.results[0];
    }
  }

  // Fallback to query param search if direct identifier returned nothing
  const searchResult = await bevyFetch<{ results?: BevyUser[]; user?: BevyUser }>(
    `/user/?search=${encodeURIComponent(cleanUserId)}`,
    {},
    chapterId,
  );

  if (searchResult?.results && searchResult.results.length > 0) {
    return searchResult.results[0];
  }
  if (searchResult?.user) {
    return searchResult.user;
  }

  console.warn(`[Bevy Auth] No Bevy user found for identifier: ${userId}`);
  return null;
}

/**
 * Backward-compatible alias for getUserById(email)
 */
export async function getBevyUserByEmail(
  email: string,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyUser | null> {
  return await getUserById(email, undefined, chapterId);
}

/**
 * Retrieve team members for a given chapter from Bevy.
 * Matches KawalEvent AuthApiClient.getChapterTeam
 *
 * Endpoint: /chapter/{chapterId}/team/
 */
export async function getChapterTeam(
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyChapterTeamMember[]> {
  console.log(`[Bevy Auth] Fetching chapter team for chapterId: ${chapterId}`);

  // 1. Dedicated chapter team endpoint: /chapter/{chapterId}/team/
  const teamData = await bevyFetch<{
    count?: number;
    results?: BevyChapterTeamMember[];
  }>(`/chapter/${chapterId}/team/`, {}, chapterId);

  if (teamData?.results && Array.isArray(teamData.results)) {
    console.log(`[Bevy Auth] Retrieved ${teamData.results.length} team members from /chapter/${chapterId}/team/`);
    return teamData.results;
  }

  // 2. Fallback without trailing slash
  const altData = await bevyFetch<{
    count?: number;
    results?: BevyChapterTeamMember[];
  }>(`/chapter/${chapterId}/team`, {}, chapterId);

  if (altData?.results && Array.isArray(altData.results)) {
    return altData.results;
  }

  // 3. Fallback to chapter details endpoint: /chapter/{chapterId}
  const chapterData = await bevyFetch<{
    id?: number;
    title?: string;
    chapter_team?: BevyChapterTeamMember[];
  }>(`/chapter/${chapterId}`, {}, chapterId);

  if (chapterData?.chapter_team && Array.isArray(chapterData.chapter_team)) {
    return chapterData.chapter_team;
  }

  console.warn(`[Bevy Auth] No chapter team found for chapterId: ${chapterId}`);
  return [];
}

/**
 * Backward-compatible alias for getChapterTeam
 */
export async function getBevyChapterTeams(chapterId: string = BEVY_CONFIG.chapterId): Promise<BevyChapterTeamMember[]> {
  return await getChapterTeam(chapterId);
}

export interface UserChapterRoleResult {
  chapterRole: ChapterRole;
  roleId: number | null;
  roleTitle: string;
  isValidOrganizer: boolean;
  teamMember?: BevyChapterTeamMember;
}

/**
 * Determine a user's chapter role based on their numerical Bevy User ID.
 * Matches KawalEvent AuthRepositoryImpl.getUserChapterRole:
 *  - Role ID 1 -> ORGANIZER
 *  - Role ID 2, 3 -> CORE_TEAM
 *  - Role ID 4 -> GOOGLER
 *  - else -> MEMBER
 */
export async function getUserChapterRole(
  bevyUserId: number | string,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<UserChapterRoleResult> {
  const chapterTeams = await getChapterTeam(chapterId);
  const normalizedId = String(bevyUserId);

  const matchedMember = chapterTeams.find((m) => {
    const id = m.user?.id ?? m.user_id;
    return id !== undefined && id !== null && String(id) === normalizedId;
  });

  if (!matchedMember) {
    return {
      chapterRole: ChapterRole.MEMBER,
      roleId: null,
      roleTitle: "Member",
      isValidOrganizer: false,
    };
  }

  const roleObj = matchedMember.role;
  const roleId = typeof roleObj === "object" && roleObj !== null && typeof roleObj.id === "number" ? roleObj.id : null;

  const chapterRole = getChapterRoleById(roleId);
  const isOrganizer = isChapterTeamRole(chapterRole);

  // Determine user title / designation
  let roleTitle = "Member";
  if (isOrganizer) {
    if (matchedMember.title?.trim()) {
      roleTitle = matchedMember.title.trim();
    } else if (typeof roleObj === "object" && roleObj !== null && roleObj.name) {
      roleTitle = roleObj.name.trim();
    } else {
      switch (chapterRole) {
        case ChapterRole.ORGANIZER:
          roleTitle = "Organizer";
          break;
        case ChapterRole.CORE_TEAM:
          roleTitle = "Core Team";
          break;
        case ChapterRole.GOOGLER:
          roleTitle = "Googler";
          break;
        default:
          roleTitle = "Member";
      }
    }
  }

  return {
    chapterRole,
    roleId,
    roleTitle,
    isValidOrganizer: isOrganizer,
    teamMember: matchedMember,
  };
}

/**
 * Refactored authentication & role resolution matching KawalEvent:
 * 1. Calls Bevy API getUserById(email) to resolve the user and their numerical Bevy ID.
 * 2. Uses getUserChapterRole(bevyUserId) to compare against getChapterTeam results.
 * 3. Inspects role ID: 1 -> ORGANIZER, 2/3 -> CORE_TEAM, 4 -> GOOGLER, else -> MEMBER.
 * 4. Checks whitelist isAuthorizedOrganizerEmail as a fallback safeguard.
 */
export async function validateBevyOrganizer(email: string, displayName?: string): Promise<OrganizerValidationResult> {
  try {
    if (!email) {
      return {
        isValidOrganizer: false,
        role: "member",
        chapterRole: "Member",
        chapterRoleType: ChapterRole.MEMBER,
        roleId: null,
        roleTitle: "Member",
        bevyUserId: null,
        bevyUser: null,
      };
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[Bevy Auth Flow] Validating role for: ${normalizedEmail} (Display Name: ${displayName ?? "N/A"})`);

    // Step 1: Call Bevy API getUserById with email as the identifier (like KawalEvent)
    const bevyUser = await getUserById(normalizedEmail);
    const bevyUserId = bevyUser?.id !== undefined && bevyUser?.id !== null ? String(bevyUser.id) : null;
    console.log(`[Bevy Auth Flow] Bevy user lookup result: ID = ${bevyUserId ?? "NOT FOUND"}`);

    // Step 2: If Bevy user found, query chapter team role using Bevy User ID (like KawalEvent getUserChapterRole)
    if (bevyUserId) {
      const chapterRoleResult = await getUserChapterRole(bevyUserId);
      console.log(
        `[Bevy Auth Flow] Chapter role resolution: ${chapterRoleResult.chapterRole} (RoleId: ${chapterRoleResult.roleId}, Title: "${chapterRoleResult.roleTitle}")`,
      );

      if (chapterRoleResult.isValidOrganizer) {
        return {
          isValidOrganizer: true,
          role: "organizer",
          chapterRole: chapterRoleResult.roleTitle,
          chapterRoleType: chapterRoleResult.chapterRole,
          roleId: chapterRoleResult.roleId,
          roleTitle: chapterRoleResult.roleTitle,
          bevyUserId,
          chapterTeamMember: chapterRoleResult.teamMember,
          bevyUser,
        };
      }
    }

    // Step 3: Whitelist fallback check (for accounts specified in cfg_organizer_emails or ORGANIZER_EMAILS)
    const isWhitelisted = await isAuthorizedOrganizerEmail(normalizedEmail);
    if (isWhitelisted) {
      console.log(`[Bevy Auth Flow] Whitelist fallback MATCHED for: ${normalizedEmail}`);
      return {
        isValidOrganizer: true,
        role: "organizer",
        chapterRole: "Organizer",
        chapterRoleType: ChapterRole.ORGANIZER,
        roleId: 1,
        roleTitle: "Organizer",
        bevyUserId,
        bevyUser: bevyUser ?? null,
      };
    }

    // Step 4: Default regular Community Member
    console.log(`[Bevy Auth Flow] Regular community Member: ${normalizedEmail}`);
    return {
      isValidOrganizer: false,
      role: "member",
      chapterRole: "Member",
      chapterRoleType: ChapterRole.MEMBER,
      roleId: null,
      roleTitle: "Member",
      bevyUserId,
      bevyUser: bevyUser ?? null,
    };
  } catch (error) {
    console.error("[validateBevyOrganizer Error]", error);
    return {
      isValidOrganizer: false,
      role: "member",
      chapterRole: "Member",
      chapterRoleType: ChapterRole.MEMBER,
      roleId: null,
      roleTitle: "Member",
      bevyUserId: null,
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
  orderBy = "-created_date",
): Promise<BevyMembersResponse | null> {
  const chapterSlug = BEVY_CONFIG.chapterSlug || "gdg-jakarta";
  const result = await bevyFetch<BevyMembersResponse>(
    `/chapter/${chapterId}/member/?order_by=${encodeURIComponent(orderBy)}&page_size=${pageSize}&page=${page}`,
    {
      headers: {
        Referer: `https://gdg.community.dev/dashboard/${chapterSlug}/members/`,
        "X-Requested-With": "XMLHttpRequest",
      },
    },
    chapterId,
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
  includeHidden = false,
  status = "Published",
): Promise<BevyEventsResponse | null> {
  const fields =
    "id,title,description_short,description,event_type_title,audience_type,is_virtual_event,start_date,end_date,status,picture,banner,cropped_banner_url,cropped_picture_url,url,static_url,total_attendees,checkin_count,total_tickets,total_rsvps_sold,completed,tags,chapter,is_hidden";
  const hiddenParam = includeHidden ? "" : "&is_hidden=false";
  const statusParam = status && status !== "All" ? `&status=${encodeURIComponent(status)}` : "";
  const result = await bevyFetch<BevyEventsResponse>(
    `/chapter/${chapterId}/event?page_size=${pageSize}&page=${page}&fields=${fields}${hiddenParam}${statusParam}`,
    {},
    chapterId,
  );

  if (result && Array.isArray(result.results)) {
    result.results = result.results.filter((e) => {
      const isHidden = !includeHidden && (e.is_hidden || (e as { hidden?: boolean }).hidden);
      if (isHidden) return false;
      if (status && status !== "All") {
        const eventStatus = e.status?.toLowerCase();
        if (eventStatus && eventStatus !== status.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }

  return result;
}

/**
 * Fetch full event details by ID directly from Bevy
 */
export async function getBevyEventById(
  eventId: string | number,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyEvent | null> {
  if (!eventId) return null;
  const result = await bevyFetch<BevyEvent>(`/event/${eventId}`, {}, chapterId);
  return result;
}

/**
 * Fetch chapter sponsors & partners from Bevy
 */
export async function getBevyChapterSponsors(
  chapterSlugOrId: string = BEVY_CONFIG.chapterSlug || BEVY_CONFIG.chapterId,
): Promise<BevySponsor[]> {
  const result = await bevyFetch<BevySponsor[]>(`/chapter_slim/${chapterSlugOrId}/sponsors/`);
  if (Array.isArray(result) && result.length > 0) {
    return result;
  }

  // Fallback to chapter ID if chapterSlug was used, or vice-versa
  if (chapterSlugOrId !== BEVY_CONFIG.chapterId) {
    const fallbackResult = await bevyFetch<BevySponsor[]>(`/chapter_slim/${BEVY_CONFIG.chapterId}/sponsors/`);
    if (Array.isArray(fallbackResult)) {
      return fallbackResult;
    }
  }

  return [];
}
