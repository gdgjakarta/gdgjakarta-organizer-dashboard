import type { CustomQuestion, QuestionValidationType } from "@/lib/firestore/types";

/**
 * Common consumer/personal webmail domains disallowed for Work Email validation.
 */
export const DISALLOWED_PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.id",
  "yahoo.co.uk",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "hotmail.co.id",
  "outlook.com",
  "outlook.co.id",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "zoho.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "gmx.com",
  "yandex.com",
  "tutanota.com",
  "tutamail.com",
]);

export interface ValidationTypeOption {
  value: QuestionValidationType;
  label: string;
  description: string;
}

export const VALIDATION_TYPE_OPTIONS: ValidationTypeOption[] = [
  { value: "none", label: "None / Any Text", description: "No specific format validation" },
  { value: "isEmail", label: "Email Address", description: "Standard email format (e.g. name@domain.com)" },
  {
    value: "isWorkEmail",
    label: "Work / Corporate Email",
    description: "Requires company or institutional domain (no @gmail, etc.)",
  },
  { value: "isUrl", label: "Web URL", description: "Valid http:// or https:// website address" },
  { value: "isGithubUrl", label: "GitHub Profile / Repo", description: "e.g. https://github.com/username" },
  {
    value: "isLinkedInProfileUrl",
    label: "LinkedIn Profile URL",
    description: "e.g. https://linkedin.com/in/username",
  },
  {
    value: "isWhatsappNumber",
    label: "WhatsApp Number (62...)",
    description: "Must start with 62 (digits only, no '+' or leading '0')",
  },
  { value: "isNumber", label: "Number", description: "Numeric digits only (integer or decimal)" },
  { value: "customRegex", label: "Custom Regex", description: "Validate against custom regular expression pattern" },
];

/**
 * Checks if a string is a valid email format.
 */
