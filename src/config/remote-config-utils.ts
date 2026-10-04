export const DEFAULT_CHAPTER_ID = process.env.BEVY_CHAPTER_ID || "642";
export const DEFAULT_CHAPTER_SLUG = process.env.BEVY_CHAPTER_SLUG || "gdg-jakarta";

/**
 * Resolves the Bevy organizer management overview URL for a specific event.
 * Format: https://gdg.community.dev/dashboard/{chapterSlug}/events/{eventId}/overview
 */
export function getBevyManageEventUrl(
  eventId?: string | number | null,
  chapterSlug: string = DEFAULT_CHAPTER_SLUG,
): string {
  const slug = chapterSlug || "gdg-jakarta";
  if (!eventId) {
    return `https://gdg.community.dev/dashboard/${slug}/events/`;
  }
  return `https://gdg.community.dev/dashboard/${slug}/events/${eventId}/overview`;
}

/**
 * Resolves standard Bevy organizer dashboard URLs.
 * Format: https://gdg.community.dev/dashboard/{chapterSlug}/{page}
 * Pages: home, events, emails, members, settings/team.
 */
export function getBevyDashboardUrl(
  page: "home" | "events" | "emails" | "members" | "settings/team" | (string & {}),
  chapterSlug: string = DEFAULT_CHAPTER_SLUG,
): string {
  const slug = chapterSlug || "gdg-jakarta";
  return `https://gdg.community.dev/dashboard/${slug}/${page}`;
}

/**
 * Resolves Bevy team management URL.
 * Format: https://gdg.community.dev/dashboard/{chapterSlug}/settings/team
 */
export function getBevyTeamSettingsUrl(chapterSlug: string = DEFAULT_CHAPTER_SLUG): string {
  return getBevyDashboardUrl("settings/team", chapterSlug);
}

/**
 * Mapped configuration entry matching KawalEvent ConfigMap model:
 * [ { "key": "<chapterId>", "value": "..." } ]
 */
export interface ConfigMapItem {
  key: string;
  value: string;
}

/**
 * Parses a Remote Config value that may be either:
 * 1. A JSON array of ConfigMap items mapped per chapterId: [ { "key": "642", "value": "..." } ]
 * 2. A plain string value fallback.
 *
 * Matches KawalEvent ConfigMap.Companion.getMappedConfigValue behavior.
 *
 * @param configValue The raw string fetched from Remote Config.
 * @param chapterId Chapter numerical ID (e.g. 642 or "642").
 * @returns The resolved string value for the given chapter, or fallback to raw string / empty.
 */
export function parseMappedConfigValue(
  configValue: string | undefined | null,
  chapterId: string | number = DEFAULT_CHAPTER_ID,
): string {
  if (!configValue) return "";
  const trimmed = configValue.trim();
  if (!trimmed) return "";

  // Check if value is a JSON array string
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const items = JSON.parse(trimmed) as ConfigMapItem[];
      if (Array.isArray(items)) {
        const targetId = String(chapterId);
        const match = items.find((item) => String(item.key) === targetId);
        return match?.value ?? "";
      }
    } catch {
      // If parsing fails, fall back to returning trimmed string
    }
  }

  // Fallback: return raw string
  return trimmed;
}
