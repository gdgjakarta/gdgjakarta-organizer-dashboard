"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { validateBevyOrganizer } from "@/lib/bevy/client";
import type { OrganizerValidationResult } from "@/lib/bevy/types";

const AUTH_COOKIE = "auth_token";
const ROLE_COOKIE = "auth_role";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type LoginResult = { success: false; error: string } | { success: true };

/**
 * Validates the authenticated Google user against the Bevy chapter team list.
 */
export async function validateOrganizerAction(email: string): Promise<OrganizerValidationResult> {
  return await validateBevyOrganizer(email);
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
 * Logs the user out by clearing the auth cookie and redirecting to login.
 */
export async function logoutAction(): Promise<void> {
  await clearAuthSessionCookie();
  redirect("/auth/organizer/login");
}
