/**
 * Authentication and Authorization Configuration
 * Dynamic role evaluation is performed directly via Bevy API (/chapter/{chapterId}/team/).
 * Hardcoded email whitelists are removed in accordance with KawalEvent architecture.
 */

export async function getAuthorizedOrganizerEmails(): Promise<string[]> {
  return [];
}

export async function isAuthorizedOrganizerEmail(email?: string | null): Promise<boolean> {
  return false;
}
