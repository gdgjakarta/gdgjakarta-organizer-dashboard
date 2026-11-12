import { cache } from "react";

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
  type BevyAgendaDay,
  type BevyAgendaItem,
  type BevyAiContentModificationParams,
  type BevyAiContentModificationResponse,
  type BevyAiEventGenerationResponse,
  type BevyAttendee,
  type BevyAttendeeCheckInRequest,
  type BevyAttendeeCheckInResponse,
  type BevyAttendeesResponse,
  type BevyChapterMember,
  type BevyChapterSlim,
  type BevyChapterTeamMember,
  type BevyChapterTeamRole,
  type BevyCreateEventInput,
  type BevyEvent,
  type BevyEventsResponse,
  type BevyMembersResponse,
  type BevySponsor,
  type BevyUpdateEventInput,
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
export interface BevyFetchOptions extends RequestInit {
  requireAuth?: boolean;
}

// In-memory Last-Known-Good (LKG) cache for chapter events to survive transient failures and concurrent bursts
interface CachedEventsEntry {
  data: BevyEventsResponse;
  timestamp: number;
}
const eventsLkgCache = new Map<string, CachedEventsEntry>();
const EVENTS_CACHE_TTL_MS = 60_000; // 1 minute fresh TTL

/**
 * Server-only fetch wrapper for Bevy API returning status code, ok flag, and parsed data.
 * Dynamically resolves session cookies and CSRF tokens from Firebase Remote Config
 * (keys: cfg_bevy_cookie, cfg_bevy_x_csrftoken) aligned with KawalEvent.
 */
