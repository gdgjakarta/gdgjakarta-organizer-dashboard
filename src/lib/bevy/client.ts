import { isAuthorizedOrganizerEmail } from "@/config/auth-config";
import { BEVY_CONFIG, getBevyAuthCredentials, getBevyRefererUrl } from "@/config/bevy-config";
import { extractApiMessage, splitFullName } from "@/lib/utils";

export {
  type EventAudienceInfo,
  type EventAudienceType,
  resolveEventAudience,
} from "./audience";
export {
  type BevyPartnerTierGroup,
  extractEventPartners,
  formatTierName,
  getTierPriority,
  groupPartnersByTier,
} from "./partners";

import { extractEventPartners } from "./partners";
import {
  type BevyAttendeeCheckInRequest,
  type BevyAttendeeCheckInResponse,
  type BevyAttendeesResponse,
  type BevyChapterSlim,
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

export interface BevyFetchResponse<T> {
  status: number;
  ok: boolean;
  data: T | null;
}

/**
 * Server-only fetch wrapper for Bevy API returning status code, ok flag, and parsed data.
 * Dynamically resolves session cookies and CSRF tokens from Firebase Remote Config
 * (keys: cfg_bevy_cookie, cfg_bevy_x_csrftoken) aligned with KawalEvent.
 */
export async function bevyFetchWithResponse<T>(
  endpoint: string,
  options: RequestInit = {},
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyFetchResponse<T>> {
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
      return { status: response.status, ok: false, data: null };
    }

    const data = (await response.json()) as T;
    return { status: response.status, ok: true, data };
  } catch (error) {
    console.error(`[Bevy API Error] Failed to fetch ${url}:`, error);
    return { status: 500, ok: false, data: null };
  }
}

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
  const result = await bevyFetchWithResponse<T>(endpoint, options, chapterId);
  return result.data;
}

/**
 * Retrieve user/member details by ID or email from Bevy with HTTP status context.
 * Used during authentication flow to verify whether the member exists in Bevy.
 * If status is not 200/success, indicates the member is new and hasn't registered on Bevy.
 *
 * @param userId The ID or email of the user to retrieve.
 * @param fields Allows specifying what fields to return for each user separated by commas.
 */
