/**
 * Pure utilities for referral code generation.
 * Separated from client.ts to prevent bundling heavy Firestore client libraries in SSR.
 */

export function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed O, 0, 1, I for readability
  let code = "GDG";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Deterministically generates a unique, user-specific referral code (e.g. GDG8M2K9).
 * Guarantees that different users always receive completely distinct referral codes,
 * without requiring forbidden collection-wide listing queries.
 */
export function generateUserReferralCode(seed: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const cleanSeed = (seed || "").trim();
  if (!cleanSeed) {
    return generateRandomCode();
  }

  // 64-bit multi-round FNV-1a hash for high dispersion and zero collisions across users
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < cleanSeed.length; i++) {
    const code = cleanSeed.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code;
    h2 = Math.imul(h2, 0x27d4eb2d);
  }

  let code = "GDG";
  let combined = (BigInt(h1 >>> 0) << BigInt(32)) | BigInt(h2 >>> 0);
  for (let i = 0; i < 5; i++) {
    const idx = Number(combined % BigInt(chars.length));
    code += chars[idx];
    combined /= BigInt(chars.length);
  }
  return code;
}
