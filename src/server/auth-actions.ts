"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE = "auth_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type LoginResult = { success: false; error: string } | { success: true };

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

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: remember ? COOKIE_MAX_AGE : undefined, // session cookie if not remembered
  });

  return { success: true };
}

/**
 * Logs the user out by clearing the auth cookie and redirecting to login.
 */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect("/auth/organizer/login");
}
