import { DEFAULT_FEATURE_FLAGS, type FeatureFlagsConfig, parseFeatureFlags } from "./feature-flags";
import { REMOTE_CONFIG_KEYS, type RemoteConfigKey } from "./remote-config-keys";
import {
  type ConfigMapItem,
  DEFAULT_CHAPTER_ID,
  DEFAULT_CHAPTER_SLUG,
  parseMappedConfigValue,
} from "./remote-config-utils";

export {
  type ConfigMapItem,
  DEFAULT_CHAPTER_ID,
  DEFAULT_CHAPTER_SLUG,
  parseMappedConfigValue,
  REMOTE_CONFIG_KEYS,
  type RemoteConfigKey,
};

const DEFAULT_CSRF_TOKEN = "";
const DEFAULT_COOKIE = "";

// ── In-Memory Caching for Server-Side REST Fetcher ────────────────────────────

interface InstallationAuth {
  fid: string;
  token: string;
  expiresAt: number;
}

interface RemoteConfigCache {
  entries: Record<string, string>;
  fetchedAt: number;
}

let cachedAuth: InstallationAuth | null = null;
let cachedEntries: RemoteConfigCache | null = null;

// Cache TTL: 60 seconds (aligned with KawalEvent MINIMUM_FETCH_INTERVAL)
const CACHE_TTL_MS = 60 * 1000;

/**
 * Retrieves a valid Firebase Installation ID and Auth Token for REST calls.
 */
async function getInstallationAuth(apiKey: string, projectId: string, appId: string): Promise<InstallationAuth> {
  const now = Date.now();
  if (cachedAuth && now < cachedAuth.expiresAt - 60_000) {
    return cachedAuth;
  }

  const url = `https://firebaseinstallations.googleapis.com/v1/projects/${projectId}/installations`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      appId,
      authVersion: "FIS_v2",
      sdkVersion: "w:0.6.14",
    }),
  });

  if (!response.ok) {
    throw new Error(`Firebase Installations request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    fid: string;
    authToken?: { token?: string; expiresIn?: string };
  };

  if (!data.fid || !data.authToken?.token) {
    throw new Error("Invalid installation response received from Firebase");
  }

  const expiresInSec = Number.parseInt(data.authToken.expiresIn ?? "604800", 10);
  cachedAuth = {
    fid: data.fid,
    token: data.authToken.token,
    expiresAt: now + expiresInSec * 1000,
  };

  return cachedAuth;
}

/**
 * Fetches Remote Config parameters via Firebase Remote Config REST API on the server.
 * Compatible with Node.js, Next.js Server Components, Server Actions, and Cloudflare Workers.
 */
async function fetchServerRemoteConfigEntries(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedEntries && now - cachedEntries.fetchedAt < CACHE_TTL_MS) {
    return cachedEntries.entries;
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCVk8ECyA8Lqd7KNqdnItxYUu9jdFzoohU";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gdgjakarta-app";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:883556294048:web:364631a561bd411a0ed8c5";

  try {
    const auth = await getInstallationAuth(apiKey, projectId, appId);
    const rcUrl = `https://firebaseremoteconfig.googleapis.com/v1/projects/${projectId}/namespaces/firebase:fetch?key=${apiKey}`;

    const response = await fetch(rcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        app_instance_id: auth.fid,
        app_instance_id_token: auth.token,
        sdk_version: "2.1.0",
      }),
    });

    if (!response.ok) {
      console.warn(`[Remote Config REST] Fetch returned HTTP ${response.status}`);
      return cachedEntries?.entries ?? {};
    }

    const data = (await response.json()) as {
      entries?: Record<string, string>;
      state?: string;
    };

    const entries = data.entries ?? {};
    cachedEntries = {
      entries,
      fetchedAt: now,
    };

    return entries;
  } catch (error) {
    console.warn("[Remote Config REST] Failed to fetch remote config parameters:", error);
    return cachedEntries?.entries ?? {};
  }
}

/**
 * Fetches the raw string value of a Remote Config parameter.
 * Works transparently across client-side browser and server-side runtimes.
 */
export async function getRemoteConfigValue(key: string): Promise<string> {
  // 1. Client-Side Resolution via Firebase Web SDK
  if (typeof window !== "undefined") {
    try {
      const { remoteConfig } = await import("./firebase");
      if (remoteConfig) {
        const { fetchAndActivate, getValue } = await import("firebase/remote-config");
        await fetchAndActivate(remoteConfig).catch((_err) => {
          // Ignore background fetch activation errors
        });
        const val = getValue(remoteConfig, key);
        const strVal = val.asString();
        if (strVal) return strVal;
      }
    } catch (err) {
      console.warn(`[Remote Config Client] Error reading key "${key}":`, err);
    }
  }

  // 2. Server-Side Resolution via Firebase REST API
  try {
    const entries = await fetchServerRemoteConfigEntries();
    if (entries[key] !== undefined) {
      return entries[key];
    }
  } catch (err) {
    console.warn(`[Remote Config Server] Error reading key "${key}":`, err);
  }

  return "";
}

