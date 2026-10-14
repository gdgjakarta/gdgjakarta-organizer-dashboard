import type { CheckboxRequirementRule, CustomQuestion, QuestionValidationType } from "@/lib/firestore/types";

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

export interface CheckboxRequirementOption {
  value: CheckboxRequirementRule;
  label: string;
  description: string;
}

export const CHECKBOX_REQUIREMENT_OPTIONS: CheckboxRequirementOption[] = [
  {
    value: "all",
    label: "All Checkboxes Required",
    description: "Must check all options (ideal for Terms & Conditions, Code of Conduct, and Consent)",
  },
  {
    value: "at_least_one",
    label: "At Least One Option",
    description: "Must check at least one box (just input one of it)",
  },
  {
    value: "min_count",
    label: "Some Checkboxes (At Least N)",
    description: "Must check at least a specified number of boxes (some of it)",
  },
];

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
 * Checks if a string represents an "Other" option.
 * Case-insensitive match for "Other", "Others", "Lainnya", "Lain-lain", or prefixed with "Other:".
 */
export function isOtherOption(option?: string | null): boolean {
  if (!option || typeof option !== "string") return false;
  const normalized = option.trim().toLowerCase();
  return (
    normalized === "other" ||
    normalized === "others" ||
    normalized === "lainnya" ||
    normalized === "lain-lain" ||
    normalized.startsWith("other:") ||
    normalized.startsWith("other (") ||
    normalized.startsWith("lainnya (") ||
    normalized.startsWith("lainnya:")
  );
}

/**
 * Parses an answer value to determine if it represents an "Other" option
 * and extracts any custom write-in text.
 */
export function parseOtherAnswer(val: unknown): { isOther: boolean; customText: string } {
  if (typeof val !== "string") {
    return { isOther: false, customText: "" };
  }
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith("other:")) {
    return { isOther: true, customText: trimmed.slice(6).trim() };
  }
  if (lower.startsWith("lainnya:")) {
    return { isOther: true, customText: trimmed.slice(8).trim() };
  }
  if (isOtherOption(trimmed)) {
    return { isOther: true, customText: "" };
  }
  return { isOther: false, customText: "" };
}

/**
 * Formats a custom "Other" write-in answer for storage.
 * e.g., "Elixir" -> "Other: Elixir", "" -> "Other"
 */
export function formatOtherAnswer(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "Other";
  if (trimmed.toLowerCase().startsWith("other:")) return trimmed;
  return `Other: ${trimmed}`;
}

/**
 * Detects whether a question is a Terms, Consent, or Code of Conduct agreement.
 */
export function isTermsOrConsentQuestion(question: CustomQuestion): boolean {
  if (question.section === "Consent & Code of Conduct") return true;
  const idLower = question.id.toLowerCase();
  if (
    idLower.includes("terms") ||
    idLower.includes("agreement") ||
    idLower.includes("consent") ||
    idLower.includes("conduct") ||
    idLower.includes("commitment_policy")
  ) {
    return true;
  }
  const labelLower = question.label.toLowerCase();
  if (
    labelLower.includes("terms") ||
    labelLower.includes("code of conduct") ||
    labelLower.includes("guidelines") ||
    labelLower.includes("consent") ||
    labelLower.includes("agreement")
  ) {
    return true;
  }
  return false;
}

/**
 * Resolves the effective checkbox requirement rule and counts for a question.
 */
export function getCheckboxRequirement(question: CustomQuestion): {
  rule: CheckboxRequirementRule;
  minSelected: number;
  maxSelected?: number;
} {
  const optionsCount = question.options?.length ?? 1;

  if (question.checkbox_requirement) {
    return {
      rule: question.checkbox_requirement,
      minSelected: question.checkbox_requirement === "all" ? optionsCount : Math.max(1, question.min_selected ?? 1),
      maxSelected: question.max_selected,
    };
  }

  // Automatic smart default for Terms & Code of Conduct:
  // Requires all checkboxes by default so registrants cannot bypass compliance clauses.
  if (isTermsOrConsentQuestion(question)) {
    return {
      rule: "all",
      minSelected: optionsCount,
      maxSelected: question.max_selected,
    };
  }

  return {
    rule: "at_least_one",
    minSelected: 1,
    maxSelected: question.max_selected,
  };
}

/**
 * Validates a single question answer against its configuration.
 * Returns { isValid: true } or { isValid: false, error: "..." }.
 */
