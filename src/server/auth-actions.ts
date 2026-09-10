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
export async function validateOrganizerAction(email: string): Promise<OrganizerValidationResult> {
  return await validateBevyOrganizer(email);
}

/**
 * Handles user post-login sync:
 * 1. Validates whether the user is an organizer on Bevy.
 * 2. Synchronizes their profile with the Firestore `members` collection.
 * 3. Sets the appropriate session cookie based on role.
 */
export async function handleUserPostLoginAction(params: UserAuthSyncParams): Promise<OrganizerValidationResult> {
  const { uid, email, name, avatar, token } = params;

  // 1. Validate role against Bevy Chapter Team
  const validation = await validateBevyOrganizer(email);
  const role = validation.isValidOrganizer ? "organizer" : "member";

  // 2. Sync to Firestore members
  try {
    const existingMember = await getFirestoreMemberById(uid);
    const now = new Date().toISOString();

    const memberData: FirestoreMember = {
      id: uid,
      uid,
      bevy_user_id: validation.bevyUserId,
      name: name || existingMember?.name || email.split("@")[0] || "Community Member",
      email: email,
      avatar_url: avatar || existingMember?.avatar_url,
      role: validation.isValidOrganizer ? validation.chapterRole || "organizer" : "member",
      chapter_role: validation.chapterRole || (validation.isValidOrganizer ? "Organizer" : "Member"),
      team: validation.isValidOrganizer ? "Core Team" : "Community",
      status: "Active",
      joined_date: existingMember?.joined_date || now,
      events_registered_count: existingMember?.events_registered_count || 0,
      events_attended_count: existingMember?.events_attended_count || 0,
      last_active: now,
      updated_at: now,
    };

    await saveFirestoreMember(memberData);
  } catch (err) {
    console.error("[Firestore] Member sync on login error:", err);
  }

  // 3. Set Session Cookie if token provided
  if (token) {
    await setAuthSessionCookie(token, role, true);
  }

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

  cookieStore.set(AUTH_COOKIE, token, options);
  cookieStore.set(ROLE_COOKIE, role, options);
}

/**
 * Clears the auth_token cookie without redirecting.
 */
export async function clearAuthSessionCookie(): Promise<void> {
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
  // ── Demo auth ─────────────────────────────────────────────────────────────
  const isDemoLogin = email === "admin@gdgjakarta.com" && password === "password";
  if (!isDemoLogin) {
    return { success: false, error: "Invalid email or password." };
  }
  const token = `demo-auth-token-${Date.now()}`;
  // ── End demo auth ──────────────────────────────────────────────────────────

  await setAuthSessionCookie(token, "organizer", remember);

  return { success: true };
}

/**
 * Logs the user out by clearing the auth cookie and redirecting to unified login.
 */
export async function logoutAction(): Promise<void> {
  await clearAuthSessionCookie();
  redirect("/auth/login");
}
