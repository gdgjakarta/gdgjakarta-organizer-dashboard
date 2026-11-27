/**
 * Pure utilities & cryptographic helpers for Restricted Event YouTube Stream Access.
 * Uses Web Crypto API (`globalThis.crypto`) so it runs identically in Node.js 22 and Cloudflare Workers.
 */

export type StreamAccessMode = "public" | "whitelisted";
export type StreamCodeStatus = "pending" | "redeemed" | "revoked" | "expired";
export type StreamSessionStatus = "active" | "expired" | "revoked";
export type StreamWhitelistStorage = "inline" | "subcollection";

export interface EventStreamPublicDoc {
  event_id: string;
  enabled: boolean;
  title: string;
  access_mode: StreamAccessMode;
  watermark_enabled: boolean;
  include_approved_registrants: boolean;
  public_youtube_video_id?: string | null;
  sealed_video_id?: string | null;
  whitelist_storage?: StreamWhitelistStorage;
  whitelist_email_hashes?: string[];
  whitelist_count?: number;
  updated_at: string;
  updated_by?: string | null;
}

export interface EventStreamPrivateDoc {
  event_id: string;
  youtube_url: string;
  youtube_video_id: string;
  manual_whitelist_emails: string[];
  updated_at: string;
  updated_by?: string | null;
}

export interface EventStreamCodeDoc {
  id: string;
  event_id: string;
  email_hash: string;
  code_hash: string;
  status: StreamCodeStatus;
  attempts: number;
  expires_at: number;
  created_at: number;
  rate_limit_timestamps: number[];
  active_session_id?: string | null;
  redeemed_at?: number | null;
  ttl_at?: Date | string;
}

export interface EventStreamSessionDoc {
  id: string;
  event_id: string;
  viewer_email_masked: string;
  status: StreamSessionStatus;
  started_at: number;
  last_heartbeat_at: number;
  ended_at?: number | null;
  ttl_at?: Date | string;
}

export const STREAM_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const STREAM_OTP_MAX_ATTEMPTS = 5;
export const STREAM_OTP_COOLDOWN_MS = 60 * 1000; // 1 request per 60s
export const STREAM_OTP_HOURLY_LIMIT = 5;
export const STREAM_OTP_HOURLY_WINDOW_MS = 60 * 60 * 1000;

// Non-backtracking email regex (prevents quadratic ReDoS on crafted inputs like "a@" + ".".repeat(40000) + "@")
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const MAX_EMAIL_LENGTH = 254;
const OTP_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars (256 % 32 === 0, unbiased)

const sharedEncoder = new TextEncoder();

export function normalizeStreamEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidStreamEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const normalized = normalizeStreamEmail(email);
  if (normalized.length === 0 || normalized.length > MAX_EMAIL_LENGTH) return false;
  return EMAIL_REGEX.test(normalized);
}

/**
 * Validates an eventId against dot-segment path traversal ("..", ".") and slashes.
 */
export function isValidStreamEventId(eventId: string): boolean {
  if (typeof eventId !== "string") return false;
  const trimmed = eventId.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  if (trimmed === "." || trimmed === "..") return false;
  if (/[\\/\s]/.test(trimmed) || trimmed.includes("..")) return false;
  return true;
}

/**
 * Escapes HTML special characters to prevent HTML injection in outbound emails.
 */
export function escapeStreamHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Parses a comma/newline/semicolon-separated list of emails into deduplicated normalized valid emails.
 */
export function parseWhitelistEmails(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = raw
    .split(/[\n,;\s]+/)
    .map((t) => normalizeStreamEmail(t))
    .filter(Boolean);

  const validSet = new Set<string>();
  const invalidSet = new Set<string>();

  for (const token of tokens) {
    if (isValidStreamEmail(token)) {
      validSet.add(token);
    } else {
      invalidSet.add(token);
    }
  }

  return {
    valid: Array.from(validSet),
    invalid: Array.from(invalidSet),
  };
}

/**
 * Masks an email for non-sensitive session logging (Unicode/surrogate-pair safe).
 */
export function maskStreamEmail(email: string): string {
  const normalized = normalizeStreamEmail(email);
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) return "***";
  const localChars = Array.from(normalized.slice(0, atIndex));
  const domain = normalized.slice(atIndex + 1);
  const visible = localChars.length <= 2 ? (localChars[0] ?? "*") : localChars.slice(0, 2).join("");
  const masked = `${visible}***@${domain}`;
  return masked.slice(0, 160);
}

/**
 * Generates a cryptographically random 6-character unambiguous OTP code.
 */
export function generateStreamOtpCode(length = 6): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += OTP_ALPHABET[bytes[i] % OTP_ALPHABET.length];
  }
  return code;
}

/**
 * Generates an unguessable session document ID matching `^strm_[a-f0-9]{32}$`.
 */
