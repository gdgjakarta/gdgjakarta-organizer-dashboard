const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailRecipientInput = string | string[] | null | undefined;

/**
 * Splits a string (comma, semicolon, or whitespace separated) or string array
 * into a deduplicated, lowercased list of trimmed email tokens.
 */
export function parseEmailRecipients(input: EmailRecipientInput): string[] {
  if (!input) return [];
  const rawList = Array.isArray(input) ? input : [input];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of rawList) {
    if (typeof entry !== "string") continue;
    for (const part of entry.split(/[,;\s]+/)) {
      const cleaned = part.trim().toLowerCase();
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        result.push(cleaned);
      }
    }
  }

  return result;
}

/**
 * Validates and normalizes one or more email addresses.
 * Returns the deduplicated list, any invalid tokens, and a comma-separated string
 * suitable for SMTP / n8n emailSend (toEmail, ccEmail, bccEmail).
 */
export function validateEmailRecipients(
  input: EmailRecipientInput,
  options?: { required?: boolean; label?: string },
): {
  valid: boolean;
  emails: string[];
  formatted: string;
  invalidEmails: string[];
  error?: string;
} {
  const label = options?.label || "Email";
  const emails = parseEmailRecipients(input);

  if (emails.length === 0) {
    if (options?.required) {
      return {
        valid: false,
        emails: [],
        formatted: "",
        invalidEmails: [],
        error: `At least one valid ${label.toLowerCase()} address is required.`,
      };
    }
    return { valid: true, emails: [], formatted: "", invalidEmails: [] };
  }

  const invalidEmails = emails.filter((e) => !EMAIL_REGEX.test(e));
  if (invalidEmails.length > 0) {
    return {
      valid: false,
      emails,
      formatted: emails.join(", "),
      invalidEmails,
      error: `Invalid ${label.toLowerCase()} address${invalidEmails.length > 1 ? "es" : ""}: ${invalidEmails.join(", ")}`,
    };
  }

  return {
    valid: true,
    emails,
    formatted: emails.join(", "),
    invalidEmails: [],
  };
}
