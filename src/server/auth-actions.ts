"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { validateBevyOrganizer } from "@/lib/bevy/client";
import type { OrganizerValidationResult } from "@/lib/bevy/types";
import { getFirestoreMemberById, saveFirestoreMember } from "@/lib/firestore/client";
import type { FirestoreMember } from "@/lib/firestore/types";

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
}

/**
 * Validates the authenticated Google user against the Bevy chapter team list.
 */
export async function validateOrganizerAction(email: string, name?: string): Promise<OrganizerValidationResult> {
  return await validateBevyOrganizer(email, name);
}

/**
 * Handles user post-login sync:
 * 1. Validates strictly against Authorized Organizer list & exact Bevy Chapter Team.
 * 2. Synchronizes profile with Firestore `members` collection (remediating any legacy false-organizer flags).
 * 3. Sets the session cookies (auth_token & auth_role).
 */
export async function handleUserPostLoginAction(params: UserAuthSyncParams): Promise<OrganizerValidationResult> {
  const { uid, email, name, avatar, token } = params;
  console.log(
    `[Auth Step 1 - Server] Received handleUserPostLoginAction for UID: ${uid}, Email: ${email}, Name: ${name ?? "N/A"}`,
  );

  let existingMember: FirestoreMember | null = null;
  try {
    existingMember = await getFirestoreMemberById(uid);
    console.log(
      `[Auth Step 2 - Server] Existing Firestore record for ${email}:`,
      existingMember ? { role: existingMember.role, team: existingMember.team } : "None (New User)",
    );
  } catch (err) {
    console.error("[Auth Step 2 - Server] Error fetching member before validation:", err);
  }

  // 1. Validate role against authorized whitelist and exact Bevy Chapter Team
  const validation = await validateBevyOrganizer(email, name);
  const isOrganizer = validation.isValidOrganizer;
  const role = isOrganizer ? "organizer" : "member";
  const chapterRole = isOrganizer ? validation.chapterRole || "Organizer" : "Member";
  const team = isOrganizer ? "Core Team" : "Community";
  console.log(
    `[Auth Step 3 - Server] Role resolved for ${email} -> role: "${role}", chapterRole: "${chapterRole}", team: "${team}"`,
  );

  // 2. Sync to Firestore members
  try {
    const now = new Date().toISOString();

    const memberData: FirestoreMember = {
      id: uid,
      uid,
      bevy_user_id: validation.bevyUserId ?? existingMember?.bevy_user_id ?? null,
      name: name ?? existingMember?.name ?? email.split("@")[0] ?? "Community Member",
      email: email,
      avatar_url: avatar ?? existingMember?.avatar_url,
      role: role,
      chapter_role: chapterRole,
      team: team,
      status: "Active",
      joined_date: existingMember?.joined_date ?? now,
      events_registered_count: existingMember?.events_registered_count ?? 0,
      events_attended_count: existingMember?.events_attended_count ?? 0,
      last_active: now,
      updated_at: now,
    };

    await saveFirestoreMember(memberData);
    console.log(`[Auth Step 4 - Server] Successfully synchronized member data in Firestore for ${email}`);
  } catch (err) {
    console.error("[Auth Step 4 - Server] Member sync on login error:", err);
  }

  // 3. Set Session Cookie if token provided
  if (token) {
    console.log(`[Auth Step 5 - Server] Setting session cookies (auth_token & auth_role="${role}") for ${email}`);
    await setAuthSessionCookie(token, role, true);
  }

  console.log(`[Auth Step 6 - Server] Completed post-login sync for ${email}. Returning validation:`, {
    isValidOrganizer: validation.isValidOrganizer,
    role: validation.role,
  });
  return validation;
}

/**
 * Sets the auth_token cookie after successful authentication (e.g. Firebase Google Sign-In).
 */
export async function setAuthSessionCookie(token: string, role: string, remember = true): Promise<void> {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: remember ? COOKIE_MAX_AGE : undefined,
  };

  console.log(`[Auth Cookie] Setting cookies: auth_token (len=${token.length}), auth_role=${role}`);
  cookieStore.set(AUTH_COOKIE, token, options);
  cookieStore.set(ROLE_COOKIE, role, options);
}

/**
 * Clears the auth_token cookie without redirecting.
 */
export async function clearAuthSessionCookie(): Promise<void> {
  console.log("[Auth Cookie] Clearing auth_token and auth_role cookies");
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  cookieStore.delete(ROLE_COOKIE);
}

/**
 * Authenticates the user and sets the auth_token cookie.
 *
 * Replace the credential check below with your real backend / API call.
 * The cookie value should be an opaque session token or JWT from your server.
 */
export async function loginAction(email: string, password: string, remember: boolean): Promise<LoginResult> {
  console.log(`[Auth Demo] loginAction called for email: ${email}`);
  // ── Demo auth ─────────────────────────────────────────────────────────────
  const isDemoLogin = email === "admin@gdgjakarta.com" && password === "password";
  if (!isDemoLogin) {
    console.warn(`[Auth Demo] Invalid credentials for ${email}`);
    return { success: false, error: "Invalid email or password." };
  }
  const token = `demo-auth-token-${Date.now()}`;
  // ── End demo auth ──────────────────────────────────────────────────────────

  await setAuthSessionCookie(token, "organizer", remember);
  console.log(`[Auth Demo] Demo login success for ${email}`);

  return { success: true };
}

/**
 * Logs the user out by clearing the auth cookie and redirecting to unified login.
 */
export async function logoutAction(): Promise<void> {
  console.log("[Auth Action] Logging out user and redirecting to /auth/login");
  await clearAuthSessionCookie();
  redirect("/auth/login");
}