export function generateStreamSessionId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `strm_${hex}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    sharedEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Computes HMAC-SHA256 hex digest (64 lowercase hex chars).
 */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, sharedEncoder.encode(message));
  return bytesToHex(new Uint8Array(sig));
}

export async function hashStreamEmail(secret: string, eventId: string, email: string): Promise<string> {
  return hmacSha256Hex(secret, `email:${eventId}:${normalizeStreamEmail(email)}`);
}

/**
 * Batch-hashes whitelist emails using a single imported HMAC CryptoKey in bounded chunks (fixes PERF-3).
 */
export async function hashStreamEmailsBatch(
  secret: string,
  eventId: string,
  emails: string[],
  batchSize = 250,
): Promise<string[]> {
  if (emails.length === 0) return [];
  const key = await importHmacKey(secret);
  const results: string[] = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    const chunk = emails.slice(i, i + batchSize);
    const hashes = await Promise.all(
      chunk.map(async (em) => {
        const msg = `email:${eventId}:${normalizeStreamEmail(em)}`;
        const sig = await globalThis.crypto.subtle.sign("HMAC", key, sharedEncoder.encode(msg));
        return bytesToHex(new Uint8Array(sig));
      }),
    );
    results.push(...hashes);
  }

  return results;
}

export async function deriveStreamCodeDocId(secret: string, eventId: string, email: string): Promise<string> {
  const digest = await hmacSha256Hex(secret, `code_doc:${eventId}:${normalizeStreamEmail(email)}`);
  return `stcode_${digest}`;
}

export async function hashStreamOtpCode(secret: string, eventId: string, email: string, code: string): Promise<string> {
  const normalizedCode = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return hmacSha256Hex(secret, `otp:${eventId}:${normalizeStreamEmail(email)}:${normalizedCode}`);
}

/**
 * Constant-time string comparison to avoid timing leaks on hash verification.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await globalThis.crypto.subtle.digest("SHA-256", sharedEncoder.encode(`stream-aes:${secret}`));
  return globalThis.crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Encrypts a YouTube video ID with AES-256-GCM (binding optional `eventId` as AAD in v2 format).
 */
export async function sealStreamVideoId(secret: string, videoId: string, eventId?: string): Promise<string> {
  const key = await deriveAesKey(secret);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const params: AesGcmParams = eventId
    ? { name: "AES-GCM", iv, additionalData: sharedEncoder.encode(`event:${eventId}`) }
    : { name: "AES-GCM", iv };
  const ciphertext = await globalThis.crypto.subtle.encrypt(params, key, sharedEncoder.encode(videoId));
  const version = eventId ? "v2" : "v1";
  return `${version}.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

/**
 * Decrypts a sealed YouTube video ID produced by `sealStreamVideoId` (supports v2 with eventId AAD and legacy v1).
 */
export async function unsealStreamVideoId(secret: string, sealed: string, eventId?: string): Promise<string | null> {
  try {
    const parts = sealed.split(".");
    if (parts.length !== 3 || (parts[0] !== "v1" && parts[0] !== "v2")) return null;
    if (parts[0] === "v2" && !eventId) return null;
    const iv = base64ToBytes(parts[1]);
    const ciphertext = base64ToBytes(parts[2]);
    const key = await deriveAesKey(secret);
    const params: AesGcmParams =
      parts[0] === "v2"
        ? { name: "AES-GCM", iv: iv as BufferSource, additionalData: sharedEncoder.encode(`event:${eventId}`) }
        : { name: "AES-GCM", iv: iv as BufferSource };
    const plain = await globalThis.crypto.subtle.decrypt(params, key, ciphertext as BufferSource);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/**
 * Evaluates OTP request rate limits (60s cooldown + 5 requests/hour).
 * Ignores malformed/future timestamps to prevent permanent lockout (NEW-SEC-1).
 */
export function checkOtpRateLimit(
  existingTimestamps: unknown[],
  now = Date.now(),
): { allowed: true; updatedTimestamps: number[] } | { allowed: false; retryAfterSec: number; reason: string } {
  const maxSkewMs = 5_000;
  const recentHour = existingTimestamps
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((ts) => Number.isFinite(ts) && ts > 0 && ts <= now + maxSkewMs && now - ts < STREAM_OTP_HOURLY_WINDOW_MS)
    .sort((a, b) => a - b);

  if (recentHour.length > 0) {
    const lastTs = recentHour[recentHour.length - 1];
    const elapsed = Math.max(0, now - lastTs);
    if (elapsed < STREAM_OTP_COOLDOWN_MS) {
      const retryAfterSec = Math.max(1, Math.ceil((STREAM_OTP_COOLDOWN_MS - elapsed) / 1000));
      return {
        allowed: false,
        retryAfterSec,
        reason: `Please wait ${retryAfterSec}s before requesting another code.`,
      };
    }
  }

  if (recentHour.length >= STREAM_OTP_HOURLY_LIMIT) {
    const oldestTs = recentHour[0];
    const retryAfterSec = Math.max(1, Math.ceil((STREAM_OTP_HOURLY_WINDOW_MS - (now - oldestTs)) / 1000));
    return {
      allowed: false,
      retryAfterSec,
      reason: "Too many code requests in the past hour. Please try again later.",
    };
  }

  return {
    allowed: true,
    updatedTimestamps: [...recentHour, now].slice(-10),
  };
}