export function validateQuestionAnswer(question: CustomQuestion, value: unknown): { isValid: boolean; error?: string } {
  const customError = question.custom_error_message?.trim();

  // 1. Validate "Other" custom text input requirement (like Google Forms)
  const hasOtherOptionConfig = Boolean(question.allow_other ?? question.options?.some(isOtherOption));
  if (hasOtherOptionConfig) {
    if (typeof value === "string") {
      const parsed = parseOtherAnswer(value);
      if (parsed.isOther && !parsed.customText) {
        return {
          isValid: false,
          error: customError || `Please specify your response for "Other" in "${question.label}".`,
        };
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          const parsed = parseOtherAnswer(item);
          if (parsed.isOther && !parsed.customText) {
            return {
              isValid: false,
              error: customError || `Please specify your response for "Other" in "${question.label}".`,
            };
          }
        }
      }
    }
  }

  // 2. Checkbox & Multi-select Validation
  if (question.type === "checkbox" || question.type === "multiselect") {
    let selectedItems: string[] = [];
    if (Array.isArray(value)) {
      selectedItems = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    } else if (typeof value === "string" && value.trim().length > 0) {
      selectedItems = [value.trim()];
    } else if (typeof value === "boolean" && value) {
      selectedItems = ["true"];
    }

    const options = question.options ?? [];
    const totalOptions = options.length;
    const { rule, minSelected, maxSelected } = getCheckboxRequirement(question);

    // Max options limit (applies whenever max_selected is set)
    if (typeof maxSelected === "number" && maxSelected > 0 && selectedItems.length > maxSelected) {
      return {
        isValid: false,
        error:
          customError ||
          `You can select at most ${maxSelected} option${maxSelected > 1 ? "s" : ""} for "${question.label}".`,
      };
    }

    if (question.required) {
      if (rule === "all") {
        if (totalOptions > 0) {
          const missing = options.filter(
            (opt) => !selectedItems.some((item) => item.trim().toLowerCase() === opt.trim().toLowerCase()),
          );
          if (missing.length > 0) {
            return {
              isValid: false,
              error:
                customError ||
                (selectedItems.length === 0
                  ? `Please check all checkboxes for "${question.label}".`
                  : `Please check all checkboxes for "${question.label}" (${selectedItems.length} of ${totalOptions} agreed).`),
            };
          }
        } else if (selectedItems.length === 0) {
          return {
            isValid: false,
            error: customError || `Please check all checkboxes for "${question.label}".`,
          };
        }
      } else if (rule === "min_count") {
        const requiredCount = Math.max(1, minSelected);
        if (selectedItems.length < requiredCount) {
          return {
            isValid: false,
            error:
              customError ||
              (selectedItems.length === 0
                ? `Please select at least ${requiredCount} option${requiredCount > 1 ? "s" : ""} for "${question.label}".`
                : `Please select at least ${requiredCount} option${requiredCount > 1 ? "s" : ""} for "${question.label}" (currently ${selectedItems.length} selected).`),
          };
        }
      } else {
        // "at_least_one"
        if (selectedItems.length === 0) {
          return {
            isValid: false,
            error: customError || `Please select at least one option for "${question.label}".`,
          };
        }
      }
    }

    return { isValid: true };
  }

  // 3. Required Check for other input types (text, textarea, select, radio, media)
  if (question.required) {
    if (value === undefined || value === null) {
      return {
        isValid: false,
        error:
          customError ||
          (question.type === "media"
            ? `Please upload a file for "${question.label}".`
            : `${question.label} is required.`),
      };
    }
    if (question.type === "media") {
      if (typeof value === "string" && !value.trim()) {
        return {
          isValid: false,
          error: customError || `Please upload a file for "${question.label}".`,
        };
      }
      if (typeof value === "object" && (!value || Object.keys(value).length === 0)) {
        return {
          isValid: false,
          error: customError || `Please upload a file for "${question.label}".`,
        };
      }
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

  // Media questions only need file presence check
  if (question.type === "media") {
    return { isValid: true };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed && !question.required) {
      return { isValid: true };
    }

    // Only apply text length and regex/format constraints to text/textarea inputs
    if (question.type === "text" || question.type === "textarea") {
      // 3. Minimum Length Constraint
      if (question.min_length !== undefined && question.min_length > 0) {
        if (trimmed.length < question.min_length) {
          return {
            isValid: false,
            error: customError || `Must be at least ${question.min_length} characters (currently ${trimmed.length}).`,
          };
        }
      }

      // 4. Maximum Length Constraint
      if (question.max_length !== undefined && question.max_length > 0) {
        if (trimmed.length > question.max_length) {
          return {
            isValid: false,
            error: customError || `Must not exceed ${question.max_length} characters (currently ${trimmed.length}).`,
          };
        }
      }

      // 5. Validation Type Rules
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
                error:
                  customError || "WhatsApp number must start with 62 and contain only digits (e.g. 6281234567890).",
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
  }

  return { isValid: true };
}
