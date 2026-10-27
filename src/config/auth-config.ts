/**
 * Authentication and Authorization Configuration
 * Dynamic role evaluation is performed directly via Bevy API (/chapter/{chapterId}/team/).
 * Hardcoded email whitelists are removed in accordance with KawalEvent architecture.
 */

export async function getAuthorizedOrganizerEmails(): Promise<string[]> {
  const envEmails = process.env.ORGANIZER_EMAILS || "";
  return envEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAuthorizedOrganizerEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const allowed = await getAuthorizedOrganizerEmails();
  return allowed.includes(normalized);
}
