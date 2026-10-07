"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getUserById, importMemberToBevy, validateBevyOrganizer } from "@/lib/bevy/client";
import { type BevyUser, ChapterRole, type OrganizerValidationResult } from "@/lib/bevy/types";
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
export async function importMemberAction(params: { firstName: string; lastName: string; email: string }) {
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
      const user = await getUserById(normalizedEmail);
      if (user?.id !== undefined && user?.id !== null) {
        const bevyUserId = String(user.id);
        console.log(`[Sync Member to Bevy] Successfully resolved Bevy User ID: ${bevyUserId} on attempt ${attempt}`);
        return { success: true, bevyUserId };
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
    const existingUser = await getUserById(normalizedEmail);
    if (existingUser?.id !== undefined && existingUser?.id !== null) {
      const bevyUserId = String(existingUser.id);
      console.log(`[Sync Single Member] User ${normalizedEmail} is already a Bevy member (ID: ${bevyUserId})`);
      return { success: true, bevyUserId, isAlreadyMember: true };
    }
  } catch (err) {
    console.warn(`[Sync Single Member] Error checking user ${normalizedEmail}:`, err);
  }

  // 2. If not registered on Bevy, import member using GDG Jakarta webhook
  console.log(`[Sync Single Member] Member ${normalizedEmail} not in Bevy. Importing via webhook...`);
  const { firstName: splitFirst, lastName: splitLast } = splitFullName(name);
  const safeFirstName = firstName?.trim() || splitFirst.trim() || normalizedEmail.split("@")[0] || "Member";
  const safeLastName = (lastName?.trim() ?? splitLast ?? "").trim();

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
async function verifyFirebaseIdToken(idToken: string): Promise<{ valid: boolean; email?: string; uid?: string }> {
  if (!idToken) return { valid: false };
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCVk8ECyA8Lqd7KNqdnItxYUu9jdFzoohU";
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

    // 1. Validate role against authorized whitelist and exact Bevy Chapter Team using the verified email
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

    const isOrganizer = validation.isValidOrganizer;
    const role = isOrganizer ? "organizer" : "member";
    const chapterRole = isOrganizer ? (validation.chapterRole ?? "Organizer") : "Member";
    const team = isOrganizer ? "Core Team" : "Community";
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
    return {
      isValidOrganizer: isOrganizer,
      role: role,
      bevyUserId: validation.bevyUserId ? String(validation.bevyUserId) : null,
      chapterRole: chapterRole,
      chapterRoleType: validation.chapterRoleType ?? (isOrganizer ? ChapterRole.ORGANIZER : ChapterRole.MEMBER),
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

    console.log(`[Auth Cookie] Setting cookies: auth_token (len=${token.length}), auth_role=${role}`);
    cookieStore.set(AUTH_COOKIE, token, options);
    cookieStore.set(ROLE_COOKIE, role, options);
  } catch (err) {
    console.error("[Auth Cookie] Error setting session cookies:", err);
  }
}

/**
 * Clears the auth_token cookie without redirecting.
 */
export async function clearAuthSessionCookie(): Promise<void> {
  try {
    console.log("[Auth Cookie] Clearing auth_token and auth_role cookies");
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE);
    cookieStore.delete(ROLE_COOKIE);
  } catch (err) {
    console.error("[Auth Cookie] Error clearing auth cookies:", err);
  }
}

/**
 * Direct password login action - disabled for security.
 * GDG Jakarta uses Google Sign-In with Firebase Authentication.
 */
export async function loginAction(email: string, password: string, remember: boolean): Promise<LoginResult> {
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
