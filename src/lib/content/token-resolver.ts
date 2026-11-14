import type { PartnershipStat } from "./types";

/**
 * Resolves stat parameter tokens inside text.
 * Supported token formats:
 * - {{stat:<id>}} e.g. {{stat:stat-1}}
 * - {{stat:<index>}} e.g. {{stat:0}}
 * - {{members}} or {{events}} or {{team}}
 * - {{<label>}} case-insensitive e.g. {{Dev Community Members}} or {{Total Activities}}
 */
export function resolveStatTokens(text: string, stats: PartnershipStat[] = []): string {
  if (!text) return "";

  return text.replace(/\{\{([^}]+)\}\}/g, (match, rawKey) => {
    const key = rawKey.trim();

    // 1. Direct stat ID: {{stat:stat-1}} or {{id:stat-1}}
    if (key.startsWith("stat:") || key.startsWith("id:")) {
      const idOrIndex = key.slice(key.indexOf(":") + 1).trim();
      const byId = stats.find((s) => s.id === idOrIndex);
      if (byId) return byId.value;

      const num = Number.parseInt(idOrIndex, 10);
      if (!Number.isNaN(num) && stats[num]) {
        return stats[num].value;
      }
    }

    // 2. Named auto-sync alias: {{members}}, {{events}}, {{team}}
    const lowerKey = key.toLowerCase();
    if (lowerKey === "members" || lowerKey === "member" || lowerKey === "community members") {
      const memberStat = stats.find(
        (s) => s.autoSyncMetric === "members" || s.id === "stat-1" || s.label.toLowerCase().includes("member"),
      );
      if (memberStat) return memberStat.value;
    }
    if (lowerKey === "events" || lowerKey === "event" || lowerKey === "activities") {
      const eventStat = stats.find(
        (s) => s.autoSyncMetric === "events" || s.id === "stat-3" || s.label.toLowerCase().includes("activities"),
      );
      if (eventStat) return eventStat.value;
    }
    if (lowerKey === "team" || lowerKey === "organizers") {
      const teamStat = stats.find((s) => s.autoSyncMetric === "team" || s.label.toLowerCase().includes("organizer"));
      if (teamStat) return teamStat.value;
    }

    // 3. Match by exact label or stat ID directly
    const byIdDirect = stats.find((s) => s.id === key);
    if (byIdDirect) return byIdDirect.value;

    const byLabel = stats.find((s) => s.label.toLowerCase() === lowerKey);
    if (byLabel) return byLabel.value;

    return match;
  });
}

export interface EventTokenContext {
  title?: string;
  formattedDate?: string;
  formattedHours?: string;
  venueName?: string;
  venueAddress?: string;
  totalCapacity?: number | string;
  totalAttendees?: number | string;
}

/**
 * Resolves event parameter tokens inside text (e.g. for highlight cards or descriptions).
 * Supported token formats:
 * - {{event:date}} or {{event_date}} -> e.g. "Sun, 1 Nov 2026"
 * - {{event:hours}} or {{event:time}} or {{event_hours}} -> e.g. "09:00 - 18:00 WIB"
 * - {{event:title}} or {{event_title}} -> e.g. "DevFest Jakarta 2026"
 * - {{event:venue}} or {{event_venue}} -> e.g. "Jakarta, Indonesia"
 * - {{event:capacity}} -> e.g. "1,500+"
 */
export function resolveEventTokens(text: string, context?: EventTokenContext): string {
  if (!text || !context) return text || "";

  return text.replace(/\{\{([^}]+)\}\}/g, (match, rawKey) => {
    const key = rawKey.trim().toLowerCase().replace(/[-_]/g, ":");

    if (key === "event:date" || key === "eventdate" || key === "date") {
      return context.formattedDate || match;
    }
    if (
      key === "event:hours" ||
      key === "event:time" ||
      key === "eventhours" ||
      key === "eventtime" ||
      key === "hours" ||
      key === "time"
    ) {
      return context.formattedHours || match;
    }
    if (key === "event:title" || key === "eventtitle" || key === "title") {
      return context.title || match;
    }
    if (key === "event:venue" || key === "eventvenue" || key === "venue") {
      return context.venueName || match;
    }
    if (
      key === "event:venue_address" ||
      key === "event:venueaddress" ||
      key === "venue_address" ||
      key === "venueaddress"
    ) {
      return context.venueAddress || context.venueName || match;
    }
    if (key === "event:attendees" || key === "event:attendee" || key === "attendees") {
      return context.totalAttendees ? `${context.totalAttendees}+` : match;
    }
    if (key === "event:capacity" || key === "capacity") {
      return context.totalCapacity ? `${context.totalCapacity}+` : match;
    }

    return match;
  });
}