export async function bevyFetchWithResponse<T>(
  endpoint: string,
  options: BevyFetchOptions = {},
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyFetchResponse<T>> {
  const url = `${BEVY_CONFIG.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const method = (options.method || "GET").toUpperCase();

  // Dynamically resolve Bevy session cookies and CSRF tokens from Remote Config only when required.
  // Public endpoints (e.g. events, sponsors, slim chapter info) do not incur extra Remote Config overhead.
  const isExplicitAuth = options.requireAuth === true;
  const isMutation = method !== "GET" && method !== "HEAD";
  const isProtectedPath =
    endpoint.includes("/attendee") ||
    endpoint.includes("/member") ||
    endpoint.includes("/event/") ||
    endpoint.includes("/team/") ||
    endpoint.includes("/teammember") ||
    endpoint.includes("/config/algolia") ||
    endpoint.startsWith("/user/") ||
    endpoint.startsWith("user/");
  const needsAuth = isExplicitAuth || isMutation || isProtectedPath;

  let cookie = "";
  let csrfToken = "";
  if (needsAuth) {
    try {
      const creds = await getBevyAuthCredentials(chapterId);
      cookie = creds.cookie;
      csrfToken = creds.csrfToken;
    } catch (authErr) {
      console.warn(`[Bevy API] Could not load auth credentials for ${endpoint}:`, authErr);
    }
  }

  const buildHeaders = (includeAuth: boolean) => ({
    Accept: "application/json; version=bevy.1.0",
    "User-Agent": "GDGJakartaDashboard/2.2 (compatible; CloudflareWorkers/1.0)",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(includeAuth && csrfToken ? { "X-Csrftoken": csrfToken } : {}),
    ...(includeAuth && cookie ? { Cookie: cookie, "Auth-Type": "AUTHORIZED" } : {}),
    ...(BEVY_CONFIG.apiToken ? { Authorization: `Token ${BEVY_CONFIG.apiToken}` } : {}),
    ...(options.headers as Record<string, string>),
  });

  const timeoutSignal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6_000) : undefined;
  const signal = options.signal || timeoutSignal;

  const executeFetch = async (headers: Record<string, string>) => {
    const response = await fetch(url, {
      ...options,
      headers,
      signal,
      cache: "no-store",
    });

    if (response.status === 204) {
      return { response, ok: true, status: response.status, data: null as T | null };
    }

    const text = await response.text();
    let data: T | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        // Response is non-JSON
      }
    }

    if (!response.ok) {
      return { response, ok: false, status: response.status, data };
    }

    return { response, ok: true, status: response.status, data };
  };

  try {
    let result = await executeFetch(buildHeaders(true));

    // If an authenticated GET to /event/ failed (e.g. expired spoofed cookie or 401/403/5xx),
    // retry once without spoofed cookie headers so published events still load.
    if (!result.ok && method === "GET" && endpoint.includes("/event/") && (cookie || csrfToken)) {
      console.warn(`[Bevy API] Auth fetch to ${url} returned ${result.status}. Retrying unauthenticated...`);
      try {
        result = await executeFetch(buildHeaders(false));
      } catch (retryErr) {
        console.warn(`[Bevy API] Unauthenticated retry failed for ${url}:`, retryErr);
      }
    }

    if (!result.ok) {
      console.warn(`[Bevy API] Request to ${url} returned status ${result.status}`);
      return { status: result.status, ok: false, data: result.data };
    }

    return { status: result.status, ok: true, data: result.data };
  } catch (error) {
    // If initial fetch failed on error (e.g. timeout with cookies), retry without auth if endpoint is /event/
    if (method === "GET" && endpoint.includes("/event/") && (cookie || csrfToken)) {
      try {
        const retryResult = await executeFetch(buildHeaders(false));
        if (retryResult.ok) {
          return { status: retryResult.status, ok: true, data: retryResult.data };
        }
      } catch {
        // Ignore fallback error
      }
    }

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
  options: BevyFetchOptions = {},
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

  // If userId is all digits (numeric ID), Bevy expects a trailing slash: /user/{id}/
  // If userId is an email, Bevy expects no trailing slash: /user/{email}
  const isAllDigits = /^\d+$/.test(cleanUserId);
  const formattedUserId = isAllDigits ? `${cleanUserId}/` : cleanUserId;
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

  console.warn(`[Bevy Auth] No Bevy member found for identifier: ${userId} (status: ${directResult.status})`);
  return { status: directResult.status || 404, ok: false, data: (directResult.data as unknown as BevyUser) || null };
}

/**
 * Determines whether a Bevy API member lookup response indicates that the user
 * is truly not registered in Bevy (e.g. 404, 403 / 200 with permission denied message or empty object),
 * as opposed to transient errors like 429 (rate limit) or 500+ (server errors).
 */
export function isBevyUserNotFoundError(response: { status?: number; data?: unknown }): boolean {
  const status = response.status;
  // Rate limits (429) or server errors (500+) are NOT "user not found"
  if (status === 429 || (typeof status === "number" && status >= 500)) {
    return false;
  }

  // 404 is definitely Not Found
  if (status === 404) {
    return true;
  }

  const data = response.data as Record<string, unknown> | null | undefined;
  const detail = String(data?.detail || data?.message || data?.error || "").toLowerCase();

  // Bevy returns "You do not have permission to perform this action" or 403 when user does not exist / cannot be viewed
  if (detail.includes("permission") || detail.includes("not found")) {
    return true;
  }

  if (status === 403) {
    return true;
  }

  // 200 OK, but no valid user ID found in data
  if (
    status === 200 &&
    (!data ||
      (!("id" in data && data.id) &&
        !("user" in data && (data.user as Record<string, unknown>).id) &&
        (!Array.isArray(data.results) || data.results.length === 0)))
  ) {
    return true;
  }

  return false;
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
  lastName?: string;
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

  const trimmedFirst = params.firstName?.trim() || "";
  let safeFirstName = trimmedFirst;
  let safeLastName = params.lastName?.trim() || "";

  // If last name is empty, check if first name contains multiple words to split, otherwise default to '.' (mononym)
  if (!safeLastName) {
    const parts = trimmedFirst.split(/\s+/);
    if (parts.length > 1) {
      safeLastName = parts.pop() || ".";
      safeFirstName = parts.join(" ");
    } else {
      safeLastName = ".";
    }
  }

  if (!safeFirstName) {
    safeFirstName = params.email.split("@")[0] || "Member";
  }

  const payload = {
    first_name: safeFirstName,
    last_name: safeLastName,
    email: params.email.trim(),
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
  const teamData = await bevyFetch<
    | {
        count?: number;
        results?: BevyChapterTeamMember[];
      }
    | BevyChapterTeamMember[]
  >(`/chapter/${chapterId}/team/`, {}, chapterId);

  if (Array.isArray(teamData) && teamData.length > 0) {
    console.log(`[Bevy Auth] Retrieved ${teamData.length} team members from /chapter/${chapterId}/team/`);
    return teamData;
  }

  if (teamData && "results" in teamData && Array.isArray(teamData.results) && teamData.results.length > 0) {
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
  const altData = await bevyFetch<
    | {
        count?: number;
        results?: BevyChapterTeamMember[];
      }
    | BevyChapterTeamMember[]
  >(`/chapter/${chapterId}/team`, {}, chapterId);

  if (Array.isArray(altData) && altData.length > 0) {
    return altData;
  }
  if (altData && "results" in altData && Array.isArray(altData.results) && altData.results.length > 0) {
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
 * Retrieve all available chapter roles from Bevy API:
 * GET /api/chapter_role/
 */
export async function getChapterRoles(
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyChapterTeamRole[]> {
  const data = await bevyFetch<{ results?: BevyChapterTeamRole[] } | BevyChapterTeamRole[]>(
    "/chapter_role/",
    {},
    chapterId,
  );
  if (Array.isArray(data)) return data;
  if (data && "results" in data && Array.isArray(data.results)) return data.results;
  return [];
}

/**
 * Backward-compatible alias for getChapterTeam
 */
export async function getBevyChapterTeams(chapterId: string = BEVY_CONFIG.chapterId): Promise<BevyChapterTeamMember[]> {
  return await getChapterTeam(chapterId);
}

export interface AddBevyChapterTeamMemberParams {
  userId: string | number;
  firstName: string;
  lastName?: string;
  role: number; // 1 (Organizer), 2 (Team Member), 3 (Check-in Staff), 4 (Regional Leader)
  title: string;
  visible?: boolean;
  sendChapterTeamEmails?: boolean;
}

/**
 * Add a member to the chapter team in Bevy.
 * Endpoint: POST /chapter/{chapterId}/team/
 * Referer: https://gdg.community.dev/dashboard/{chapterSlug}/settings/team
 */
export async function addBevyChapterTeamMember(
  params: AddBevyChapterTeamMemberParams,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyChapterTeamMember | null; error?: string }> {
  try {
    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const referer = `https://gdg.community.dev/dashboard/${chapterSlug}/settings/team`;

    const body = {
      first_name: params.firstName.trim(),
      last_name: (params.lastName || "").trim(),
      role: Number(params.role),
      visible: Boolean(params.visible),
      send_chapter_team_emails: params.sendChapterTeamEmails ?? true,
      title: params.title.trim(),
      user: String(params.userId),
    };

    console.log(`[addBevyChapterTeamMember] Adding user ${params.userId} to chapter ${chapterId}...`);

    const result = await bevyFetchWithResponse<BevyChapterTeamMember>(
      `/chapter/${chapterId}/team/`,
      {
        method: "POST",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: referer,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(body),
        requireAuth: true,
      },
      chapterId,
    );

    if (!result.ok) {
      const errorMsg = extractApiMessage(result.data, `Failed to add team member (HTTP ${result.status})`);
      console.error(`[addBevyChapterTeamMember] Failed:`, errorMsg, result.data);
      return { success: false, error: errorMsg };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error(`[addBevyChapterTeamMember] Exception:`, error);
    return { success: false, error: extractApiMessage(error, "Failed to connect to Bevy server") };
  }
}

/**
 * Delete / remove a team member from Bevy chapter team.
 * Endpoint: DELETE /chapter/{chapterId}/team/{teamMemberId}/
 * Referer: https://gdg.community.dev/dashboard/{chapterSlug}/settings/team
 */
export async function deleteBevyChapterTeamMember(
  teamMemberId: string | number,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = String(teamMemberId).trim();
    if (!cleanId) return { success: false, error: "Team member ID is required" };

    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const referer = `https://gdg.community.dev/dashboard/${chapterSlug}/settings/team`;

    console.log(`[deleteBevyChapterTeamMember] Removing team member ${cleanId} from chapter ${chapterId}...`);

    const result = await bevyFetchWithResponse<unknown>(
      `/chapter/${chapterId}/team/${cleanId}/`,
      {
        method: "DELETE",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: referer,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        requireAuth: true,
      },
      chapterId,
    );

    if (!result.ok && result.status !== 204 && result.status !== 200) {
      const errorMsg = extractApiMessage(result.data, `Failed to remove team member (HTTP ${result.status})`);
      console.error(`[deleteBevyChapterTeamMember] Failed:`, errorMsg, result.data);
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error) {
    console.error(`[deleteBevyChapterTeamMember] Exception:`, error);
    return { success: false, error: extractApiMessage(error, "Failed to connect to Bevy server") };
  }
}

export interface UpdateBevyChapterTeamMemberParams {
  teamMemberId: string | number;
  userId: string | number;
  email?: string;
  firstName: string;
  lastName?: string;
  role: number; // 1 = Organizer, 2 = Team Member, 3 = Check-in Staff, 4 = Regional Leader
  title: string;
  visible?: boolean;
  sendChapterTeamEmails?: boolean;
}

/**
 * Update a chapter team member in Bevy.
 * Endpoint: PUT /chapter/{chapterId}/team/{teamMemberId}/
 * Referer: https://gdg.community.dev/dashboard/{chapterSlug}/settings/team
 */
export async function updateBevyChapterTeamMember(
  params: UpdateBevyChapterTeamMemberParams,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyChapterTeamMember | null; error?: string }> {
  try {
    const cleanId = String(params.teamMemberId).trim();
    if (!cleanId) return { success: false, error: "Team member ID is required" };

    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const referer = `https://gdg.community.dev/dashboard/${chapterSlug}/settings/team`;

    const body = {
      email: params.email?.trim() || "",
      first_name: params.firstName.trim(),
      last_name: (params.lastName || "").trim(),
      role: Number(params.role),
      visible: Boolean(params.visible),
      send_chapter_team_emails: params.sendChapterTeamEmails ?? true,
      title: params.title.trim(),
      user: Number(params.userId) || params.userId,
      chapter: Number(chapterId),
    };

    console.log(`[updateBevyChapterTeamMember] Updating team member ${cleanId} in chapter ${chapterId}...`);

    const result = await bevyFetchWithResponse<BevyChapterTeamMember>(
      `/chapter/${chapterId}/team/${cleanId}/`,
      {
        method: "PUT",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: referer,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(body),
        requireAuth: true,
      },
      chapterId,
    );

    if (!result.ok) {
      const errorMsg = extractApiMessage(result.data, `Failed to update team member (HTTP ${result.status})`);
      console.error(`[updateBevyChapterTeamMember] Failed:`, errorMsg, result.data);
      return { success: false, error: errorMsg };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error(`[updateBevyChapterTeamMember] Exception:`, error);
    return { success: false, error: extractApiMessage(error, "Failed to connect to Bevy server") };
  }
}

export interface UserChapterRoleResult {
  chapterRole: ChapterRole;
  roleId: number | null;
  roleTitle: string;
  isValidOrganizer: boolean;
  teamMember?: BevyChapterTeamMember;
}

/**
 * Safely compares candidate email (which may be masked with asterisks e.g. "i***@gdgjakarta.org")
 * against a target email address.
 */
export function isEmailMatch(candidateEmail?: string | null, targetEmail?: string | null): boolean {
  if (!candidateEmail || !targetEmail) return false;
  const c = candidateEmail.toLowerCase().trim();
  const t = targetEmail.toLowerCase().trim();
  if (c === t) return true;

  if (c.includes("*")) {
    const [cLocal, cDomain] = c.split("@");
    const [tLocal, tDomain] = t.split("@");
    if (!cLocal || !cDomain || !tLocal || !tDomain) return false;
    if (cDomain !== tDomain) return false;
    if (cLocal.length !== tLocal.length) return false;
    for (let i = 0; i < cLocal.length; i++) {
      if (cLocal[i] !== "*" && cLocal[i] !== tLocal[i]) {
        return false;
      }
    }
    return true;
  }

  return false;
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
  bevyUserId?: number | string | null,
  chapterId: string | number = BEVY_CONFIG.chapterId,
  email?: string | null,
): Promise<UserChapterRoleResult> {
  const chapterTeams = await getChapterTeam(chapterId);
  const normalizedId = bevyUserId !== undefined && bevyUserId !== null ? String(bevyUserId) : null;
  const normalizedEmail = email?.toLowerCase().trim() || null;

  const matchedMember = chapterTeams.find((m) => {
    const id = m.user?.id ?? m.user_id;
    const matchesId = id !== undefined && id !== null && normalizedId !== null && String(id) === normalizedId;
    const matchesEmail = normalizedEmail !== null && isEmailMatch(m.user?.email, normalizedEmail);
    return matchesId || matchesEmail;
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
  const roleId =
    typeof roleObj === "object" && roleObj !== null && typeof roleObj.id === "number"
      ? roleObj.id
      : typeof roleObj === "number"
        ? roleObj
        : null;

  const roleName =
    typeof roleObj === "object" && roleObj !== null && typeof roleObj.name === "string"
      ? roleObj.name
      : typeof roleObj === "string"
        ? roleObj
        : "";

  const chapterRole = getChapterRoleById(roleId);
  const isOrganizer = isChapterTeamRole(chapterRole);

  // Determine user title / designation
  let roleTitle = "Member";
  if (isOrganizer) {
    if (matchedMember.title?.trim()) {
      roleTitle = matchedMember.title.trim().replace(/\bGdg\b/gi, "GDG");
    } else if (roleName.trim()) {
      roleTitle = roleName.trim().replace(/\bGdg\b/gi, "GDG");
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
 * Authentication & role resolution matching KawalEvent:
 * 1. Calls Bevy API getMemberById(email) to resolve the user and their numerical Bevy ID.
 *    If the response from Bevy is not success or 200, member is new and hasn't registered on Bevy;
 *    dispatches GDG Jakarta API import-member webhook (same auth as Send Bulk Email).
 * 2. Uses getUserChapterRole(bevyUserId) to match against /chapter/{chapterId}/team/ results.
 * 3. Evaluates role dynamically from Bevy team role object (Role ID: 1 -> ORGANIZER, 2/3 -> CORE_TEAM, 4 -> GOOGLER).
 * 4. Strictly evaluated from Bevy API with NO hardcoded email or domain whitelists.
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

    // Only import if member is truly NOT registered on Bevy (e.g. 404, 403 / 200 permission message).
    // Do NOT import on 429 (rate limit) or 500+ (server error).
    if (!bevyUserId && isBevyUserNotFoundError(memberResponse)) {
      console.log(
        `[Bevy Auth Flow] Member ${normalizedEmail} is not registered on Bevy (status: ${memberResponse.status}). Registering new member via GDG Jakarta API...`,
      );

      const { firstName: splitFirst, lastName: splitLast } = splitFullName(displayName);
      let safeFirstName = firstName?.trim() || splitFirst.trim();
      if (!safeFirstName) {
        safeFirstName = displayName?.trim() || normalizedEmail.split("@")[0] || "Member";
      }
      const safeLastName = (lastName?.trim() ?? splitLast ?? "").trim() || ".";

      const importResult = await importMemberToBevy({
        firstName: safeFirstName,
        lastName: safeLastName,
        email: normalizedEmail,
      });

      if (importResult.success) {
        wasImported = true;
        console.log(`[Bevy Auth Flow] Successfully triggered import-member for ${normalizedEmail}. Retrying lookup...`);
        const retryMember = await getMemberById(normalizedEmail);
        if (retryMember.ok && retryMember.data) {
          bevyUser = retryMember.data;
          bevyUserId =
            retryMember.data.id !== undefined && retryMember.data.id !== null ? String(retryMember.data.id) : null;
          console.log(`[Bevy Auth Flow] Post-import retry lookup resolved Bevy ID: ${bevyUserId}`);
        } else {
          bevyUser = null;
          bevyUserId = null;
        }
      } else {
        console.warn(`[Bevy Auth Flow] Failed to import member to Bevy: ${importResult.error}`);
      }
    } else if (memberResponse.status === 429) {
      console.warn(`[Bevy Auth Flow] Bevy rate limit (429) encountered for ${normalizedEmail}. Skipping import.`);
    } else if (typeof memberResponse.status === "number" && memberResponse.status >= 500) {
      console.warn(
        `[Bevy Auth Flow] Bevy server error (${memberResponse.status}) for ${normalizedEmail}. Skipping import.`,
      );
    }

    // Step 2: Query chapter team role using Bevy User ID or verified email from /chapter/{chapterId}/team/
    const chapterRoleResult = await getUserChapterRole(bevyUserId, BEVY_CONFIG.chapterId, normalizedEmail);
    if (chapterRoleResult.isValidOrganizer) {
      if (!bevyUserId && chapterRoleResult.teamMember?.user?.id) {
        bevyUserId = String(chapterRoleResult.teamMember.user.id);
      }
      if (bevyUserId) {
        wasImported = false; // Resolved via chapter team; already a Bevy user
      }
      console.log(
        `[Bevy Auth Flow] Chapter role resolution for ${normalizedEmail} (Bevy ID ${bevyUserId ?? "N/A"}): ${chapterRoleResult.chapterRole} (RoleId: ${chapterRoleResult.roleId}, Title: "${chapterRoleResult.roleTitle}")`,
      );

      let role = "core_team";
      if (chapterRoleResult.roleId === 1 || chapterRoleResult.chapterRole === ChapterRole.ORGANIZER) {
        role = "organizer";
      } else if (chapterRoleResult.roleId === 3) {
        role = "check_in_staff";
      } else if (chapterRoleResult.chapterRole === ChapterRole.GOOGLER) {
        // Googlers are executive organizers; normalise to "organizer" so session
        // cookie, Firestore memberDoc.role, and all isDocOrg checks stay consistent.
        role = "organizer";
      }

      return {
        isValidOrganizer: true,
        role,
        // chapterRole must be a canonical role name (not the custom title) so it matches
        // isOrganizerData() / isStaffData() in Firestore rules and all isDocOrg checks.
        // e.g. "Community Manager" (roleId=1) → "Organizer"; "Regional Lead" (roleId=4) → "Googler"
        chapterRole:
          chapterRoleResult.chapterRole === ChapterRole.ORGANIZER
            ? "Organizer"
            : chapterRoleResult.chapterRole === ChapterRole.GOOGLER
              ? "Googler"
              : chapterRoleResult.chapterRole === ChapterRole.CORE_TEAM
                ? "Core Team"
                : chapterRoleResult.roleTitle,
        chapterRoleType: chapterRoleResult.chapterRole,
        roleId: chapterRoleResult.roleId,
        roleTitle: chapterRoleResult.roleTitle,
        bevyUserId,
        chapterTeamMember: chapterRoleResult.teamMember,
        bevyUser,
        wasImported,
      };
    }

    // Step 2.5: Environment fallback for master organizer accounts if Bevy lookup was rate limited / failed
    const { isAuthorizedOrganizerEmail } = await import("@/config/auth-config");
    if (await isAuthorizedOrganizerEmail(normalizedEmail)) {
      console.log(`[Bevy Auth Flow] Authorized organizer email from config: ${normalizedEmail}`);
      return {
        isValidOrganizer: true,
        role: "organizer",
        chapterRole: "Organizer",
        chapterRoleType: ChapterRole.ORGANIZER,
        roleId: 1,
        roleTitle: "GDG Organizer",
        // Never write a fallback or synthetic Bevy ID. If Bevy hasn't returned a genuine user ID,
        // leave it null so the member is marked as not synced yet and avoids duplicate/colliding IDs.
        bevyUserId: bevyUserId ?? null,
        bevyUser,
        wasImported: false,
      };
    }

    // Step 3: Regular Community Member (No hardcoded whitelist fallback!)
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
 * Fetch all registered chapter community members from Bevy, handling pagination.
 * If maxMembers is specified, stops once that count is reached.
 */
export async function getAllBevyChapterMembers(
  chapterId: string = BEVY_CONFIG.chapterId,
  maxMembers?: number,
): Promise<{ success: boolean; results: BevyChapterMember[]; count: number; error?: string }> {
  const pageSize = 250;
  const firstRes = await getBevyChapterMembers(chapterId, pageSize, 1, "-created_date");
  if (!firstRes) {
    return { success: false, results: [], count: 0, error: "Failed to fetch chapter members from Bevy." };
  }

  const results: BevyChapterMember[] = [...(firstRes.results ?? [])];
  const count = firstRes.count ?? results.length;
  const targetCount = maxMembers ? Math.min(maxMembers, count) : count;

  if (targetCount > results.length) {
    const totalPages = Math.ceil(targetCount / pageSize);
    const BATCH_SIZE = 8;
    for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
      const promises: Promise<BevyMembersResponse | null>[] = [];
      for (let p = batchStart; p <= batchEnd; p++) {
        promises.push(getBevyChapterMembers(chapterId, pageSize, p, "-created_date"));
      }
      const pageResponses = await Promise.all(promises);
      for (const res of pageResponses) {
        if (res?.results) {
          results.push(...res.results);
        }
      }
      if (maxMembers && results.length >= maxMembers) {
        break;
      }
    }
  }

  return {
    success: true,
    results: maxMembers ? results.slice(0, maxMembers) : results,
    count,
  };
}

interface AlgoliaConfigCache {
  applicationId: string;
  indexPrefix: string;
  indexSuffix: string;
  chapterMemberKey: string;
  fetchedAt: number;
}

let algoliaMemberCache: AlgoliaConfigCache | null = null;
const ALGOLIA_CACHE_TTL_MS = 10 * 60 * 1000;

interface AlgoliaMemberHit {
  id: number | string;
  chapter_id?: number | string;
  user_id?: number | string | null;
  user_full_name?: string;
  user_email?: string;
  masked_email?: string;
  user_profile_url?: string;
  is_email_verified?: boolean;
  created_date?: string | number | null;
  events_registered_count?: number;
}

/**
 * Search across all chapter community members in Bevy using Bevy's Algolia `chapter_member_index`.
 */
export async function searchBevyChapterMembers(
  query: string,
  chapterId: string = BEVY_CONFIG.chapterId,
  hitsPerPage = 100,
): Promise<BevyChapterMember[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const now = Date.now();
  if (!algoliaMemberCache || now - algoliaMemberCache.fetchedAt > ALGOLIA_CACHE_TTL_MS) {
    const chapterSlug = BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const [algoliaConfig, memberPage] = await Promise.all([
      bevyFetch<{
        application_id?: string;
        index_prefix?: string;
        index_suffix?: string;
      }>(
        "/config/algolia/",
        {
          headers: {
            Referer: `https://gdg.community.dev/dashboard/${chapterSlug}/members/`,
            "X-Requested-With": "XMLHttpRequest",
          },
        },
        chapterId,
      ),
      getBevyChapterMembers(chapterId, 1, 1, "-created_date"),
    ]);

    if (
      algoliaConfig?.application_id &&
      algoliaConfig.index_prefix &&
      algoliaConfig.index_suffix &&
      memberPage?.chapter_member_key
    ) {
      algoliaMemberCache = {
        applicationId: algoliaConfig.application_id,
        indexPrefix: algoliaConfig.index_prefix,
        indexSuffix: algoliaConfig.index_suffix,
        chapterMemberKey: memberPage.chapter_member_key,
        fetchedAt: now,
      };
    }
  }

  if (!algoliaMemberCache) return [];

  const { applicationId, indexPrefix, indexSuffix, chapterMemberKey } = algoliaMemberCache;
  const indexName = `${indexPrefix}_chapter_member_index_${indexSuffix}`;

  try {
    const res = await fetch(
      `https://${applicationId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Algolia-Application-Id": applicationId,
          "X-Algolia-API-Key": chapterMemberKey,
        },
        body: JSON.stringify({
          query: cleanQuery,
          filters: `chapter_id=${chapterId}`,
          page: 0,
          hitsPerPage,
        }),
      },
    );

    if (!res.ok) {
      algoliaMemberCache = null;
      return [];
    }

    const data = (await res.json()) as { hits?: AlgoliaMemberHit[] };
    return (data.hits ?? []).map((hit) => {
      let createdDate: string | undefined;
      if (hit.created_date != null) {
        if (typeof hit.created_date === "number" || /^\d+$/.test(String(hit.created_date))) {
          createdDate = new Date(Number(hit.created_date) * 1000).toISOString();
        } else {
          createdDate = String(hit.created_date);
        }
      }
      return {
        id: hit.id,
        user: {
          id: hit.user_id ?? hit.id,
          full_name: hit.user_full_name || "",
          email: hit.user_email || hit.masked_email,
          profile_url: hit.user_profile_url,
          is_email_verified: Boolean(hit.is_email_verified),
        },
        created_date: createdDate,
        events_registered_count: hit.events_registered_count ?? 0,
      };
    });
  } catch (err) {
    console.warn("[searchBevyChapterMembers] Algolia search failed:", err);
    return [];
  }
}

/**
 * Fetch events for a given chapter from Bevy
 */
export async function getBevyChapterEvents(
  chapterId: string = BEVY_CONFIG.chapterId,
  pageSize = 100,
  page = 1,
  includeHidden = true,
  status = "Published",
): Promise<BevyEventsResponse | null> {
  const cacheKey = `${chapterId}:${pageSize}:${page}:${includeHidden}:${status}`;
  const now = Date.now();
  const cached = eventsLkgCache.get(cacheKey);

  // Return fresh cache if within TTL
  if (cached && now - cached.timestamp < EVENTS_CACHE_TTL_MS) {
    return cached.data;
  }

  const isAllStatus = !status || status.toLowerCase() === "all";
  const fields =
    "id,title,description_short,description,event_type_title,audience_type,is_virtual_event,virtual_event_type,attendee_virtual_venue_link,join_virtual_event_url,video_url,start_date,end_date,status,picture,banner,cropped_banner_url,cropped_picture_url,event_type_logo,url,static_url,total_attendees,checkin_count,total_tickets,total_rsvps_sold,completed,tags,chapter,is_hidden,is_test,venue_name,venue_address,venue_city,venue_state,venue_zip_code,venue_country,venue_latitude,venue_longitude";
  const hiddenParam = includeHidden ? "" : "&is_hidden=false";
  const statusParam = !isAllStatus ? `&status=${encodeURIComponent(status)}` : "";
  const result = await bevyFetch<BevyEventsResponse>(
    `/chapter/${chapterId}/event/?page_size=${pageSize}&page=${page}&fields=${fields}${hiddenParam}${statusParam}`,
    {},
    chapterId,
  );

  if (result && Array.isArray(result.results)) {
    const rawCount = result.results.length;
    result.results = result.results.filter((e) => {
      const isHiddenOrTest = !includeHidden && (e.is_hidden || (e as { hidden?: boolean }).hidden || e.is_test);
      if (isHiddenOrTest) return false;
      if (!isAllStatus) {
        const eventStatus = e.status?.toLowerCase();
        if (eventStatus && eventStatus !== status.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
    const removedCount = rawCount - result.results.length;
    if (removedCount > 0 && typeof result.count === "number") {
      result.count = Math.max(result.results.length, result.count - removedCount);
    }

    // Store in Last-Known-Good cache
    eventsLkgCache.set(cacheKey, {
      data: result,
      timestamp: now,
    });

    return result;
  }

  // If live fetch failed/returned null, serve Last-Known-Good stale entry if present
  if (cached?.data) {
    console.warn(`[Bevy Events] Serving Last-Known-Good cache for ${cacheKey}`);
    return cached.data;
  }

  return result;
}

/**
 * Fetch all events for a given chapter from Bevy across all pages.
 */
export async function getAllBevyChapterEvents(
  chapterId: string = BEVY_CONFIG.chapterId,
  includeHidden = true,
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
  includeHidden = true,
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

    // If picture is empty or missing a URL, populate from event_type_logo or cropped_picture_url so 1080x1080 thumbnail is available
    const hasPictureUrl = Boolean(result.picture?.url || result.picture?.thumbnail_url);
    if (!hasPictureUrl) {
      const fallbackUrl =
        result.event_type_logo?.url ?? result.event_type_logo?.thumbnail_url ?? result.cropped_picture_url;
      if (fallbackUrl) {
        const normalized1080Url = fallbackUrl.includes("res.cloudinary.com")
          ? fallbackUrl.replace(
              /\/image\/upload\/(?:.+?\/)?v1\//,
              "/image/upload/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/",
            )
          : fallbackUrl;

        result.picture = {
          url: normalized1080Url,
          thumbnail_url: normalized1080Url,
        };
        result.picture_url = normalized1080Url;
      }
    } else if (result.picture?.url?.includes("res.cloudinary.com")) {
      result.picture_url = result.picture.url.replace(
        /\/image\/upload\/(?:.+?\/)?v1\//,
        "/image/upload/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/",
      );
    } else if (result.picture?.url) {
      result.picture_url = result.picture.url;
    }

    // Normalize Bevy agenda structure: Bevy API delivers day items under day.agenda, or as an array
    if (result.agenda) {
      if (Array.isArray(result.agenda)) {
        const first = result.agenda[0];
        if (first && typeof first === "object" && ("items" in first || "agenda" in first)) {
          result.agenda = { days: result.agenda as BevyAgendaDay[] };
        } else {
          result.agenda = {
            days: [
              {
                title: "Day 1",
                items: result.agenda as BevyAgendaItem[],
                agenda: result.agenda as BevyAgendaItem[],
              },
            ],
          };
        }
      }
      if (result.agenda.days && Array.isArray(result.agenda.days)) {
        for (const day of result.agenda.days) {
          if (!day.items && Array.isArray(day.agenda)) {
            day.items = day.agenda;
          } else if (!day.agenda && Array.isArray(day.items)) {
            day.agenda = day.items;
          }
        }
      }
    }
  }
  return result;
}

/**
 * Fetch full event details by ID directly from Bevy for public event pages,
 * with fallback lookup by chapter events list if direct ID lookup fails.
 */
export const getPublicEventById = cache(
  async (eventId: string | number, chapterId: string | number = BEVY_CONFIG.chapterId): Promise<BevyEvent | null> => {
    if (!eventId) return null;
    const cleanId = String(eventId).trim();
    const direct = await getBevyEventById(cleanId, chapterId);
    if (direct) return direct;

    // For numeric IDs (e.g. 132640), the direct endpoint /event/{id}/ is authoritative.
    // Avoid running an expensive chapter-wide scan across all events when direct lookup returns 404 or null.
    const isNumericId = /^\d+$/.test(cleanId);
    if (isNumericId) {
      return null;
    }

    try {
      const { results: chapterEvents } = await getAllBevyChapterEvents(
        chapterId ? String(chapterId) : undefined,
        true,
        "All",
      );
      const matched = chapterEvents.find(
        (e) =>
          String(e.id) === cleanId ||
          e.url?.includes(cleanId) ||
          e.static_url?.includes(cleanId) ||
          e.slug === cleanId ||
          e.short_id === cleanId,
      );
      if (matched) {
        // Re-fetch full event detail by numeric ID only if matched.id is different from cleanId (e.g. cleanId was a slug)
        if (String(matched.id) !== cleanId) {
          const fullEvent = await getBevyEventById(matched.id, chapterId);
          if (fullEvent) return fullEvent;
        }

        matched.partners = extractEventPartners(matched);
        return matched;
      }
    } catch (error) {
      console.warn("[BevyClient] getPublicEventById fallback search failed:", error);
    }

    return null;
  },
);

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
 * Fetch all attendees for a given event from Bevy across all pages.
 */
export async function getAllBevyEventAttendees(
  eventId: string | number,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; results: BevyAttendee[]; count: number; error?: string }> {
  const pageSize = 200;
  const referer = await getBevyRefererUrl(chapterId, eventId);
  const firstEndpoint = `/event/${eventId}/attendee/?page_size=${pageSize}&page=1&order_by=-created_date`;

  const firstResponse = await bevyFetchWithResponse<BevyAttendeesResponse>(
    firstEndpoint,
    {
      headers: {
        Referer: referer,
      },
    },
    chapterId,
  );

  if (!firstResponse.ok || !firstResponse.data) {
    const errorMsg = `Failed to fetch Bevy attendees (status ${firstResponse.status})`;
    console.error(`[getAllBevyEventAttendees] ${errorMsg}`);
    return { success: false, results: [], count: 0, error: errorMsg };
  }

  const results: BevyAttendee[] = [...(firstResponse.data.results ?? [])];
  const count = firstResponse.data.count ?? results.length;

  if (count > results.length) {
    const totalPages = Math.ceil(count / pageSize);
    const pagePromises = [];
    for (let p = 2; p <= totalPages; p++) {
      pagePromises.push(
        bevyFetchWithResponse<BevyAttendeesResponse>(
          `/event/${eventId}/attendee/?page_size=${pageSize}&page=${p}&order_by=-created_date`,
          {
            headers: {
              Referer: referer,
            },
          },
          chapterId,
        ),
      );
    }

    const subsequentPages = await Promise.all(pagePromises);
    for (const pageRes of subsequentPages) {
      if (pageRes.ok && pageRes.data?.results) {
        results.push(...pageRes.data.results);
      }
    }
  }

  return { success: true, results, count };
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

/**
 * Deletes / removes an attendee from Bevy using session spoofing.
 * Endpoint: DELETE /attendee/{attendeeId}/
 * Referer: https://gdg.community.dev/dashboard/{chapterSlug}/events/{eventId}/registrations/
 */
export async function deleteBevyAttendee(
  attendeeId: string | number,
  eventId?: string | number,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const cleanAttendeeId = String(attendeeId).trim().replace(/\/+$/, "");
    if (!cleanAttendeeId) {
      return { success: false, error: "Attendee ID is required" };
    }

    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const referer = eventId
      ? `https://gdg.community.dev/dashboard/${chapterSlug}/events/${eventId}/registrations/`
      : await getBevyRefererUrl(chapterId, eventId);

    console.log(`[deleteBevyAttendee] Deleting attendee ${cleanAttendeeId} on Bevy (Event: ${eventId ?? "N/A"})...`);

    const response = await bevyFetchWithResponse<unknown>(
      `/attendee/${cleanAttendeeId}/`,
      {
        method: "DELETE",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: referer,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
          "X-Requested-With": "XMLHttpRequest",
        },
      },
      chapterId,
    );

    if (response.ok || response.status === 204) {
      console.log(`[deleteBevyAttendee] Successfully deleted attendee ${cleanAttendeeId} from Bevy.`);
      return { success: true, status: response.status };
    }

    // 404 means already deleted / not present on Bevy
    if (response.status === 404) {
      console.warn(`[deleteBevyAttendee] Attendee ${cleanAttendeeId} already removed on Bevy (404 Not Found).`);
      return { success: true, status: 404 };
    }

    const errorMsg = `Bevy attendee deletion failed with status ${response.status}`;
    console.warn(`[deleteBevyAttendee] ${errorMsg}`);
    return { success: false, status: response.status, error: errorMsg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete attendee from Bevy";
    console.error("[deleteBevyAttendee] error:", err);
    return { success: false, error: msg };
  }
}

/**
 * Searches attendees for an event using Bevy's attendee search endpoint.
 * Endpoint: GET /attendee_search/
 * Query Parameters: event, search, page_size
 */
export async function searchBevyAttendees(
  eventId: string | number,
  searchQuery: string,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<BevyAttendee[]> {
  try {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery || !eventId) return [];

    const referer = await getBevyRefererUrl(chapterId, eventId);
    const endpoint = `/attendee_search/?event=${encodeURIComponent(eventId)}&search=${encodeURIComponent(cleanQuery)}&page_size=50`;

    const response = await bevyFetchWithResponse<{
      count?: number;
      results?: BevyAttendee[];
    }>(
      endpoint,
      {
        headers: {
          Referer: referer,
        },
      },
      chapterId,
    );

    if (response.ok && response.data?.results) {
      return response.data.results;
    }
    return [];
  } catch (err) {
    console.warn(`[searchBevyAttendees] Error searching attendees for event ${eventId}:`, err);
    return [];
  }
}

/**
 * Finds a Bevy attendee ID for a specific event by matching their email address.
 * First queries `/attendee_search/` for rapid lookup, then falls back to full event roster.
 */
export async function findBevyAttendeeIdByEmail(
  eventId: string | number,
  email: string,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<number | null> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail || !eventId) return null;

  try {
    // 1. Fast search via attendee_search endpoint
    const searchResults = await searchBevyAttendees(eventId, normalizedEmail, chapterId);
    const match = searchResults.find((att) => att.email && att.email.toLowerCase().trim() === normalizedEmail);
    if (match?.id) {
      return match.id;
    }
  } catch (searchErr) {
    console.warn(`[findBevyAttendeeIdByEmail] Search endpoint fallback triggered for ${normalizedEmail}:`, searchErr);
  }

  try {
    // 2. Fallback to event attendees roster
    const allAttendees = await getAllBevyEventAttendees(eventId, chapterId);
    if (allAttendees.success && allAttendees.results) {
      const match = allAttendees.results.find((att) => att.email && att.email.toLowerCase().trim() === normalizedEmail);
      if (match?.id) {
        return match.id;
      }
    }
  } catch (rosterErr) {
    console.warn(`[findBevyAttendeeIdByEmail] Roster lookup failed for ${normalizedEmail}:`, rosterErr);
  }

  return null;
}

/**
 * Creates a new event in Bevy with external registration link (event_type: 40).
 * Defaults custom_tickets_url to the dashboard registration page if not explicitly set.
 */
export async function createBevyExternalEvent(
  input: BevyCreateEventInput,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyEvent | null; error?: string }> {
  try {
    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const numericChapterId = Number(chapterId) || 642;

    const basePayload: Record<string, unknown> = {
      title: input.title.trim(),
      description: input.description.trim(),
      description_short: input.description_short?.trim() || null,
      show_short_description_on_event_banner: false,
      tickets: [],
      recurring_event: null,
      start_date: input.start_date,
      end_date: input.end_date,
      _timezone: input.timezone || "Asia/Jakarta",
      picture: "",
      banner: "",
      banner_crop_vertical: 0,
      total_capacity: String(input.total_capacity ?? 100),
      audience_type: input.audience_type || "IN_PERSON",
      is_test: input.is_test ?? false,
      is_hidden: input.is_hidden ?? false,
      visible_on_parent_chapter_only: input.visible_on_parent_chapter_only ?? false,
      sharing_disabled: input.sharing_disabled ?? false,
      allow_automated_emails_when_hidden: input.allow_automated_emails_when_hidden ?? false,
      moderated_qa_enabled: input.moderated_qa_enabled ?? false,
      chat_disabled: input.chat_disabled ?? false,
      is_many_to_many_virtual_event: input.is_many_to_many_virtual_event ?? false,
      allows_cohosting: false,
      event_type: 40, // External registration
      meetup_announce: false,
      custom_tickets_url: input.custom_tickets_url || "",
      speakers: [],
      mentors: [],
      facilitators: [],
      panelists: [],
      judges: [],
      moderators: [],
      hosts: [],
      "sponsors_platinum-4": [],
      "sponsors_gold-5": [],
      "sponsors_silver-4": [],
      "sponsors_bronze-4": [],
      "sponsors_community-4": [],
      partners_list: [],
      companies: [],
      automatically_record_event:
        input.automatically_record_event ?? (input.audience_type === "VIRTUAL" || input.audience_type === "HYBRID"),
      tags: [],
      ...(input.audience_type === "VIRTUAL" || input.audience_type === "HYBRID"
        ? {
            virtual_event_type: input.virtual_event_type || "internal",
            ...(input.virtual_venue_link ? { virtual_venue_link: input.virtual_venue_link } : {}),
            ...(input.virtual_event_instructions
              ? { virtual_event_instructions: input.virtual_event_instructions }
              : {}),
          }
        : {}),
      venue_name: input.venue_name || "",
      venue_address: input.venue_address || "",
      venue_city: input.venue_city || "",
      venue_zip_code: input.venue_zip_code || "",
      show_map: input.show_map ?? true,
      venue_country: input.venue_country || "ID",
      venue_state: input.venue_state || "Daerah Khusus Ibukota Jakarta",
      venue_latitude: input.venue_latitude ?? -6.1932775,
      venue_longitude: input.venue_longitude ?? 106.8396981,
      status: input.status || "Published",
      chapter: numericChapterId,
    };

    console.log(`[createBevyExternalEvent] Creating event for chapter ${chapterId}...`);

    // 1. Send POST /event/ to create the event entity
    const postRes = await bevyFetchWithResponse<BevyEvent>(
      `/event/`,
      {
        method: "POST",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: `https://gdg.community.dev/dashboard/${chapterSlug}/events/`,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(basePayload),
        requireAuth: true,
      },
      chapterId,
    );

    let createdEvent = postRes.data;

    // If initial creation failed, return the error
    if (!postRes.ok || !createdEvent?.id) {
      const errorMsg = extractApiMessage(postRes.data, `Failed to create event (HTTP ${postRes.status})`);
      console.error(`[createBevyExternalEvent] Failed to create event:`, errorMsg, postRes.data);
      return { success: false, error: errorMsg };
    }

    const eventId = String(createdEvent.id);

    // 2. Ensure custom_tickets_url is set to https://gdgjakarta.com/events/{eventId} if not set
    const finalTicketsUrl = input.custom_tickets_url || `https://gdgjakarta.com/events/${eventId}`;
    if (!input.custom_tickets_url || input.custom_tickets_url !== finalTicketsUrl) {
      console.log(`[createBevyExternalEvent] Updating custom_tickets_url to ${finalTicketsUrl} on event ${eventId}`);
      const patchRes = await updateBevyEvent(
        eventId,
        {
          custom_tickets_url: finalTicketsUrl,
        },
        chapterId,
      );
      if (patchRes.success && patchRes.data) {
        createdEvent = patchRes.data;
      }
    }

    // Invalidate cached event list
    eventsLkgCache.clear();

    return { success: true, data: createdEvent };
  } catch (err) {
    console.error(`[createBevyExternalEvent] Exception:`, err);
    return { success: false, error: extractApiMessage(err, "Failed to connect to Bevy server") };
  }
}

/**
 * Updates an existing Bevy event via PATCH /api/event/{eventId}/.
 * Used for syncing custom_tickets_url (Short links), capacity, venue, etc.
 */
export async function updateBevyEvent(
  eventId: string | number,
  payload: BevyUpdateEventInput,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyEvent | null; error?: string }> {
  try {
    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const cleanId = String(eventId).trim();
    const numericChapterId = Number(chapterId) || 642;

    const patchPayload: Record<string, unknown> = {
      ...payload,
      id: cleanId,
      chapter: numericChapterId,
      event_type: payload.event_type ?? 40,
      custom_tickets_url: payload.custom_tickets_url || `https://gdgjakarta.com/events/${cleanId}`,
      meetup_announce: payload.meetup_announce ?? false,
    };

    if (payload.total_capacity !== undefined) {
      patchPayload.total_capacity = String(payload.total_capacity);
    }

    if (payload.agenda !== undefined && typeof payload.agenda !== "string") {
      patchPayload.agenda = JSON.stringify(payload.agenda);
    }

    // Sanitize virtual/venue fields depending on audience type so Bevy doesn't fail on missing required subfields
    if (payload.audience_type === "VIRTUAL") {
      delete patchPayload.venue_name;
      delete patchPayload.venue_address;
      delete patchPayload.venue_city;
      delete patchPayload.venue_zip_code;
      delete patchPayload.venue_country;
      delete patchPayload.venue_state;
      delete patchPayload.venue_latitude;
      delete patchPayload.venue_longitude;
    } else if (payload.audience_type === "IN_PERSON") {
      delete patchPayload.virtual_venue_link;
      delete patchPayload.virtual_event_instructions;
      delete patchPayload.virtual_event_type;
    }

    if (patchPayload.virtual_event_type === "internal") {
      // Internal Bevy virtual does not require or allow external link
      delete patchPayload.virtual_venue_link;
    }

    const referer = `https://gdg.community.dev/dashboard/${chapterSlug}/events/${cleanId}/details/?mode=create`;

    console.log(`[updateBevyEvent] Patching event ${cleanId} with payload:`, Object.keys(patchPayload));

    const response = await bevyFetchWithResponse<BevyEvent>(
      `/event/${cleanId}/`,
      {
        method: "PATCH",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: referer,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(patchPayload),
        requireAuth: true,
      },
      chapterId,
    );

    if (!response.ok) {
      const errorMsg = extractApiMessage(response.data, `Failed to update event (HTTP ${response.status})`);
      console.error(`[updateBevyEvent] Failed:`, errorMsg, response.data);
      return { success: false, error: errorMsg };
    }

    // Invalidate cached event list
    eventsLkgCache.clear();

    return { success: true, data: response.data };
  } catch (err) {
    console.error(`[updateBevyEvent] Exception:`, err);
    return { success: false, error: extractApiMessage(err, "Failed to connect to Bevy server") };
  }
}

/**
 * Calls Bevy's AI Event Generation endpoint to draft an event title, description, and short summary.
 * Endpoint: POST /api/ai/event_generation/generate/
 */
export async function generateBevyAiEventDetails(
  topic: string,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyAiEventGenerationResponse | null; error?: string }> {
  try {
    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const numericChapterId = Number(chapterId) || 642;

    const payload = {
      chapter_id: numericChapterId,
      topic: topic.trim(),
    };

    console.log(
      `[generateBevyAiEventDetails] Requesting AI generation for topic "${topic}" in chapter ${chapterId}...`,
    );

    const response = await bevyFetchWithResponse<BevyAiEventGenerationResponse>(
      `/ai/event_generation/generate/`,
      {
        method: "POST",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: `https://gdg.community.dev/dashboard/${chapterSlug}/events/`,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(payload),
        requireAuth: true,
      },
      chapterId,
    );

    if (!response.ok || !response.data) {
      const errorMsg = extractApiMessage(response.data, `Failed to generate event with AI (HTTP ${response.status})`);
      console.error(`[generateBevyAiEventDetails] Failed:`, errorMsg, response.data);
      return { success: false, error: errorMsg };
    }

    return { success: true, data: response.data };
  } catch (err) {
    console.error(`[generateBevyAiEventDetails] Exception:`, err);
    return { success: false, error: extractApiMessage(err, "Failed to connect to Bevy server") };
  }
}

/**
 * Calls Bevy's AI Content Modification endpoint to regenerate, shorten, or rewrite event title or description.
 * Endpoint: POST /api/ai/content_modification/
 */
export async function modifyBevyAiEventContent(
  params: BevyAiContentModificationParams,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyAiContentModificationResponse | null; error?: string }> {
  try {
    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";

    const payload = {
      field: params.field,
      change: params.change || "regenerate",
      logging_context: {
        object_id: String(params.objectId || ""),
        object_type: "event",
      },
      object_representation: {
        title: params.title,
        description: params.description,
      },
      max_length: params.maxLength ?? 10000,
      min_length: params.minLength ?? 11,
    };

    console.log(`[modifyBevyAiEventContent] Modifying ${params.field} with change="${payload.change}"...`);

    const response = await bevyFetchWithResponse<BevyAiContentModificationResponse>(
      `/ai/content_modification/`,
      {
        method: "POST",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: `https://gdg.community.dev/dashboard/${chapterSlug}/events/`,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(payload),
        requireAuth: true,
      },
      chapterId,
    );

    if (!response.ok || !response.data) {
      const errorMsg = extractApiMessage(response.data, `Failed to modify content with AI (HTTP ${response.status})`);
      console.error(`[modifyBevyAiEventContent] Failed:`, errorMsg, response.data);
      return { success: false, error: errorMsg };
    }

    return { success: true, data: response.data };
  } catch (err) {
    console.error(`[modifyBevyAiEventContent] Exception:`, err);
    return { success: false, error: extractApiMessage(err, "Failed to connect to Bevy server") };
  }
}

export interface BevyPersonInput {
  first_name: string;
  last_name: string;
  title: string;
  bio?: string;
  picture?: string;
}

export interface BevyPersonResponse {
  id: number;
  first_name: string;
  last_name: string;
  title: string;
  bio: string;
  picture: string;
  [key: string]: unknown;
}

/**
 * Creates a speaker/person in Bevy event people roster.
 * POST /api/person/
 */
export async function createBevyPerson(
  eventId: string | number,
  person: BevyPersonInput,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyPersonResponse | null; error?: string }> {
  try {
    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const response = await bevyFetchWithResponse<BevyPersonResponse>(
      `/person/`,
      {
        method: "POST",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: `https://gdg.community.dev/dashboard/${chapterSlug}/events/${eventId}/people/`,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          first_name: person.first_name,
          last_name: person.last_name,
          title: person.title || "",
          bio: person.bio || "",
          picture: person.picture || "",
        }),
        requireAuth: true,
      },
      chapterId,
    );

    if (!response.ok || !response.data) {
      const errorMsg = extractApiMessage(response.data, `Failed to create speaker in Bevy (HTTP ${response.status})`);
      return { success: false, error: errorMsg };
    }

    return { success: true, data: response.data };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to connect to Bevy server") };
  }
}

/**
 * Updates a speaker/person in Bevy.
 * PATCH /api/person/{personId}/
 */
export async function updateBevyPerson(
  personId: string | number,
  eventId: string | number,
  person: Partial<BevyPersonInput>,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyPersonResponse | null; error?: string }> {
  try {
    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const response = await bevyFetchWithResponse<BevyPersonResponse>(
      `/person/${personId}/`,
      {
        method: "PATCH",
        headers: {
          Origin: "https://gdg.community.dev",
          Referer: `https://gdg.community.dev/dashboard/${chapterSlug}/events/${eventId}/people/`,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(person),
        requireAuth: true,
      },
      chapterId,
    );

    if (!response.ok || !response.data) {
      const errorMsg = extractApiMessage(response.data, `Failed to update speaker in Bevy (HTTP ${response.status})`);
      return { success: false, error: errorMsg };
    }

    return { success: true, data: response.data };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to connect to Bevy server") };
  }
}

/**
 * Gets a speaker/person from Bevy.
 * GET /api/person/{personId}/
 */
export async function getBevyPerson(
  personId: string | number,
  eventId: string | number,
  chapterId: string | number = BEVY_CONFIG.chapterId,
): Promise<{ success: boolean; data?: BevyPersonResponse | null; error?: string }> {
  try {
    const chapterSlug = process.env.BEVY_CHAPTER_SLUG || BEVY_CONFIG.chapterSlug || "gdg-jakarta";
    const response = await bevyFetchWithResponse<BevyPersonResponse>(
      `/person/${personId}/`,
      {
        method: "GET",
        headers: {
          Referer: `https://gdg.community.dev/dashboard/${chapterSlug}/events/${eventId}/people/`,
          "Auth-Type": "AUTHORIZED",
          "X-Requested-With": "XMLHttpRequest",
        },
        requireAuth: true,
      },
      chapterId,
    );

    if (!response.ok || !response.data) {
      const errorMsg = extractApiMessage(response.data, `Failed to fetch speaker from Bevy (HTTP ${response.status})`);
      return { success: false, error: errorMsg };
    }

    return { success: true, data: response.data };
  } catch (err) {
    return { success: false, error: extractApiMessage(err, "Failed to connect to Bevy server") };
  }
}

export interface BevyPersonSearchResult {
  id: number;
  first_name: string;
  last_name: string;
  picture_url?: string;
  company?: string;
  title?: string;
  objectID: string;
}

// Cached Algolia key for person/speaker search
let cachedAlgoliaPersonKey: { key: string; fetchedAt: number } | null = null;
const ALGOLIA_PERSON_KEY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Resolves a valid Algolia search key for the Bevy persons/events index.
 * 1. Uses explicit `process.env.BEVY_ALGOLIA_PERSON_SEARCH_KEY` if provided.
 * 2. Uses in-memory cached key if still valid.
 * 3. Dynamically fetches fresh `Globals.dashboard_search_key` from `/accounts/dashboard/` using active session credentials.
 * 4. Falls back to latest active dashboard key snapshot.
 */
async function resolveBevyAlgoliaPersonKey(): Promise<string | null> {
  const envKey = process.env.BEVY_ALGOLIA_PERSON_SEARCH_KEY;
  if (envKey) return envKey;

  const now = Date.now();
  if (cachedAlgoliaPersonKey && now - cachedAlgoliaPersonKey.fetchedAt < ALGOLIA_PERSON_KEY_CACHE_TTL_MS) {
    return cachedAlgoliaPersonKey.key;
  }

  try {
    const creds = await getBevyAuthCredentials();
    const cookie = creds.cookie || process.env.BEVY_COOKIE;

    if (cookie) {
      const res = await fetch("https://gdg.community.dev/accounts/dashboard/", {
        headers: {
          cookie,
          referer: "https://gdg.community.dev/accounts/dashboard/",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
        },
        signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(5000) : undefined,
      });

      if (res.ok) {
        const html = await res.text();
        const m = html.match(/Globals\.dashboard_search_key\s*=\s*\x27([^\x27]+)\x27/);
        if (m && m[1]) {
          cachedAlgoliaPersonKey = { key: m[1], fetchedAt: now };
          return m[1];
        }
      }
    }
  } catch (err) {
    console.warn("[resolveBevyAlgoliaPersonKey] Dynamic key renewal failed:", err);
  }

  // Active snapshot key extracted from Bevy Organizer dashboard
  const fallbackKey =
    "NmJhNGJlY2MzOTc2NzM3MjA5YjgxNDFiZTQ4NzFhN2M5Zjc4MDA4MDg3ZTQyYTgyNmJjNGVhMWFkMDY3Y2NkNmF0dHJpYnV0ZXNUb0hpZ2hsaWdodD0mYXR0cmlidXRlc1RvUmV0cmlldmU9c3RhdGVfZnVsbCUyQ2Rlc2NyaXB0aW9uX3Nob3J0JTJDY2hhcHRlcl9yZWdpb24lMkN0aXRsZSUyQ2hlYWx0aF9pbmRpY2F0b3IlMkN3b3Jkc19jb3VudGVyJTJDcmVnaW9uJTJDbG9nbyUyQ3RvdGFsX3RpY2tldHNfc29sZF9saWZldGltZSUyQ3RhZ3MlMkNldmVudF90eXBlX2xvZ28lMkNwb3N0X3VybCUyQ2V2ZW50X3R5cGVfdGl0bGUlMkNjaGFwdGVyX2xvY2F0aW9uJTJDbW9udGhseV9ldmVudHNfbGFzdF8xMiUyQ3N0YXJ0X2RhdGVfdW5peCUyQ2NoYXB0ZXJfbGlzdF9pZHMlMkNmZWF0dXJlZF9pbWFnZSUyQ3B1Ymxpc2hfZGF0ZSUyQ2V2ZW50X2FjdGl2aXR5X3BlcmNlbnRhZ2VfbGFzdF8xMiUyQ3NlbnRfZGF0ZSUyQ3VybCUyQ2NoYXB0ZXJfY2l0eSUyQ2VuZF9kYXRlX3VuaXglMkN0YWdzX2lkcyUyQ2NvbXBhbnklMkNzY2hlZHVsZV9kYXRlJTJDbGluayUyQ2F1ZGllbmNlX3R5cGVfbmFtZSUyQ2lzX2hpZGRlbiUyQ2NoYXB0ZXJfaXNfcHJpdmF0ZSUyQ3JlbGF0aXZlX3VybCUyQ3VzZXIlMkNjaGFwdGVyX2NvdW50cnlfY29kZSUyQ3N1YmplY3QlMkNpc19nbG9iYWwlMkNjb3VudHJ5X2NvZGUlMkNpZCUyQ2NvdW50cnklMkNjaGFwdGVyX3N0YXRlJTJDY2hhcHRlcl90aXRsZSUyQ2RhdGUlMkNjaGFwdGVyX2NvdW50cnklMkNyZWdpb25faWQlMkNzdGFydF9kYXRlX2lzbyUyQ21lbWJlcl9jb3VudCUyQ2NoYXB0ZXJfaWQlMkNmaXJzdF9uYW1lJTJDY2hhcHRlcl9sYW5ndWFnZSUyQ2V2ZW50X3R5cGVfc2x1ZyUyQ2xhc3RfbmFtZSUyQ3BpY3R1cmVfdXJsJTJDY2hhcHRlcl91cmwlMkNhdWRpZW5jZV90aXRsZSUyQ2xvZ29fdXJsJTJDY3JlYXRlZF9kYXRlX3VuaXglMkNkZXNjcmlwdGlvbiUyQ2F2YWlsYWJsZV9tb250aHNfbGFzdF8xMiUyQ3N0YXR1cyUyQ2NpdHkmYXR0cmlidXRlc1RvU25pcHBldD0mcmVzdHJpY3RJbmRpY2VzPWdvb2dsZV9jaGFwdGVyX2luZGV4X3Byb2R1Y3Rpb24lMkNnb29nbGVfZXZlbnRfaW5kZXhfcHJvZHVjdGlvbiUyQ2dvb2dsZV9ibG9ncG9zdHNfaW5kZXhfcHJvZHVjdGlvbiUyQ2dvb2dsZV9uZXdzbGV0dGVyX2luZGV4X3Byb2R1Y3Rpb24lMkNnb29nbGVfZXZlbnRzX3BlcnNvbl9pbmRleF9wcm9kdWN0aW9uJTJDZ29vZ2xlX2V2ZW50c19jb21wYW55X2luZGV4X3Byb2R1Y3Rpb24lMkNnb29nbGVfbmV3c2xldHRlcl9pbmRleF9yZXBsaWNhX3N1YmplY3RfYXNjX3Byb2R1Y3Rpb24lMkNnb29nbGVfbmV3c2xldHRlcl9pbmRleF9yZXBsaWNhX3N1YmplY3RfZGVzY19wcm9kdWN0aW9uJTJDZ29vZ2xlX25ld3NsZXR0ZXJfaW5kZXhfcmVwbGljYV9jaGFwdGVyX3RpdGxlX2FzY19wcm9kdWN0aW9uJTJDZ29vZ2xlX25ld3NsZXR0ZXJfaW5kZXhfcmVwbGljYV9jaGFwdGVyX3RpdGxlX2Rlc2NfcHJvZHVjdGlvbiUyQ2dvb2dsZV9uZXdzbGV0dGVyX2luZGV4X3JlcGxpY2FfYXVkaWVuY2VfdGl0bGVfYXNjX3Byb2R1Y3Rpb24lMkNnb29nbGVfbmV3c2xldHRlcl9pbmRleF9yZXBsaWNhX2F1ZGllbmNlX3RpdGxlX2Rlc2NfcHJvZHVjdGlvbiUyQ2dvb2dsZV9uZXdzbGV0dGVyX2luZGV4X3JlcGxpY2Ffc3RhdHVzX2FzY19wcm9kdWN0aW9uJTJDZ29vZ2xlX25ld3NsZXR0ZXJfaW5kZXhfcmVwbGljYV9zdGF0dXNfZGVzY19wcm9kdWN0aW9uJTJDZ29vZ2xlX25ld3NsZXR0ZXJfaW5kZXhfcmVwbGljYV9kYXRlX2Rlc2NfcHJvZHVjdGlvbiZ2YWxpZFVudGlsPTE3OTQzMjY1MzA=";
  cachedAlgoliaPersonKey = { key: fallbackKey, fetchedAt: now };
  return fallbackKey;
}

/**
 * Searches across speakers/persons.
 * First queries Bevy's global Algolia `google_events_person_index_production` index with the active key.
 * Automatically falls back to Firestore events if the Algolia request fails or key expires.
 */
export async function searchBevyPersons(
  query: string,
  limit = 10,
): Promise<{ success: boolean; hits: BevyPersonSearchResult[]; error?: string }> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return { success: true, hits: [] };

  const appId = "AMJ1KW79KP";
  const apiKey = await resolveBevyAlgoliaPersonKey();

  if (apiKey) {
    try {
      const res = await fetch(
        `https://${appId}-dsn.algolia.net/1/indexes/google_events_person_index_production/query?x-algolia-agent=Algolia%20for%20JavaScript%20(4.1.0)%3B%20Browser`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Algolia-API-Key": apiKey,
            "X-Algolia-Application-Id": appId,
          },
          body: JSON.stringify({
            query: cleanQuery,
            hitsPerPage: limit,
          }),
        },
      );

      if (res.ok) {
        const data = (await res.json()) as { hits?: BevyPersonSearchResult[] };
        if (data.hits && data.hits.length > 0) {
          return { success: true, hits: data.hits };
        }
      }
    } catch {
      // Fall through to Firestore events speaker roster search
    }
  }

  // Robust fallback: search across all existing event speakers & presenter rosters in Firestore
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (projectId && apiKey) {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/events?pageSize=100&key=${apiKey}`;
      const res = await fetch(url, {
        signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6000) : undefined,
      });

      if (res.ok) {
        const data = (await res.json()) as {
          documents?: Array<{
            fields?: Record<
              string,
              {
                arrayValue?: {
                  values?: Array<{
                    mapValue?: { fields?: Record<string, { stringValue?: string; integerValue?: string }> };
                  }>;
                };
              }
            >;
          }>;
        };
        const docs = data.documents || [];
        const q = cleanQuery.toLowerCase();
        const hits: BevyPersonSearchResult[] = [];
        const seenIds = new Set<string>();

        for (const doc of docs) {
          const fields = doc.fields || {};
          for (const role of ["speakers", "mentors", "facilitators", "panelists", "judges", "moderators", "hosts"]) {
            const values = fields[role]?.arrayValue?.values;
            if (Array.isArray(values)) {
              for (const v of values) {
                const map = v.mapValue?.fields || {};
                const fn = map.first_name?.stringValue || "";
                const ln = map.last_name?.stringValue || "";
                const fullName = `${fn} ${ln}`.trim();
                const title = map.title?.stringValue || "";
                const company = map.company?.stringValue || "";
                const rawId = map.id?.integerValue || map.id?.stringValue || "";
                const numId =
                  Number(rawId) ||
                  Math.abs(Array.from(fullName).reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));
                const pic = map.picture?.stringValue || map.picture_url?.stringValue || "";

                if (
                  fullName.toLowerCase().includes(q) ||
                  title.toLowerCase().includes(q) ||
                  company.toLowerCase().includes(q)
                ) {
                  const dedupeKey = `${numId}_${fullName.toLowerCase()}`;
                  if (!seenIds.has(dedupeKey)) {
                    seenIds.add(dedupeKey);
                    hits.push({
                      id: numId,
                      first_name: fn,
                      last_name: ln,
                      title,
                      company,
                      picture_url: pic,
                      objectID: String(numId),
                    });
                    if (hits.length >= limit) break;
                  }
                }
              }
            }
            if (hits.length >= limit) break;
          }
          if (hits.length >= limit) break;
        }

        return { success: true, hits };
      }
    }
  } catch (err) {
    console.error("[searchBevyPersons] Fallback to Firestore events speaker search failed:", err);
  }

  return { success: true, hits: [] };
}
