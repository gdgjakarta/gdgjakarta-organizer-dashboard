/**
 * Pure Web-Crypto helpers for Cloudflare Workers & Node.js shortlink security.
 * Uses Web Crypto (`crypto.subtle`) exclusively (zero `node:crypto` or external dependencies).
 */

export const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_PREFIX = "pbkdf2";
const SALT_BYTES = 16;
const HASH_BITS = 256;
const DEFAULT_UNLOCK_TTL_SECONDS = 3600;
const DEFAULT_SPLIT_TTL_SECONDS = 30 * 24 * 3600;

const sharedEncoder = new TextEncoder();
const sharedDecoder = new TextDecoder();

function toBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const val = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(val)) return null;
    out[i / 2] = val;
  }
  return out;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Uint8Array | null {
  if (!input || !/^[A-Za-z0-9_-]+$/.test(input)) {
    return null;
  }
  try {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const binary = atob(`${padded}${"=".repeat(padLen)}`);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePbkdf2Hex(password: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toBufferSource(sharedEncoder.encode(password)),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toBufferSource(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_BITS,
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * Hashes a shortlink password using PBKDF2-HMAC-SHA256 at 100,000 iterations (Workers max).
 * Output format: `pbkdf2$<saltHex>$<hashHex>`
 */
export async function hashLinkPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string.");
  }
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const hashHex = await derivePbkdf2Hex(password, salt);
  return `${PBKDF2_PREFIX}$${bytesToHex(salt)}$${hashHex}`;
}

/**
 * Verifies a plaintext password against a stored `pbkdf2$<saltHex>$<hashHex>` hash.
 * Fails closed (`false`) on empty passwords or malformed hashes.
 */
export async function verifyLinkPassword(password: string, storedHash: string | undefined | null): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0) return false;
  if (typeof storedHash !== "string" || !storedHash) return false;

  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== PBKDF2_PREFIX) return false;

  const [, saltHex, expectedHashHex] = parts;
  if (!expectedHashHex || expectedHashHex.length !== (HASH_BITS / 8) * 2 || !/^[0-9a-f]+$/i.test(expectedHashHex)) {
    return false;
  }

  const salt = hexToBytes(saltHex);
  if (!salt || salt.length !== SALT_BYTES) return false;

  try {
    const derivedHex = await derivePbkdf2Hex(password, salt);
    return timingSafeEqualHex(derivedHex, expectedHashHex.toLowerCase());
  } catch {
    return false;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const trimmed = typeof secret === "string" ? secret.trim() : "";
  if (!trimmed) {
    throw new Error("SHORTLINK_COOKIE_SECRET is not configured.");
  }
  return crypto.subtle.importKey(
    "raw",
    toBufferSource(sharedEncoder.encode(trimmed)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Signs an arbitrary payload string with HMAC-SHA256 in `<payloadB64Url>.<sigB64Url>` format.
 * Throws if `secret` is missing/whitespace or `payload` is empty.
 */
export async function signHmacToken(secret: string, payload: string): Promise<string> {
  if (!payload) {
    throw new Error("HMAC payload must not be empty.");
  }
  const key = await importHmacKey(secret);
  const payloadB64 = base64UrlEncode(sharedEncoder.encode(payload));
  const signature = await crypto.subtle.sign("HMAC", key, toBufferSource(sharedEncoder.encode(payloadB64)));
  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies an HMAC-SHA256 `<payloadB64Url>.<sigB64Url>` token.
 * Fails closed (`null`) when secret is missing or token is malformed/tampered.
 */
export async function verifyHmacToken(secret: string, token: string | undefined | null): Promise<string | null> {
  if (typeof secret !== "string" || !secret.trim()) return null;
  if (typeof token !== "string" || !token) return null;

  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx !== token.lastIndexOf(".")) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);
  if (!payloadB64 || !sigB64) return null;

  const sigBytes = base64UrlDecode(sigB64);
  const payloadBytes = base64UrlDecode(payloadB64);
  if (!sigBytes || !payloadBytes) return null;

  try {
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      toBufferSource(sigBytes),
      toBufferSource(sharedEncoder.encode(payloadB64)),
    );
    if (!valid) return null;
    return sharedDecoder.decode(payloadBytes);
  } catch {
    return null;
  }
}

interface UnlockCookieClaims {
  v: 1;
  kind: "unlock";
  lid: string;
  exp: number;
}

export async function createUnlockCookieValue(
  secret: string,
  params: { linkId: string; ttlSeconds?: number; nowMs?: number },
): Promise<string> {
  const linkId = params.linkId.trim();
  if (!linkId) {
    throw new Error("linkId is required for unlock cookie.");
  }
  const nowMs = params.nowMs ?? Date.now();
  const ttlSeconds = params.ttlSeconds ?? DEFAULT_UNLOCK_TTL_SECONDS;
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("ttlSeconds must be positive.");
  }
  const claims: UnlockCookieClaims = {
    v: 1,
    kind: "unlock",
    lid: linkId,
    exp: nowMs + Math.floor(ttlSeconds * 1000),
  };
  return signHmacToken(secret, JSON.stringify(claims));
}

