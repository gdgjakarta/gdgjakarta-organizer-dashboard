/**
 * Cryptographic HMAC Cookie Signing & Verification
 * Protects session role cookies from client-side tampering and privilege escalation.
 * Compatible with Edge runtime, Node.js, and browser environments.
 */

function getSecretKeyBytes(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || "gdg-jakarta-secure-hmac-session-secret-2026";
  return new TextEncoder().encode(secret);
}

async function getHmacCryptoKey(): Promise<CryptoKey> {
  const keyBytes = getSecretKeyBytes();
  return crypto.subtle.importKey("raw", keyBytes as unknown as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/**
 * Signs a role string with HMAC-SHA256.
 * Format: `<role>.<hexSignature>`
 */
export async function signRoleCookie(role: string): Promise<string> {
  const key = await getHmacCryptoKey();
  const data = new TextEncoder().encode(role);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, data as unknown as BufferSource);
  const hexSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${role}.${hexSignature}`;
}

/**
 * Verifies an HMAC-SHA256 signed role cookie value.
 * Returns the unescaped role string if the signature is valid, or null if forged/invalid.
 */
export async function verifyRoleCookie(signedValue: string | undefined | null): Promise<string | null> {
  if (!signedValue || typeof signedValue !== "string" || !signedValue.includes(".")) {
    return null;
  }
  const lastDotIndex = signedValue.lastIndexOf(".");
  const role = signedValue.slice(0, lastDotIndex);
  const signatureHex = signedValue.slice(lastDotIndex + 1);

  if (!role || !signatureHex || signatureHex.length % 2 !== 0) {
    return null;
  }

  try {
    const key = await getHmacCryptoKey();
    const data = new TextEncoder().encode(role);
    const sigBytes = new Uint8Array(signatureHex.length / 2);
    for (let i = 0; i < signatureHex.length; i += 2) {
      const byteVal = Number.parseInt(signatureHex.substring(i, i + 2), 16);
      if (Number.isNaN(byteVal)) return null;
      sigBytes[i / 2] = byteVal;
    }
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
      data as unknown as BufferSource,
    );
    return isValid ? role : null;
  } catch {
    return null;
  }
}
