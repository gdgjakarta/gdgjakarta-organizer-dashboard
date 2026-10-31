"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isCoreTeamOrStaff, isExecutiveOrganizer } from "@/lib/auth-roles";
import {
  getMemberById,
  getUserById,
  importMemberToBevy,
  isBevyUserNotFoundError,
  validateBevyOrganizer,
} from "@/lib/bevy/client";
import { type BevyUser, ChapterRole, type OrganizerValidationResult } from "@/lib/bevy/types";
import { signRoleCookie } from "@/lib/security/session-cookie";
import { splitFullName } from "@/lib/utils";

const AUTH_COOKIE = "auth_token";
const ROLE_COOKIE = "auth_role";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type LoginResult = { success: false; error: string } | { success: true };

export interface UserAuthSyncParams {
  uid: string;
  email: string;
  name?: string;
  avatar?: string;
  token?: string;
  firstName?: string;
  lastName?: string;
  cachedRole?: string;
  cachedChapterRole?: string;
  cachedTeam?: string;
  cachedBevyUserId?: string;
}

/**
 * Validates the authenticated Google user against the Bevy chapter team list.
 */
export async function validateOrganizerAction(
  email: string,
  name?: string,
  firstName?: string,
  lastName?: string,
): Promise<OrganizerValidationResult> {
  return await validateBevyOrganizer(email, name, firstName, lastName);
}

/**
 * Server action to import a new member into Bevy via the GDG Jakarta n8n API webhook.
 */
export async function importMemberAction(params: { firstName: string; lastName?: string; email: string }) {
  return await importMemberToBevy(params);
}

/**
 * Syncs a member from Bevy using their email:
 * Attempts getUserById(email) (with retries to handle any Bevy indexing latency).
 * If found, returns the resolved Bevy User ID.
 */