export function isValidEmail(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Checks if a string is a work/corporate email (not personal webmail).
 */
export function isValidWorkEmail(val: string): {
  isValid: boolean;
  reason?: "invalid_format" | "personal_domain";
  domain?: string;
} {
  const trimmed = val.trim();
  if (!isValidEmail(trimmed)) {
    return { isValid: false, reason: "invalid_format" };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { isValid: false, reason: "invalid_format" };
  }

  const domain = parts[1].toLowerCase().trim();
  if (DISALLOWED_PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return { isValid: false, reason: "personal_domain", domain };
  }

  return { isValid: true, domain };
}

/**
 * Checks if a string is a valid HTTP or HTTPS URL.
 */
export function isValidUrl(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Checks if a string is a valid GitHub profile or repo URL.
 */
export function isValidGithubUrl(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  const githubRegex = /^https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+(?:\/.*)?$/i;
  return githubRegex.test(trimmed);
}

/**
 * Checks if a string is a valid LinkedIn profile or company URL.
 */
export function isValidLinkedInUrl(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  const linkedInRegex = /^https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company|school)\/[A-Za-z0-9_.-]+(?:\/.*)?$/i;
  return linkedInRegex.test(trimmed);
}

/**
 * Checks if a string is a valid WhatsApp phone number starting with 62.
 * Rule: must start with 62, digits only, no '+' and no leading '0'.
 */
export function isValidWhatsappNumber(val: string): {
  isValid: boolean;
  hint?: "starts_with_plus" | "starts_with_zero" | "invalid_digits";
} {
  const trimmed = val.trim();
  if (!trimmed) return { isValid: false };

  if (trimmed.startsWith("+")) {
    return { isValid: false, hint: "starts_with_plus" };
  }
  if (trimmed.startsWith("0")) {
    return { isValid: false, hint: "starts_with_zero" };
  }

  // Must start with 62, digits only, length between 10 and 16 digits
  const waRegex = /^62\d{8,14}$/;
  if (!waRegex.test(trimmed)) {
    return { isValid: false, hint: "invalid_digits" };
  }

  return { isValid: true };
}

/**
 * Checks if a string is a valid numeric value.
 */
export function isValidNumber(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  const numRegex = /^-?\d+(\.\d+)?$/;
  return numRegex.test(trimmed);
}

/**
 * Validates a single question answer against its configuration.
 * Returns { isValid: true } or { isValid: false, error: "..." }.
 */
export function validateQuestionAnswer(question: CustomQuestion, value: unknown): { isValid: boolean; error?: string } {
  const customError = question.custom_error_message?.trim();

  // 1. Required Check
  if (question.required) {
    if (value === undefined || value === null) {
      return { isValid: false, error: customError || `${question.label} is required.` };
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { isValid: false, error: customError || `Please select at least one option for "${question.label}".` };
      }
    } else if (typeof value === "string") {
      if (!value.trim()) {
        return { isValid: false, error: customError || `${question.label} is required.` };
      }
    }
  }

  // If empty and not required, skip format checks
  if (value === undefined || value === null) {
    return { isValid: true };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed && !question.required) {
      return { isValid: true };
    }

    // 2. Minimum Length Constraint
    if (question.min_length !== undefined && question.min_length > 0) {
      if (trimmed.length < question.min_length) {
        return {
          isValid: false,
          error: customError || `Must be at least ${question.min_length} characters (currently ${trimmed.length}).`,
        };
      }
    }

    // 3. Maximum Length Constraint
    if (question.max_length !== undefined && question.max_length > 0) {
      if (trimmed.length > question.max_length) {
        return {
          isValid: false,
          error: customError || `Must not exceed ${question.max_length} characters (currently ${trimmed.length}).`,
        };
      }
    }

    // 4. Validation Type Rules
    const valType = question.validation_type;
    if (valType && valType !== "none" && trimmed.length > 0) {
      switch (valType) {
        case "isEmail": {
          if (!isValidEmail(trimmed)) {
            return {
              isValid: false,
              error: customError || "Please enter a valid email address (e.g. name@domain.com).",
            };
          }
          break;
        }

        case "isWorkEmail": {
          const check = isValidWorkEmail(trimmed);
          if (!check.isValid) {
            if (check.reason === "personal_domain") {
              return {
                isValid: false,
                error:
                  customError ||
                  `Please use your company or institutional work email (@${check.domain} is a personal webmail).`,
              };
            }
            return {
              isValid: false,
              error: customError || "Please enter a valid corporate or work email address.",
            };
          }
          break;
        }

        case "isUrl": {
          if (!isValidUrl(trimmed)) {
            return {
              isValid: false,
              error: customError || "Please enter a valid website URL starting with http:// or https://.",
            };
          }
          break;
        }

        case "isGithubUrl": {
          if (!isValidGithubUrl(trimmed)) {
            return {
              isValid: false,
              error:
                customError || "Please enter a valid GitHub profile or repo URL (e.g. https://github.com/username).",
            };
          }
          break;
        }

        case "isLinkedInProfileUrl": {
          if (!isValidLinkedInUrl(trimmed)) {
            return {
              isValid: false,
              error:
                customError || "Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/username).",
            };
          }
          break;
        }

        case "isWhatsappNumber": {
          const waCheck = isValidWhatsappNumber(trimmed);
          if (!waCheck.isValid) {
            if (waCheck.hint === "starts_with_plus") {
              return {
                isValid: false,
                error: customError || "WhatsApp number must start with 62 without '+' (e.g. 6281234567890).",
              };
            }
            if (waCheck.hint === "starts_with_zero") {
              return {
                isValid: false,
                error: customError || "WhatsApp number must start with 62 instead of 0 (e.g. 6281234567890).",
              };
            }
            return {
              isValid: false,
              error: customError || "WhatsApp number must start with 62 and contain only digits (e.g. 6281234567890).",
            };
          }
          break;
        }

        case "isNumber": {
          if (!isValidNumber(trimmed)) {
            return {
              isValid: false,
              error: customError || "Please enter a valid numeric value.",
            };
          }
          break;
        }

        case "customRegex": {
          if (question.regex_pattern?.trim()) {
            try {
              const reg = new RegExp(question.regex_pattern.trim());
              if (!reg.test(trimmed)) {
                return {
                  isValid: false,
                  error: customError || "Input does not match the required format.",
                };
              }
            } catch {
              // If invalid regex pattern was stored, skip breaking submission
              console.warn("[Validator] Invalid regular expression pattern:", question.regex_pattern);
            }
          }
          break;
        }
      }
    }
  }

  return { isValid: true };
}