export async function verifyUnlockCookieValue(
  secret: string,
  cookieValue: string | undefined | null,
  expectedLinkId: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const linkId = expectedLinkId.trim();
  if (!linkId) return false;
  const raw = await verifyHmacToken(secret, cookieValue);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<UnlockCookieClaims>;
    if (
      parsed.v !== 1 ||
      parsed.kind !== "unlock" ||
      parsed.lid !== linkId ||
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp)
    ) {
      return false;
    }
    return nowMs < parsed.exp;
  } catch {
    return false;
  }
}

interface SplitTestCookieClaims {
  v: 1;
  kind: "split";
  lid: string;
  idx: number;
  lbl: string;
  url?: string;
  exp: number;
}

export interface VerifiedSplitTestCookie {
  variantIndex: number;
  variantLabel: string;
  targetUrl?: string;
  exp: number;
}

export async function createSplitTestCookieValue(
  secret: string,
  params: {
    linkId: string;
    variantIndex?: number;
    variantLabel?: string;
    targetUrl?: string;
    ttlSeconds?: number;
    nowMs?: number;
  },
): Promise<string> {
  const linkId = params.linkId.trim();
  if (!linkId) {
    throw new Error("linkId is required for split-test cookie.");
  }
  const variantIndex = params.variantIndex ?? 0;
  if (!Number.isInteger(variantIndex) || variantIndex < 0) {
    throw new Error("variantIndex must be a non-negative integer.");
  }
  const variantLabel = (params.variantLabel ?? "").trim();
  const nowMs = params.nowMs ?? Date.now();
  const ttlSeconds = params.ttlSeconds ?? DEFAULT_SPLIT_TTL_SECONDS;
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("ttlSeconds must be positive.");
  }
  const claims: SplitTestCookieClaims = {
    v: 1,
    kind: "split",
    lid: linkId,
    idx: variantIndex,
    lbl: variantLabel,
    ...(params.targetUrl ? { url: params.targetUrl } : {}),
    exp: nowMs + Math.floor(ttlSeconds * 1000),
  };
  return signHmacToken(secret, JSON.stringify(claims));
}

export async function verifySplitTestCookieValue(
  secret: string,
  cookieValue: string | undefined | null,
  expectedLinkId: string,
  nowMs = Date.now(),
): Promise<VerifiedSplitTestCookie | null> {
  const linkId = expectedLinkId.trim();
  if (!linkId) return null;
  const raw = await verifyHmacToken(secret, cookieValue);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SplitTestCookieClaims>;
    if (
      parsed.v !== 1 ||
      parsed.kind !== "split" ||
      parsed.lid !== linkId ||
      typeof parsed.idx !== "number" ||
      !Number.isInteger(parsed.idx) ||
      parsed.idx < 0 ||
      typeof parsed.lbl !== "string" ||
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp)
    ) {
      return null;
    }
    if (nowMs >= parsed.exp) return null;
    return {
      variantIndex: parsed.idx,
      variantLabel: parsed.lbl,
      ...(typeof parsed.url === "string" ? { targetUrl: parsed.url } : {}),
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
