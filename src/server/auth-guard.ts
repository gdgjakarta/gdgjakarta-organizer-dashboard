import { cookies } from "next/headers";

import { hasTeamOperationalAccess, isExecutiveOrganizer } from "@/lib/auth-roles";
import { verifyRoleCookie } from "@/lib/security/session-cookie";

/**
 * Returns the cryptographically verified role from the auth_role cookie.
 * Returns null if the cookie is missing, forged, or fails HMAC verification.
 */
export async function getVerifiedSessionRole(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const signedRole = cookieStore.get("auth_role")?.value;
    return await verifyRoleCookie(signedRole);
  } catch {
    return null;
  }
}

/**
 * Verifies that the caller has an active authenticated session with organizer or team access
 * (organizer, core_team, googler, etc.) and valid HMAC signed role.
 */
export async function isAuthorizedOrganizerSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return false;
    const signedRole = cookieStore.get("auth_role")?.value;
    const verifiedRole = await verifyRoleCookie(signedRole);
    return Boolean(verifiedRole && hasTeamOperationalAccess(verifiedRole));
  } catch {
    return false;
  }
}

/**
 * Verifies that the caller has an active executive organizer session
 * (Lead Organizer, Co-Organizer, Googler) and valid HMAC signed role.
 */
export async function isAuthorizedExecutiveOrganizerSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return false;
    const signedRole = cookieStore.get("auth_role")?.value;
    const verifiedRole = await verifyRoleCookie(signedRole);
    return Boolean(verifiedRole && isExecutiveOrganizer(verifiedRole));
  } catch {
    return false;
  }
}

/**
 * Extracts the authenticated user's ID, display name, and email from the session cookie.
 */
export async function getAuthenticatedSessionUser(): Promise<{
  id: string;
  name: string;
  email: string;
} | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token?.includes(".")) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const payload = JSON.parse(jsonStr) as {
      user_id?: string;
      sub?: string;
      name?: string;
      email?: string;
    };
    const id = payload.user_id || payload.sub || "organizer";
    const email = payload.email ? payload.email.toLowerCase().trim() : "";
    let name = payload.name?.trim() || "";
    if (!name && email) {
      name = email.split("@")[0];
    }
    return { id, name: name || "Event Organizer", email };
  } catch {
    return null;
  }
}

/**
 * Extracts the authenticated user email from the auth_token cookie.
 */
export async function getAuthenticatedSessionEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token?.includes(".")) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const payload = JSON.parse(jsonStr) as { email?: string };
    return payload.email ? payload.email.toLowerCase().trim() : null;
  } catch {
    return null;
  }
}

/**
 * Verifies that the caller is either an active authorized organizer,
 * or is an authenticated user acting strictly on their own email address.
 * Prevents phishing relay and open email relay exploitation.
 */
export async function isAuthorizedOrganizerOrSelfEmail(targetEmail: string | undefined | null): Promise<boolean> {
  if (await isAuthorizedOrganizerSession()) {
    return true;
  }
  if (!targetEmail) return false;
  const sessionEmail = await getAuthenticatedSessionEmail();
  return Boolean(sessionEmail && sessionEmail === targetEmail.toLowerCase().trim());
}
