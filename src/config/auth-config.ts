import { getOrganizerEmailsFromRemoteConfig } from "./remote-config";

/**
 * Authentication and Authorization Configuration
 */

/**
 * Returns the list of all authorized organizer email addresses in lowercase.
 * Dynamically resolved from Firebase Remote Config (`cfg_organizer_emails`) in JSON format:
 * ["email1@example.com", "email2@example.com"]
 * with fallback to process.env.ORGANIZER_EMAILS.
 */
export async function getAuthorizedOrganizerEmails(): Promise<string[]> {
  return await getOrganizerEmailsFromRemoteConfig();
}

/**
 * Strictly checks whether an email belongs to an authorized organizer.
 */
export async function isAuthorizedOrganizerEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const authorized = await getAuthorizedOrganizerEmails();
  return authorized.includes(normalized);
}
