/**
 * PII Masking and Security Utilities for Public Partner Voucher Redemptions.
 *
 * Designed to ensure strict zero-leakage of attendee personal identifiable
 * information (names, emails, phone numbers) and prevent promo code exposure.
 */

/**
 * Safely masks an email address while preserving domain structure for partner verification.
 * e.g.,
 *   "fachridan@gmail.com" -> "fa***n@gmail.com"
 *   "john.doe@company.org" -> "jo***e@company.org"
 *   "ab@cd.com" -> "a*@cd.com"
 *   "a@b.com" -> "*@b.com"
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "-";
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return "***";

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex); // includes '@'

  if (localPart.length <= 1) {
    return `*${domainPart}`;
  }
  if (localPart.length === 2) {
    return `${localPart[0]}*${domainPart}`;
  }
  if (localPart.length <= 4) {
    return `${localPart[0]}**${localPart[localPart.length - 1]}${domainPart}`;
  }

  // 5+ characters: show first 2 and last 1 char
  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}${domainPart}`;
}

/**
 * Safely masks an attendee name, keeping familiar structure while obscuring identity.
 * e.g.,
 *   "Muhammad Fachridan Tarigan" -> "Muhammad F*** T***"
 *   "John Doe" -> "John D***"
 *   "Fachridan" -> "Fa***n"
 *   "Bob" -> "B***"
 */
export function maskName(name?: string | null): string {
  if (!name || typeof name !== "string") return "Attendee";
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return "Attendee";

  const parts = clean.split(" ");
  if (parts.length === 1) {
    const single = parts[0];
    if (single.length <= 2) return `${single[0]}*`;
    if (single.length <= 4) return `${single[0]}***`;
    return `${single.slice(0, 2)}***${single.slice(-1)}`;
  }

  // Multi-word name: Keep the first name intact, mask subsequent surnames to Initial + ***
  const firstName = parts[0];
  const maskedSurnames = parts.slice(1).map((part) => {
    if (!part) return "";
    return `${part[0].toUpperCase()}***`;
  });

  return `${firstName} ${maskedSurnames.join(" ")}`.trim();
}

/**
 * Safely masks a phone number, preserving area/country prefix and last 3 digits.
 * e.g.,
 *   "+6281234567890" -> "+6281****7890"
 *   "0812345678" -> "0812****678"
 */
export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== "string") return "-";
  const clean = phone.trim();
  if (clean.length <= 6) return "****";

  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-3);
  return `${prefix}****${suffix}`;
}

/**
 * Partially masks a promo code for safe display on public reports or video calls.
 * e.g.,
 *   "PARTNER2024" -> "PAR****2024"
 *   "DEVFEST50" -> "DEV****50"
 *   "VIP" -> "V***"
 */
export function maskVoucherCode(code: string): string {
  const clean = (code || "").trim().toUpperCase();
  if (clean.length <= 4) return `${clean[0] || "*"}***`;
  if (clean.length <= 7) return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
  return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
}

/**
 * Generates a cryptographically random, URL-safe opaque share token (24 chars).
 * Used as the document lookup token so the real voucher code and event ID are NEVER exposed in the URL.
 */
export function generateOpaqueShareToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 24; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let result = "vshr_";
  for (let i = 0; i < 20; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * Generates a clean, readable partner access code (e.g. "GDG-749281").
 */
export function generatePartnerAccessCode(prefix = "GDG"): string {
  const numbers = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${numbers}`;
}