export async function getMemberById(
  userId: string,
  fields?: string,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyFetchResponse<BevyUser>> {
  if (!userId) return { status: 400, ok: false, data: null };

  const cleanUserId = userId.trim().replace(/\/+$/, "");
  const isAllDigits = /^\d+$/.test(cleanUserId);
  const formattedUserId = isAllDigits ? `${cleanUserId}/` : encodeURIComponent(cleanUserId);
  const endpoint = fields
    ? `/user/${formattedUserId}?fields=${encodeURIComponent(fields)}`
    : `/user/${formattedUserId}`;

  console.log(`[Bevy Auth] Calling getMemberById: ${cleanUserId} -> ${endpoint}`);

  const directResult = await bevyFetchWithResponse<BevyUser | { user?: BevyUser; results?: BevyUser[] }>(
    endpoint,
    {},
    chapterId,
  );

  if (directResult.ok && directResult.data) {
    let resolvedUser: BevyUser | null = null;
    if ("id" in directResult.data && directResult.data.id) {
      resolvedUser = directResult.data as BevyUser;
    } else if ("user" in directResult.data && directResult.data.user) {
      resolvedUser = directResult.data.user;
    } else if (
      "results" in directResult.data &&
      Array.isArray(directResult.data.results) &&
      directResult.data.results.length > 0
    ) {
      resolvedUser = directResult.data.results[0];
    }

    if (resolvedUser) {
      return { status: directResult.status, ok: true, data: resolvedUser };
    }
  }

  // Fallback to query param search if direct identifier returned nothing
  const searchResult = await bevyFetchWithResponse<{ results?: BevyUser[]; user?: BevyUser }>(
    `/user/?search=${encodeURIComponent(cleanUserId)}`,
    {},
    chapterId,
  );

  if (searchResult.ok && searchResult.data) {
    if (searchResult.data.results && searchResult.data.results.length > 0) {
      return { status: 200, ok: true, data: searchResult.data.results[0] };
    }
    if (searchResult.data.user) {
      return { status: 200, ok: true, data: searchResult.data.user };
    }
  }

  console.warn(`[Bevy Auth] No Bevy member found for identifier: ${userId} (status: ${directResult.status})`);
  return { status: directResult.status || 404, ok: false, data: null };
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
  const result = await getMemberById(userId, fields, chapterId);
  return result.data;
}

export interface ImportMemberParams {
  firstName: string;
  lastName: string;
  email: string;
}

export interface ImportMemberResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Adds a new member to Bevy using the GDG Jakarta n8n API webhook.
 * Matches the authentication pattern used in Send Bulk Email (X-API-Key: N8N_WEBHOOK_API_KEY).
 *
 * URL: https://n8n.gdgjakarta.com/webhook/api/import-member
 * Required payload: first_name, last_name, email
 */
export async function importMemberToBevy(params: ImportMemberParams): Promise<ImportMemberResult> {
  const webhookUrl = "https://n8n.gdgjakarta.com/webhook/api/import-member";
  const apiKey = process.env.N8N_WEBHOOK_API_KEY || "";

  const payload = {
    first_name: params.firstName,
    last_name: params.lastName,
    email: params.email,
  };

  try {
    console.log(`[Import Member] Dispatching import-member webhook for ${params.email}...`, payload);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseJson: unknown = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // not JSON format
    }

    if (!response.ok) {
      console.error(`[Import Member] Error (${response.status} ${response.statusText}):`, responseText);
      const cleanError = extractApiMessage(
        responseJson || responseText,
        `Member import service returned status ${response.status}.`,
      );
      return { success: false, error: cleanError };
    }

    console.log(`[Import Member] Successfully imported member to Bevy for ${params.email}:`, responseText);
    const cleanSuccessMessage = extractApiMessage(responseJson || responseText, "Member imported successfully.");
    return { success: true, message: cleanSuccessMessage };
  } catch (error) {
    console.error("[Import Member] Exception:", error);
    const cleanError = extractApiMessage(error, "Failed to connect to member import service.");
    return { success: false, error: cleanError };
  }
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

  if (teamData?.results && Array.isArray(teamData.results) && teamData.results.length > 0) {
    console.log(`[Bevy Auth] Retrieved ${teamData.results.length} team members from /chapter/${chapterId}/team/`);
    return teamData.results;
  }

  // 2. Fallback to public chapter_slim team endpoint: /chapter_slim/${chapterSlug}/team/
  const chapterSlug = BEVY_CONFIG.chapterSlug || "gdg-jakarta";
  const slimTeamData = await bevyFetch<BevyChapterTeamMember[]>(`/chapter_slim/${chapterSlug}/team/`, {}, chapterId);

  if (Array.isArray(slimTeamData) && slimTeamData.length > 0) {
    console.log(`[Bevy Auth] Retrieved ${slimTeamData.length} team members from /chapter_slim/${chapterSlug}/team/`);
    return slimTeamData;
  }

  // 3. Fallback without trailing slash
  const altData = await bevyFetch<{
    count?: number;
    results?: BevyChapterTeamMember[];
  }>(`/chapter/${chapterId}/team`, {}, chapterId);

  if (altData?.results && Array.isArray(altData.results) && altData.results.length > 0) {
    return altData.results;
  }

  // 4. Fallback to chapter details endpoint: /chapter/${chapterId}
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
 * 1. Calls Bevy API getMemberById(email) to resolve the user and their numerical Bevy ID.
 *    If the response from Bevy is not success or 200, member is new and hasn't registered on Bevy;
 *    dispatches GDG Jakarta API import-member webhook (same auth as Send Bulk Email).
 * 2. Uses getUserChapterRole(bevyUserId) to compare against getChapterTeam results.
 * 3. Inspects role ID: 1 -> ORGANIZER, 2/3 -> CORE_TEAM, 4 -> GOOGLER, else -> MEMBER.
 * 4. Checks whitelist isAuthorizedOrganizerEmail as a fallback safeguard.
 */
export async function validateBevyOrganizer(
  email: string,
  displayName?: string,
  firstName?: string,
  lastName?: string,
): Promise<OrganizerValidationResult> {
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
        wasImported: false,
      };
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[Bevy Auth Flow] Validating role for: ${normalizedEmail} (Display Name: ${displayName ?? "N/A"})`);

    let wasImported = false;

    // Step 1: Call Bevy API getMemberById with email as the identifier
    const memberResponse = await getMemberById(normalizedEmail);
    let bevyUser = memberResponse.data;
    let bevyUserId = bevyUser?.id !== undefined && bevyUser?.id !== null ? String(bevyUser.id) : null;
    console.log(
      `[Bevy Auth Flow] Bevy member lookup result for ${normalizedEmail}: Status = ${memberResponse.status}, ID = ${bevyUserId ?? "NOT FOUND"}`,
    );

    // If Bevy response is not success or 200, member is new and hasn't registered on Bevy
    if (!memberResponse.ok || memberResponse.status !== 200 || !bevyUser) {
      console.log(
        `[Bevy Auth Flow] Member ${normalizedEmail} is not registered on Bevy (status: ${memberResponse.status}). Registering new member via GDG Jakarta API...`,
      );

      const { firstName: splitFirst, lastName: splitLast } = splitFullName(displayName);
      let safeFirstName = firstName?.trim() || splitFirst.trim();
      if (!safeFirstName) {
        safeFirstName = displayName?.trim() || normalizedEmail.split("@")[0] || "Member";
      }
      const safeLastName = (lastName?.trim() ?? splitLast ?? "").trim();

      const importResult = await importMemberToBevy({
        firstName: safeFirstName,
        lastName: safeLastName,
        email: normalizedEmail,
      });

      if (importResult.success) {
        wasImported = true;
        console.log(`[Bevy Auth Flow] Successfully triggered import-member for ${normalizedEmail}.`);
        // Leave bevyUserId and bevyUser null so initial Firestore sync writes bevy_user_id: null
        bevyUser = null;
        bevyUserId = null;
      } else {
        console.warn(`[Bevy Auth Flow] Failed to import member to Bevy: ${importResult.error}`);
      }
    }

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
          wasImported,
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
        wasImported,
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
      wasImported,
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
      wasImported: false,
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
  const isAllStatus = !status || status.toLowerCase() === "all";
  const fields =
    "id,title,description_short,description,event_type_title,audience_type,is_virtual_event,start_date,end_date,status,picture,banner,cropped_banner_url,cropped_picture_url,url,static_url,total_attendees,checkin_count,total_tickets,total_rsvps_sold,completed,tags,chapter,is_hidden,is_test,venue_name,venue_address,venue_city";
  const hiddenParam = includeHidden ? "" : "&is_hidden=false";
  const statusParam = !isAllStatus ? `&status=${encodeURIComponent(status)}` : "";
  const result = await bevyFetch<BevyEventsResponse>(
    `/chapter/${chapterId}/event/?page_size=${pageSize}&page=${page}&fields=${fields}${hiddenParam}${statusParam}`,
    {},
    chapterId,
  );

  if (result && Array.isArray(result.results)) {
    result.results = result.results.filter((e) => {
      const isHidden = !includeHidden && (e.is_hidden || (e as { hidden?: boolean }).hidden);
      if (isHidden) return false;
      if (!isAllStatus) {
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
 * Fetch all events for a given chapter from Bevy across all pages.
 */
export async function getAllBevyChapterEvents(
  chapterId: string = BEVY_CONFIG.chapterId,
  includeHidden = false,
  status = "All",
): Promise<{ results: BevyEvent[]; count: number }> {
  const pageSize = 100;
  const firstPage = await getBevyChapterEvents(chapterId, pageSize, 1, includeHidden, status);
  const results: BevyEvent[] = [...(firstPage?.results ?? [])];
  const count = firstPage?.count ?? results.length;

  if (count > results.length) {
    const totalPages = Math.ceil(count / pageSize);
    const pagePromises = [];
    for (let p = 2; p <= totalPages; p++) {
      pagePromises.push(getBevyChapterEvents(chapterId, pageSize, p, includeHidden, status));
    }
    const subsequentPages = await Promise.all(pagePromises);
    for (const pageRes of subsequentPages) {
      if (pageRes?.results) {
        results.push(...pageRes.results);
      }
    }
  }

  return { results, count };
}

/**
 * Backward-compatible alias for getAllBevyChapterEvents
 */
export async function getAllEvents(
  chapterId: string = BEVY_CONFIG.chapterId,
  includeHidden = false,
  status = "All",
): Promise<{ results: BevyEvent[]; count: number }> {
  return await getAllBevyChapterEvents(chapterId, includeHidden, status);
}

/**
 * Determines whether an event is active.
 * Active means:
 * 1. Status is "Published"
 * 2. End date is not overdue / past from today (today or future)
 */
export function isEventActive(event?: { status?: string; end_date?: string; start_date?: string }): boolean {
  if (!event) return false;
  const isPublished = (event.status ?? "").toLowerCase() === "published";
  if (!isPublished) return false;

  const targetDate = event.end_date ?? event.start_date;
  if (!targetDate) return false;

  try {
    const end = new Date(targetDate);
    if (Number.isNaN(end.getTime())) return false;

    const now = new Date();
    // If end date/time is in the future relative to current time
    if (end.getTime() >= now.getTime()) return true;

    // Check if on today's calendar day
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return eventDay.getTime() >= startOfToday.getTime();
  } catch {
    return false;
  }
}

/**
 * Fetch full event details by ID directly from Bevy
 */
export async function getBevyEventById(
  eventId: string | number,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyEvent | null> {
  if (!eventId) return null;
  const result = await bevyFetch<BevyEvent>(`/event/${eventId}/`, {}, chapterId);
  if (result) {
    result.partners = extractEventPartners(result);
  }
  return result;
}

/**
 * Fetch full event details by ID directly from Bevy for public event pages,
 * with fallback lookup by chapter events list if direct ID lookup fails.
 */
export async function getPublicEventById(
  eventId: string | number,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyEvent | null> {
  if (!eventId) return null;
  const direct = await getBevyEventById(eventId, chapterId);
  if (direct) return direct;

  try {
    const { results: chapterEvents } = await getAllBevyChapterEvents(undefined, true, "All");
    const matched = chapterEvents.find(
      (e) =>
        String(e.id) === String(eventId) || e.url?.includes(String(eventId)) || e.static_url?.includes(String(eventId)),
    );
    if (matched) {
      matched.partners = extractEventPartners(matched);
      return matched;
    }
  } catch (error) {
    console.warn("[BevyClient] getPublicEventById fallback search failed:", error);
  }

  return null;
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

/**
 * Fetch chapter summary including real-time members_count from Bevy
 */
export async function getBevyChapterSlim(
  chapterSlugOrId: string = BEVY_CONFIG.chapterSlug || BEVY_CONFIG.chapterId,
): Promise<BevyChapterSlim | null> {
  const result = await bevyFetch<BevyChapterSlim>(`/chapter_slim/${chapterSlugOrId}`);
  if (result && typeof result.members_count === "number") {
    return result;
  }

  if (chapterSlugOrId !== BEVY_CONFIG.chapterId) {
    const fallbackResult = await bevyFetch<BevyChapterSlim>(`/chapter_slim/${BEVY_CONFIG.chapterId}`);
    if (fallbackResult && typeof fallbackResult.members_count === "number") {
      return fallbackResult;
    }
  }

  return null;
}

/**
 * Fetch attendee roster for a specific event directly from Bevy API.
 * Endpoint: GET /event/{eventId}/attendee/
 * Referer: https://gdg.community.dev/events/details/google-gdg-{chapterSlug}/?event={eventId}
 */
export async function getBevyEventAttendees(
  eventId: string | number,
  chapterId: string | number = BEVY_CONFIG.chapterId,
  options: { pageSize?: number; page?: number; orderBy?: string } = {},
): Promise<BevyAttendeesResponse> {
  const { pageSize = 200, page = 1, orderBy = "-created_date" } = options;
  const referer = await getBevyRefererUrl(chapterId, eventId);
  const endpoint = `/event/${eventId}/attendee/?page_size=${pageSize}&page=${page}&order_by=${encodeURIComponent(orderBy)}`;

  const result = await bevyFetch<BevyAttendeesResponse>(
    endpoint,
    {
      headers: {
        Referer: referer,
      },
    },
    chapterId,
  );

  return result ?? { count: 0, results: [] };
}

/**
 * Check-in or undo check-in for an attendee in Bevy.
 * Endpoint: PUT /attendee/checkin/
 * Body: { event: Number(eventId), chapter: Number(chapterId), attendees: [{ id: attendeeId, is_checked_in: isCheckedIn }] }
 * Referer: https://gdg.community.dev/events/details/google-gdg-{chapterSlug}/?event={eventId}
 */
export async function putBevyAttendeeCheckIn(
  eventId: string | number,
  attendeeId: number,
  isCheckedIn: boolean,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyAttendeeCheckInResponse | null; error?: string }> {
  try {
    const referer = await getBevyRefererUrl(chapterId, eventId);
    const body: BevyAttendeeCheckInRequest = {
      event: Number(eventId),
      chapter: Number(chapterId),
      attendees: [
        {
          id: Number(attendeeId),
          is_checked_in: isCheckedIn,
        },
      ],
    };

    const response = await bevyFetchWithResponse<BevyAttendeeCheckInResponse>(
      "/attendee/checkin/",
      {
        method: "PUT",
        headers: {
          Referer: referer,
        },
        body: JSON.stringify(body),
      },
      chapterId,
    );

    if (response.ok) {
      return { success: true, data: response.data };
    }
    return {
      success: false,
      error: `Bevy check-in failed with status ${response.status}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update Bevy check-in status";
    console.error("[putBevyAttendeeCheckIn] error:", err);
    return { success: false, error: msg };
  }
}
