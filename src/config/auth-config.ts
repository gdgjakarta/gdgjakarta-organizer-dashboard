/**
 * Authentication and Authorization Configuration
 */

// Known organizer email addresses (default list)
const DEFAULT_ORGANIZER_EMAILS: string[] = ["rizfirsy@gmail.com", "admin@gdgjakarta.com", "rizkyfirman.work@gmail.com"];

/**
 * Returns the list of all authorized organizer email addresses in lowercase.
 * Supports comma-separated emails from process.env.ORGANIZER_EMAILS.
 */
export function getAuthorizedOrganizerEmails(): string[] {
  const envEmails = (process.env.ORGANIZER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const set = new Set([...DEFAULT_ORGANIZER_EMAILS.map((e) => e.toLowerCase()), ...envEmails]);
  return Array.from(set);
}

/**
 * Strictly checks whether an email belongs to an authorized organizer.
 */
export function isAuthorizedOrganizerEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const authorized = getAuthorizedOrganizerEmails();
  return authorized.includes(normalized);
}
