import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getInitials = (str: string): string => {
  if (typeof str !== "string" || !str.trim()) return "?";

  return (
    str
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
};

export function formatCurrency(
  amount: number,
  opts?: {
    currency?: string;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    noDecimals?: boolean;
  },
) {
  const { currency = "USD", locale = "en-US", minimumFractionDigits, maximumFractionDigits, noDecimals } = opts ?? {};

  const formatOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: noDecimals ? 0 : minimumFractionDigits,
    maximumFractionDigits: noDecimals ? 0 : maximumFractionDigits,
  };

  return new Intl.NumberFormat(locale, formatOptions).format(amount);
}

/**
 * Safely extracts a clean, human-readable message from API responses, Error objects,
 * or raw JSON strings to avoid displaying raw JSON syntax or technical stack traces in UI toasts.
 */
export function extractApiMessage(input: unknown, fallback = "An unexpected error occurred."): string {
  if (!input) return fallback;

  // If it's an Error instance
  if (input instanceof Error) {
    return extractApiMessage(input.message, fallback);
  }

  // If it's a string, check if it contains serialized JSON or HTML
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return fallback;

    // Check if the entire string is JSON
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractApiMessage(parsed, fallback);
      } catch {
        // Not valid JSON, continue below
      }
    }

    // Check if there is an embedded JSON object inside the string (e.g., "Error (500): { ... }")
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const inner = extractApiMessage(parsed, "");
        if (inner) {
          const prefix = trimmed.slice(0, jsonMatch.index).trim().replace(/[:-]$/, "").trim();
          return prefix ? `${prefix}: ${inner}` : inner;
        }
      } catch {
        // Not valid JSON
      }
    }

    // Filter out HTML error pages (e.g., 502/504 cloudflare or nginx HTML responses)
    if (trimmed.includes("<html") || trimmed.includes("<!DOCTYPE")) {
      return "The server returned an unexpected error response.";
    }

    return trimmed;
  }

  // If it's an array
  if (Array.isArray(input)) {
    if (input.length === 0) return fallback;
    return extractApiMessage(input[0], fallback);
  }

  // If it's an object
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;

    if (typeof obj.message === "string" && obj.message.trim()) {
      return extractApiMessage(obj.message, fallback);
    }
    if (typeof obj.error === "string" && obj.error.trim()) {
      return extractApiMessage(obj.error, fallback);
    }
    if (typeof obj.error === "object" && obj.error !== null) {
      return extractApiMessage(obj.error, fallback);
    }
    if (typeof obj.description === "string" && obj.description.trim()) {
      return obj.description.trim();
    }
    if (typeof obj.detail === "string" && obj.detail.trim()) {
      return obj.detail.trim();
    }
    if (typeof obj.statusText === "string" && obj.statusText.trim()) {
      return obj.statusText.trim();
    }
    if (typeof obj.msg === "string" && obj.msg.trim()) {
      return obj.msg.trim();
    }
    if (typeof obj.data === "string" && obj.data.trim()) {
      return extractApiMessage(obj.data, fallback);
    }
    if (typeof obj.data === "object" && obj.data !== null) {
      return extractApiMessage(obj.data, fallback);
    }
  }

  return String(input) || fallback;
}