/**
 * Resolves a mapped Remote Config value for a specific chapter ID.
 * Falls back to default fallback value if Remote Config parameter is empty or missing.
 */
export async function getMappedRemoteConfigValue(
  key: string,
  chapterId: string | number = DEFAULT_CHAPTER_ID,
  fallback = "",
): Promise<string> {
  try {
    const rawValue = await getRemoteConfigValue(key);
    const resolved = parseMappedConfigValue(rawValue, chapterId);
    if (resolved && resolved.trim().length > 0) {
      return resolved;
    }
  } catch (err) {
    console.warn(`[Remote Config] Error resolving mapped value for "${key}":`, err);
  }

  return fallback;
}

// ── Bevy Credentials Resolvers ───────────────────────────────────────────────

/**
 * Resolves the Bevy session cookie for a chapter from Remote Config (`cfg_bevy_cookie`),
 * falling back to process.env.BEVY_COOKIE or default fallback.
 *
 * Matches KawalEvent HeaderInterceptor:
 * configProvider.getMappedConfigValue(ConfigKey.BEVY_COOKIE, chapterId)
 */
export async function getBevyCookie(chapterId: string | number = DEFAULT_CHAPTER_ID): Promise<string> {
  const fallback = process.env.BEVY_COOKIE || DEFAULT_COOKIE;
  return await getMappedRemoteConfigValue(REMOTE_CONFIG_KEYS.BEVY_COOKIE, chapterId, fallback);
}

/**
 * Resolves the Bevy X-CSRFToken for a chapter from Remote Config (`cfg_bevy_x_csrftoken`),
 * falling back to process.env.BEVY_CSRF_TOKEN or default fallback.
 *
 * Matches KawalEvent HeaderInterceptor:
 * configProvider.getMappedConfigValue(ConfigKey.BEVY_X_CSRFTOKEN, chapterId)
 */
export async function getBevyCsrfToken(chapterId: string | number = DEFAULT_CHAPTER_ID): Promise<string> {
  const fallback = process.env.BEVY_CSRF_TOKEN || DEFAULT_CSRF_TOKEN;
  return await getMappedRemoteConfigValue(REMOTE_CONFIG_KEYS.BEVY_X_CSRFTOKEN, chapterId, fallback);
}

/**
 * Resolves both Cookie and X-CSRFToken headers for Bevy API requests.
 */
export async function getBevyAuthCredentials(chapterId: string | number = DEFAULT_CHAPTER_ID): Promise<{
  cookie: string;
  csrfToken: string;
}> {
  const [cookie, csrfToken] = await Promise.all([getBevyCookie(chapterId), getBevyCsrfToken(chapterId)]);
  return { cookie, csrfToken };
}

/**
 * Resolves dynamic referer URL template for Bevy operations from Remote Config (`cfg_bevy_referer_url`).
 */
export async function getBevyRefererUrl(
  chapterId: string | number = DEFAULT_CHAPTER_ID,
  eventId?: string | number,
): Promise<string> {
  const defaultTemplate = `https://gdg.community.dev/events/details/google-gdg-${DEFAULT_CHAPTER_SLUG}/?event={eventId}`;
  const template = await getMappedRemoteConfigValue(REMOTE_CONFIG_KEYS.BEVY_REFERER_URL, chapterId, defaultTemplate);
  if (eventId) {
    return template.replace("{eventId}", String(eventId));
  }
  return template;
}

/**
 * Resolves the list of authorized organizer emails from Remote Config (`cfg_organizer_emails`).
 * Supports JSON array format: ["email1@example.com", "email2@example.com"]
 * and falls back to comma-separated string or process.env.ORGANIZER_EMAILS.
 */
export async function getOrganizerEmailsFromRemoteConfig(): Promise<string[]> {
  try {
    const raw = await getRemoteConfigValue(REMOTE_CONFIG_KEYS.ORGANIZER_EMAILS);
    if (raw.trim()) {
      const trimmed = raw.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
        }
      }
      // Comma-separated fallback
      return trimmed
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    }
  } catch (err) {
    console.warn("[Remote Config] Failed to parse organizer emails:", err);
  }

  const envEmails = (process.env.ORGANIZER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(envEmails));
}

/**
 * Resolves feature flags configuration from Remote Config (`cfg_feature_flags`).
 * Supports JSON map format, chapter-mapped array format, and environment variable fallbacks.
 */
export async function getFeatureFlagsFromRemoteConfig(
  chapterId: string | number = DEFAULT_CHAPTER_ID,
): Promise<FeatureFlagsConfig> {
  try {
    const raw =
      (await getRemoteConfigValue(REMOTE_CONFIG_KEYS.FEATURE_FLAGS)) ||
      process.env.FEATURE_FLAGS ||
      process.env.NEXT_PUBLIC_FEATURE_FLAGS ||
      "";

    if (raw?.trim()) {
      return parseFeatureFlags(raw, chapterId);
    }
  } catch (err) {
    console.warn("[Remote Config] Failed to fetch feature flags:", err);
  }

  return DEFAULT_FEATURE_FLAGS;
}
