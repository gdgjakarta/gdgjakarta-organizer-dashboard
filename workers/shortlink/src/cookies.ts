export function parseCookieMap(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const name = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    if (!name) continue;
    try {
      cookies.set(name, decodeURIComponent(rawValue));
    } catch {
      cookies.set(name, rawValue);
    }
  }

  return cookies;
}

export function sanitizeCookieId(linkId: string): string {
  return linkId.replace(/[^A-Za-z0-9_-]/g, "_");
}

export function getUnlockCookieName(linkId: string): string {
  return `sl_unlock_${sanitizeCookieId(linkId)}`;
}

export function getSplitCookieName(linkId: string): string {
  return `sl_split_${sanitizeCookieId(linkId)}`;
}

export function isHttpsRequest(request: Request, url: URL): boolean {
  if (url.protocol === "https:") {
    return true;
  }
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (!forwardedProto) {
    return false;
  }
  return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
}

export function buildSetCookieHeader(params: { name: string; value: string; maxAge: number; secure: boolean }): string {
  const parts = [
    `${params.name}=${params.value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(params.maxAge))}`,
  ];
  if (params.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export async function extractSubmittedPassword(request: Request): Promise<string | null> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const raw = formData.get("password");
      return typeof raw === "string" ? raw : null;
    } catch {
      return null;
    }
  }

  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    return null;
  }

  if (!bodyText) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(bodyText) as { password?: unknown } | null;
      return parsed && typeof parsed === "object" && typeof parsed.password === "string" ? parsed.password : null;
    } catch {
      return null;
    }
  }

  const params = new URLSearchParams(bodyText);
  const raw = params.get("password");
  return typeof raw === "string" ? raw : null;
}
