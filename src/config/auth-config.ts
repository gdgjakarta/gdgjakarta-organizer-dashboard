/**
 * Authentication and Authorization Configuration
 * Dynamic role evaluation is performed directly via Bevy API (/chapter/{chapterId}/team/).
 * Hardcoded and environment email whitelists are disabled.
 */

export async function getAuthorizedOrganizerEmails(): Promise<string[]> {
  return [];
}

export async function isAuthorizedOrganizerEmail(_email?: string | null): Promise<boolean> {
  return false;
}
