/**
 * Safe Webhook URL Validation & Resolution
 * Prevents Server-Side Request Forgery (SSRF) and credential exfiltration.
 */

const DEFAULT_ALLOWED_DOMAINS = ["gdgjakarta.com"];

function parseHost(urlString: string): string | null {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Checks whether a given hostname is an authorized webhook destination.
 * Authorized hosts must end with gdgjakarta.com or match configured n8n base/allowlist hosts.
 */
export function isAllowedWebhookHost(hostname: string): boolean {
  if (!hostname) return false;
  const cleanHost = hostname.toLowerCase().trim();

  // Explicitly block local/loopback and metadata endpoints
  if (
    cleanHost === "localhost" ||
    cleanHost === "127.0.0.1" ||
    cleanHost === "0.0.0.0" ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".internal") ||
    cleanHost === "169.254.169.254"
  ) {
    return false;
  }

  // gdgjakarta.com and *.gdgjakarta.com
  for (const domain of DEFAULT_ALLOWED_DOMAINS) {
    if (cleanHost === domain || cleanHost.endsWith(`.${domain}`)) {
      return true;
    }
  }

  // N8N_WEBHOOK_BASE_URL host
  if (process.env.N8N_WEBHOOK_BASE_URL) {
    const envHost = parseHost(process.env.N8N_WEBHOOK_BASE_URL);
    if (envHost && cleanHost === envHost) {
      return true;
    }
  }

  // N8N_ALLOWED_WEBHOOK_HOSTS (comma-separated list for staging/preview environments)
  if (process.env.N8N_ALLOWED_WEBHOOK_HOSTS) {
    const allowed = process.env.N8N_ALLOWED_WEBHOOK_HOSTS.split(",").map((h) => h.trim().toLowerCase());
    if (allowed.includes(cleanHost)) {
      return true;
    }
  }

  return false;
}

/**
 * Verifies if a given URL is a safe, authorized HTTPS webhook target.
 */
export function isSafeWebhookUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://")) return false;

  const host = parseHost(trimmed);
  if (!host) return false;

  return isAllowedWebhookHost(host);
}

/**
 * Validates that `url` starts with `https://` and its parsed hostname is an authorized
 * destination. If invalid, untrusted, or missing, safely returns `defaultUrl`.
 */
export function assertSafeWebhookUrl(url: string | undefined | null, defaultUrl: string): string {
  if (url && isSafeWebhookUrl(url)) {
    return url.trim();
  }
  return defaultUrl;
}