export async function syncMemberBevyUserAction(
  email: string,
  maxAttempts = 4,
  delayMs = 1500,
): Promise<{ success: boolean; bevyUserId?: string; error?: string }> {
  if (!email) {
    return { success: false, error: "Email is required." };
  }

  const normalizedEmail = email.toLowerCase().trim();
  console.log(`[Sync Member to Bevy] Attempting to resolve Bevy user by email: ${normalizedEmail}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const memberResponse = await getMemberById(normalizedEmail);
      if (memberResponse.data?.id !== undefined && memberResponse.data?.id !== null) {
        const bevyUserId = String(memberResponse.data.id);
        console.log(`[Sync Member to Bevy] Successfully resolved Bevy User ID: ${bevyUserId} on attempt ${attempt}`);
        return { success: true, bevyUserId };
      }

      // Abort retry loop immediately if rate limited (429) or server error (500+)
      if (memberResponse.status === 429) {
        console.warn(`[Sync Member to Bevy] Attempt ${attempt} hit Bevy 429 rate limit. Aborting retries.`);
        return { success: false, error: "Bevy API rate limited (429)." };
      }
      if (typeof memberResponse.status === "number" && memberResponse.status >= 500) {
        console.warn(
          `[Sync Member to Bevy] Attempt ${attempt} hit Bevy server error (${memberResponse.status}). Aborting retries.`,
        );
        return { success: false, error: `Bevy API server error (${memberResponse.status}).` };
      }
    } catch (err) {
      console.warn(`[Sync Member to Bevy] Attempt ${attempt} failed for ${normalizedEmail}:`, err);
    }

    if (attempt < maxAttempts) {
      console.log(`[Sync Member to Bevy] Waiting ${delayMs}ms before attempt ${attempt + 1}...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.warn(
    `[Sync Member to Bevy] Could not resolve Bevy User ID for ${normalizedEmail} after ${maxAttempts} attempts.`,
  );
  return { success: false, error: `Member not found on Bevy after ${maxAttempts} attempts.` };
}

/**
 * Checks whether an individual user is already a Bevy member inside the chapter.
 */
export async function checkBevyMemberStatusAction(
  email: string,
): Promise<{ isBevyMember: boolean; bevyUserId?: string; bevyUser?: BevyUser | null }> {
  if (!email) {
    return { isBevyMember: false };
  }

  const normalizedEmail = email.toLowerCase().trim();
  try {
    const user = await getUserById(normalizedEmail);
    if (user?.id !== undefined && user?.id !== null) {
      return { isBevyMember: true, bevyUserId: String(user.id), bevyUser: user };
    }
  } catch (err) {
    console.warn(`[Check Bevy Member] Error checking status for ${normalizedEmail}:`, err);
  }

  return { isBevyMember: false };
}

/**
 * Checks and syncs an individual member with Bevy:
 * If the user isn't in Bevy, imports them via webhook and retrieves their Bevy ID.
 */
export async function syncSingleMemberToBevyAction(params: {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ success: boolean; bevyUserId?: string; isAlreadyMember?: boolean; error?: string }> {
  const { email, name, firstName, lastName } = params;
  if (!email) {
    return { success: false, error: "Email is required." };
  }

  const normalizedEmail = email.toLowerCase().trim();
  console.log(`[Sync Single Member] Checking Bevy status for: ${normalizedEmail}`);

  // 1. Check if user already exists in Bevy
  try {
    const memberResponse = await getMemberById(normalizedEmail);
    if (memberResponse.data?.id !== undefined && memberResponse.data?.id !== null) {
      const bevyUserId = String(memberResponse.data.id);
      console.log(`[Sync Single Member] User ${normalizedEmail} is already a Bevy member (ID: ${bevyUserId})`);
      return { success: true, bevyUserId, isAlreadyMember: true };
    }

    if (memberResponse.status === 429) {
      return { success: false, error: "Bevy API is currently rate limited (429). Please try again shortly." };
    }
    if (typeof memberResponse.status === "number" && memberResponse.status >= 500) {
      return { success: false, error: `Bevy API server error (${memberResponse.status}).` };
    }

    if (!isBevyUserNotFoundError(memberResponse)) {
      return { success: false, error: `Bevy member lookup returned unexpected status: ${memberResponse.status}.` };
    }
  } catch (err) {
    console.warn(`[Sync Single Member] Error checking user ${normalizedEmail}:`, err);
  }

  // 2. If not registered on Bevy, import member using GDG Jakarta webhook
  console.log(`[Sync Single Member] Member ${normalizedEmail} not in Bevy. Importing via webhook...`);
  const { firstName: splitFirst, lastName: splitLast } = splitFullName(name);
  const safeFirstName = firstName?.trim() || splitFirst.trim() || normalizedEmail.split("@")[0] || "Member";
  const safeLastName = (lastName?.trim() ?? splitLast ?? "").trim() || ".";

  const importResult = await importMemberToBevy({
    firstName: safeFirstName,
    lastName: safeLastName,
    email: normalizedEmail,
  });

  if (!importResult.success) {
    return { success: false, error: importResult.error ?? "Failed to import member to Bevy." };
  }

  // 3. Resolve Bevy User ID with retries
  const syncResult = await syncMemberBevyUserAction(normalizedEmail, 4, 1500);
  if (syncResult.success && syncResult.bevyUserId) {
    return { success: true, bevyUserId: syncResult.bevyUserId, isAlreadyMember: false };
  }

  return {
    success: false,
    error: syncResult.error ?? "Member imported, but Bevy User ID could not be retrieved yet.",
  };
}

/**
 * Cryptographically verifies a Firebase Auth ID Token using Firebase Identity Toolkit REST API.
 * Runs in all JavaScript/Edge/Cloudflare environments via standard fetch.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<{ valid: boolean; email?: string; uid?: string }> {
  if (!idToken) return { valid: false };
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
  if (!apiKey) {
    console.error(
      "[Auth Token Verification] Configuration error: Missing NEXT_PUBLIC_FIREBASE_API_KEY environment variable.",
    );
    return { valid: false };
  }
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      console.warn(`[Auth Token Verification] Verification failed with status ${res.status}`);
      return { valid: false };
    }

    const data = (await res.json()) as { users?: Array<{ localId: string; email?: string }> };
    const user = data.users?.[0];
    if (user?.localId && user?.email) {
      return { valid: true, email: user.email.toLowerCase().trim(), uid: user.localId };
    }
    return { valid: false };
  } catch (err) {
    console.error("[Auth Token Verification] Network error verifying token:", err);
    return { valid: false };
  }
}

/**
 * Handles user post-login sync:
 * 1. Cryptographically validates Firebase ID token.
 * 2. Validates strictly against Authorized Organizer list & exact Bevy Chapter Team via session spoofing.
 * 3. Sets the session cookies (auth_token & auth_role).
 * Note: Firestore member profile persistence is handled on the authenticated browser client
 * to prevent Protobuf/V8 EvalError in Cloudflare Workers.
 */
export async function handleUserPostLoginAction(params: UserAuthSyncParams): Promise<OrganizerValidationResult> {
  try {
    const { uid, email, name, token, firstName, lastName } = params;
    console.log(`[Auth Step 1 - Server] Received handleUserPostLoginAction for UID: ${uid}, Email: ${email}`);

    // Security check: Validate the Firebase ID token cryptographically to prevent email spoofing
    let verifiedEmail = email ? email.toLowerCase().trim() : "";
    let isTokenVerified = false;

    if (token) {
      const tokenVerification = await verifyFirebaseIdToken(token);
      if (tokenVerification.valid && tokenVerification.email) {
        verifiedEmail = tokenVerification.email;
        isTokenVerified = true;
        console.log(`[Auth Step 1.5 - Server] Successfully verified ID token for email: ${verifiedEmail}`);
      } else {
        console.warn(`[Auth Step 1.5 - Server] Token verification failed for email: ${email}`);
      }
    }

    if (!isTokenVerified) {
      console.warn(`[Auth Security] Rejecting session creation for unverified token (email: ${email})`);
      return {
        isValidOrganizer: false,
        role: "member",
        bevyUserId: null,
        chapterRole: "Member",
        chapterRoleType: ChapterRole.MEMBER,
        roleId: null,
        roleTitle: "Member",
        wasImported: false,
      };
    }

    // 1. Validate role directly against Bevy API (/chapter/{chapterId}/team/) using verified email and Bevy User ID
    let validation: OrganizerValidationResult = {
      isValidOrganizer: false,
      role: "Member",
      bevyUserId: null,
      chapterRole: "Member",
    };
    try {
      validation = await validateBevyOrganizer(verifiedEmail, name, firstName, lastName);
    } catch (valErr) {
      console.error("[Auth Step 2 - Server] Validation error:", valErr);
    }

    const isExecutive = isExecutiveOrganizer({
      role: validation.role,
      chapterRole: validation.chapterRole,
      chapterRoleType: validation.chapterRoleType,
      roleId: validation.roleId,
    });
    const isCoreStaff = isCoreTeamOrStaff({
      role: validation.role,
      chapterRole: validation.chapterRole,
      chapterRoleType: validation.chapterRoleType,
      roleId: validation.roleId,
    });

    const isAuthorizedTeam = validation.isValidOrganizer || isExecutive || isCoreStaff;
    const isCheckInStaff = validation.role === "check_in_staff" || validation.roleId === 3;
    const role = isExecutive ? "organizer" : isCheckInStaff ? "check_in_staff" : isCoreStaff ? "core_team" : "member";
    const chapterRole = isAuthorizedTeam
      ? (validation.chapterRole ?? (isExecutive ? "Organizer" : isCheckInStaff ? "Check-in Staff" : "Core Team"))
      : "Member";
    const team = isAuthorizedTeam ? "Core Team" : "Community";
    console.log(
      `[Auth Step 2 - Server] Role resolved for ${verifiedEmail} -> role: "${role}", chapterRole: "${chapterRole}", team: "${team}"`,
    );

    // 2. Set Session Cookie if token verified
    if (token) {
      console.log(
        `[Auth Step 3 - Server] Setting session cookies (auth_token & auth_role="${role}") for ${verifiedEmail}`,
      );
      await setAuthSessionCookie(token, role, true);
    }

    console.log(`[Auth Step 4 - Server] Completed post-login sync for ${verifiedEmail}`);
    // 3. Return ONLY a plain, cleanly serializable object to prevent RSC flight serialization failures
    let resolvedRoleType: ChapterRole = ChapterRole.MEMBER;
    if (isExecutive) {
      resolvedRoleType = ChapterRole.ORGANIZER;
    } else if (isCoreStaff) {
      resolvedRoleType = ChapterRole.CORE_TEAM;
    }

    return {
      isValidOrganizer: isAuthorizedTeam,
      role: role,
      bevyUserId: validation.bevyUserId ? String(validation.bevyUserId) : null,
      chapterRole: chapterRole,
      chapterRoleType: validation.chapterRoleType ?? resolvedRoleType,
      roleId: validation.roleId ?? null,
      roleTitle: validation.roleTitle ?? chapterRole,
      wasImported: Boolean(validation.wasImported),
    };
  } catch (fatalError) {
    console.error("[handleUserPostLoginAction] Unexpected server error during post-login sync:", fatalError);
    return {
      isValidOrganizer: false,
      role: "member",
      bevyUserId: null,
      chapterRole: "Member",
      chapterRoleType: ChapterRole.MEMBER,
      roleId: null,
      roleTitle: "Member",
      wasImported: false,
    };
  }
}

/**
 * Internal helper to set session cookies. Not exported as a public server action.
 */
async function setAuthSessionCookie(token: string, role: string, remember = true): Promise<void> {
  try {
    const cookieStore = await cookies();
    const signedRole = await signRoleCookie(role);

    // Prevent redundant cookie writes if tokens and roles haven't changed.
    // Avoids triggering automatic Next.js router cache invalidation and page RSC re-render!
    const currentToken = cookieStore.get(AUTH_COOKIE)?.value;
    const currentRole = cookieStore.get(ROLE_COOKIE)?.value;
    if (currentToken === token && currentRole === signedRole) {
      return;
    }

    const options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: string;
      maxAge?: number;
    } = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    };
    if (remember) {
      options.maxAge = COOKIE_MAX_AGE;
    }

    console.log(`[Auth Cookie] Setting cookies: auth_token (len=${token.length}), auth_role=${role} (signed)`);
    cookieStore.set(AUTH_COOKIE, token, options);
    cookieStore.set(ROLE_COOKIE, signedRole, options);
  } catch (err) {
    console.error("[Auth Cookie] Error setting session cookies:", err);
  }
}

