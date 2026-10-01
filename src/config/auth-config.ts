/**
 * Authentication and Authorization Configuration
 */

/**
 * Returns the list of all authorized organizer email addresses in lowercase.
 * Derived solely from comma-separated emails in process.env.ORGANIZER_EMAILS.
 */
export function getAuthorizedOrganizerEmails(): string[] {
  const envEmails = (process.env.ORGANIZER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(envEmails));
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