export interface SessionRestoreResult {
  success: boolean;
  role: string;
  chapterRole: string;
  chapterRoleType?: ChapterRole;
  roleId?: number | null;
  roleTitle?: string;
  bevyUserId?: string | null;
  isValidOrganizer?: boolean;
}

/**
 * Restores HTTP-only auth cookies with server-side Bevy role re-validation
 * to prevent client-side privilege escalation.
 */
export async function restoreSessionCookieAction(token: string, cachedRole?: string): Promise<SessionRestoreResult> {
  try {
    if (!token) {
      return {
        success: false,
        role: "member",
        chapterRole: "Member",
        chapterRoleType: ChapterRole.MEMBER,
        roleId: null,
        roleTitle: "Member",
        bevyUserId: null,
        isValidOrganizer: false,
      };
    }

    const cookieStore = await cookies();
    const existingToken = cookieStore.get(AUTH_COOKIE)?.value;
    const existingRoleCookie = cookieStore.get(ROLE_COOKIE)?.value;

    const { verifyRoleCookie } = await import("@/lib/security/session-cookie");
    const verifiedExistingRole = await verifyRoleCookie(existingRoleCookie);

    // Fast-path ONLY when existing signed role is ALREADY an organizer, core_team, or check_in_staff
    // and matches the cachedRole. Never fast-path a "member" role because members
    // can be assigned as organizers in Bevy at any time!
    if (
      existingToken === token &&
      verifiedExistingRole &&
      (verifiedExistingRole === "organizer" ||
        verifiedExistingRole === "core_team" ||
        verifiedExistingRole === "check_in_staff") &&
      cachedRole?.toLowerCase() === verifiedExistingRole.toLowerCase()
    ) {
      const isExecutive = verifiedExistingRole === "organizer";
      const isStaff = verifiedExistingRole === "check_in_staff";
      return {
        success: true,
        role: verifiedExistingRole,
        chapterRole: isExecutive ? "Organizer" : isStaff ? "Check-in Staff" : "Core Team",
        chapterRoleType: isExecutive ? ChapterRole.ORGANIZER : ChapterRole.CORE_TEAM,
        roleId: isExecutive ? 1 : isStaff ? 3 : 2,
        roleTitle: isExecutive ? "Organizer" : isStaff ? "Check-in Staff" : "Core Team",
        bevyUserId: null,
        isValidOrganizer: true,
      };
    }

    const tokenVerification = await verifyFirebaseIdToken(token);
    if (!tokenVerification.valid || !tokenVerification.email) {
      console.warn("[Auth Restore] Invalid or unverified token supplied to restoreSessionCookieAction");
      return {
        success: false,
        role: "member",
        chapterRole: "Member",
        chapterRoleType: ChapterRole.MEMBER,
        roleId: null,
        roleTitle: "Member",
        bevyUserId: null,
        isValidOrganizer: false,
      };
    }

    const verifiedEmail = tokenVerification.email.toLowerCase().trim();

    // Query Bevy API authoritatively for the user's role
    let validation: OrganizerValidationResult = {
      isValidOrganizer: false,
      role: "member",
      bevyUserId: null,
      chapterRole: "Member",
    };
    try {
      validation = await validateBevyOrganizer(verifiedEmail);
    } catch (valErr) {
      console.error("[Auth Restore] Validation error:", valErr);
    }

    const isExecutive = isExecutiveOrganizer({
      role: validation.role,
      chapterRole: validation.chapterRole,
      chapterRoleType: validation.chapterRoleType,
      roleId: validation.roleId,
    });
    const isCoreStaff = isCoreTeamOrStaff({
      role: validation.role,
      chapterRole: validation.chapterRole,
      chapterRoleType: validation.chapterRoleType,
      roleId: validation.roleId,
    });

    const isAuthorizedTeam = validation.isValidOrganizer || isExecutive || isCoreStaff;
    const isCheckInStaff = validation.role === "check_in_staff" || validation.roleId === 3;
    const role = isExecutive ? "organizer" : isCheckInStaff ? "check_in_staff" : isCoreStaff ? "core_team" : "member";
    const chapterRole = isAuthorizedTeam
      ? (validation.chapterRole ?? (isExecutive ? "Organizer" : isCheckInStaff ? "Check-in Staff" : "Core Team"))
      : "Member";

    let resolvedRoleType: ChapterRole = ChapterRole.MEMBER;
    if (isExecutive) {
      resolvedRoleType = ChapterRole.ORGANIZER;
    } else if (isCoreStaff) {
      resolvedRoleType = ChapterRole.CORE_TEAM;
    }

    await setAuthSessionCookie(token, role, true);
    return {
      success: true,
      role,
      chapterRole,
      chapterRoleType: validation.chapterRoleType ?? resolvedRoleType,
      roleId: validation.roleId ?? (isExecutive ? 1 : isCheckInStaff ? 3 : isCoreStaff ? 2 : null),
      roleTitle: validation.roleTitle ?? chapterRole,
      bevyUserId: validation.bevyUserId ? String(validation.bevyUserId) : null,
      isValidOrganizer: isAuthorizedTeam,
    };
  } catch (err) {
    console.error("[Auth Restore] Failed to restore session cookie:", err);
    return {
      success: false,
      role: "member",
      chapterRole: "Member",
      chapterRoleType: ChapterRole.MEMBER,
      roleId: null,
      roleTitle: "Member",
      bevyUserId: null,
      isValidOrganizer: false,
    };
  }
}

/**
 * Forces a fresh role validation against Bevy API and updates the session cookies.
 * Used by the "Clear Cache & Sync Role" feature in the user profile menu.
 */
export async function refreshUserRoleAction(params: {
  uid: string;
  email: string;
  token?: string;
  displayName?: string;
}): Promise<{
  success: boolean;
  role: string;
  chapterRole: string;
  bevyUserId: string | null;
  isValidOrganizer: boolean;
  roleTitle: string;
  message: string;
}> {
  try {
    const { email, token, displayName } = params;
    if (!email) {
      return {
        success: false,
        role: "member",
        chapterRole: "Member",
        bevyUserId: null,
        isValidOrganizer: false,
        roleTitle: "Member",
        message: "Email is required.",
      };
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[Clear Cache] Forcing fresh Bevy API evaluation for: ${normalizedEmail}...`);

    let verifiedEmail = normalizedEmail;
    if (token) {
      const tokenVerification = await verifyFirebaseIdToken(token);
      if (tokenVerification.valid && tokenVerification.email) {
        verifiedEmail = tokenVerification.email.toLowerCase().trim();
      }
    }

    const { firstName, lastName } = splitFullName(displayName);
    const validation = await validateBevyOrganizer(
      verifiedEmail,
      displayName,
      firstName.trim() ? firstName : undefined,
      lastName.trim() ? lastName : undefined,
    );

    const isExecutive = isExecutiveOrganizer({
      role: validation.role,
      chapterRole: validation.chapterRole,
      chapterRoleType: validation.chapterRoleType,
      roleId: validation.roleId,
    });
    const isCoreStaff = isCoreTeamOrStaff({
      role: validation.role,
      chapterRole: validation.chapterRole,
      chapterRoleType: validation.chapterRoleType,
      roleId: validation.roleId,
    });
    const isAuthorizedTeam = isExecutive || isCoreStaff;
    const isCheckInStaff = validation.role === "check_in_staff" || validation.roleId === 3;

    let role = "member";
    if (isExecutive) {
      role = "organizer";
    } else if (isCheckInStaff) {
      role = "check_in_staff";
    } else if (isCoreStaff) {
      role = "core_team";
    }

    let defaultChapterRole = "Member";
    if (isExecutive) {
      defaultChapterRole = "Organizer";
    } else if (isCheckInStaff) {
      defaultChapterRole = "Check-in Staff";
    } else if (isCoreStaff) {
      defaultChapterRole = "Core Team";
    }
    const chapterRole = validation.chapterRole ?? defaultChapterRole;

    if (token) {
      console.log(`[Clear Cache] Updating session cookies with fresh role "${role}" for ${verifiedEmail}`);
      await setAuthSessionCookie(token, role, true);
    }

    return {
      success: true,
      role,
      chapterRole,
      bevyUserId: validation.bevyUserId ? String(validation.bevyUserId) : null,
      isValidOrganizer: isAuthorizedTeam,
      roleTitle: validation.roleTitle ?? chapterRole,
      message: `Permissions updated: ${chapterRole}`,
    };
  } catch (error) {
    console.error("[Clear Cache] Error during manual refresh:", error);
    return {
      success: false,
      role: "member",
      chapterRole: "Member",
      bevyUserId: null,
      isValidOrganizer: false,
      roleTitle: "Member",
      message: error instanceof Error ? error.message : "Failed to refresh permissions.",
    };
  }
}

/**
 * Clears the auth_token cookie and all related session cookies without redirecting.
 */
export async function clearAuthSessionCookie(): Promise<void> {
  try {
    console.log("[Auth Cookie] Clearing all auth and session cookies");
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE);
    cookieStore.delete(ROLE_COOKIE);
    cookieStore.delete("bevy_session");
    cookieStore.delete("auth_provider");
    cookieStore.delete("auth_email");
  } catch (err) {
    console.error("[Auth Cookie] Error clearing auth cookies:", err);
  }
}

/**
 * Direct password login action - disabled for security.
 * GDG Jakarta uses Google Sign-In with Firebase Authentication.
 */
export async function loginAction(email: string, _password: string, _remember: boolean): Promise<LoginResult> {
  console.warn(`[Auth Security] Direct password login attempt rejected for: ${email}`);
  return { success: false, error: "Password authentication is disabled. Please sign in using Google." };
}

/**
 * Logs the user out by clearing the auth cookie and redirecting to unified login.
 */
export async function logoutAction(): Promise<void> {
  console.log("[Auth Action] Logging out user and redirecting to /auth/login");
  await clearAuthSessionCookie();
  redirect("/auth/login");
}
