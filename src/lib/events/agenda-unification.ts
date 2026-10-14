import type { BevyAgenda, BevySpeaker } from "@/lib/bevy/types";
import type { EventSession, SessionRelatedLink } from "@/lib/firestore/types";

// Maintain UnifiedSessionTrack as an alias/type for backwards compatibility if imported
export interface UnifiedSessionTrack {
  id: string;
  trackNumber?: number;
  trackName: string;
  title: string;
  speakerName?: string;
  speakerRole?: string;
  speakerAvatar?: string;
  description?: string;
  timeSlot?: string;
  checkinDeadline?: string;
  location?: string;
  locationUrl?: string;
  capacity?: number;
  totalRegistered?: number;
  slidesUrl?: string;
  slidesTitle?: string;
  relatedLinks?: Array<{ title: string; url: string }>;
}

export interface UnifiedAgendaItem {
  id: string;
  time: string;
  activity: string;
  description?: string;
  cleanDescription?: string;
  audienceType?: string;
  speakerName?: string;
  speakerRole?: string;
  speakerAvatar?: string;
  slidesUrl?: string;
  slidesTitle?: string;
  relatedLinks?: Array<{ title: string; url: string }>;
}

export interface UnifiedAgendaSessionGroup {
  id: string;
  sessionTitle: string;
  timeRange?: string;
  checkinDeadline?: string;
  location?: string;
  locationUrl?: string;
  capacity?: number;
  totalRegistered?: number;
  description?: string;
  slidesUrl?: string;
  slidesTitle?: string;
  relatedLinks?: SessionRelatedLink[];
  items: UnifiedAgendaItem[];
}

export interface UnifiedAgendaResult {
  sessionGroups: UnifiedAgendaSessionGroup[];
  hasMultipleSessions: boolean;
  totalItemsCount: number;
}

function normalizeStr(str?: string | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchingSpeaker(
  text: string,
  speakers?: BevySpeaker[] | null,
): { speakerName?: string; speakerRole?: string; speakerAvatar?: string; cleanDescription?: string } | null {
  if (!speakers || speakers.length === 0 || !text) return null;

  for (const sp of speakers) {
    const fullName = `${sp.first_name || ""} ${sp.last_name || ""}`.trim();
    if (!fullName) continue;

    // Check if full name is in text (case-insensitive)
    const idx = text.toLowerCase().indexOf(fullName.toLowerCase());
    if (idx !== -1) {
      const avatar =
        sp.picture?.url ||
        sp.picture?.thumbnail_url ||
        (sp as unknown as { picture_url?: string }).picture_url ||
        undefined;

      const role = [sp.title, sp.company].filter(Boolean).join(" @ ");

      return {
        speakerName: fullName,
        speakerRole: role || undefined,
        speakerAvatar: avatar,
      };
    }
  }

  // Also check if text has "from <Speaker Name>, <Role>" pattern
  const fromMatch = text.match(/\bfrom\s+([^,]+)(?:,\s*([^.]+))?/i);
  if (fromMatch?.[1]) {
    const extractedName = fromMatch[1].trim();
    const extractedRole = fromMatch[2]?.trim();
    if (extractedName && extractedName.length < 50) {
      return {
        speakerName: extractedName,
        speakerRole: extractedRole || undefined,
      };
    }
  }

  return null;
}

function formatTimeRange(items: Array<{ time: string }>): string | undefined {
  if (items.length === 0) return undefined;
  const first = items[0]?.time;
  const last = items[items.length - 1]?.time;
  if (!first) return undefined;
  if (!last || first === last) return first;
  return `${first} – ${last}`;
}

/**
 * Builds a unified, deduplicated agenda structure mapping Bevy agenda days directly
 * to Firestore sessions. Eliminates track mismatch by recognizing that Bevy days
 * represent sessions, binding session-level metadata directly to session group headers,
 * and mapping Bevy items as the activities within that session.
 */
export function buildUnifiedAgenda(
  bevyAgenda?: BevyAgenda | null,
  speakers?: BevySpeaker[] | null,
  firestoreSessions?: EventSession[] | null,
): UnifiedAgendaResult {
  const sessions = Array.isArray(firestoreSessions) ? [...firestoreSessions] : [];
  const days = Array.isArray(bevyAgenda?.days) ? bevyAgenda.days : [];

  const matchedSessionIds = new Set<string>();
  const sessionGroups: UnifiedAgendaSessionGroup[] = [];

  // Case 1: Standard Bevy Days are available
  if (days.length > 0) {
    days.forEach((day, dIdx) => {
      const rawItems = day.items ?? day.agenda ?? [];
      const dayTitle = day.title?.trim() || "";
      const normDayTitle = normalizeStr(dayTitle);

      // Attempt matching with an available Firestore session:
      // (a) Exact or normalized title match
      // (b) Substring match (e.g. "Morning Session" in "Day 1 - Morning Session")
      let matchedSess = sessions.find((sess) => {
        if (matchedSessionIds.has(sess.id)) return false;
        const normSessTitle = normalizeStr(sess.title);
        return (
          normSessTitle &&
          normDayTitle &&
          (normDayTitle === normSessTitle ||
            normDayTitle.includes(normSessTitle) ||
            normSessTitle.includes(normDayTitle))
        );
      });

      // (c) Position-based fallback if count matches and no match found yet
      if (
        !matchedSess &&
        days.length === sessions.length &&
        sessions[dIdx] &&
        !matchedSessionIds.has(sessions[dIdx].id)
      ) {
        matchedSess = sessions[dIdx];
      }

      if (matchedSess) {
        matchedSessionIds.add(matchedSess.id);
      }

      // Map raw Bevy items to UnifiedAgendaItem
      const unifiedItems: UnifiedAgendaItem[] = rawItems.map((rawItem, iIdx) => {
        const speakerMatch =
          findMatchingSpeaker(rawItem.description || "", speakers) ??
          findMatchingSpeaker(rawItem.activity, speakers) ??
          (matchedSess?.speaker_name ? { speakerName: matchedSess.speaker_name } : null);

        return {
          id: `item-${dIdx}-${iIdx}-${rawItem.time}`,
          time: rawItem.time,
          activity: rawItem.activity,
          description: rawItem.description,
          audienceType: rawItem.audience_type,
          speakerName: speakerMatch?.speakerName,
          speakerRole: speakerMatch?.speakerRole,
          speakerAvatar: speakerMatch?.speakerAvatar,
          slidesUrl: rawItem.slides_url,
          slidesTitle: rawItem.slides_title,
          relatedLinks: rawItem.related_links,
        };
      });

      const effectiveTitle =
        matchedSess?.title || dayTitle || (days.length > 1 ? `Session ${dIdx + 1}` : "Agenda Schedule");

      const effectiveTimeRange = matchedSess?.time_slot || formatTimeRange(rawItems);

      sessionGroups.push({
        id: matchedSess ? `session-${matchedSess.id}` : `session-group-${dIdx}`,
        sessionTitle: effectiveTitle,
        timeRange: effectiveTimeRange,
        checkinDeadline: matchedSess?.checkin_deadline,
        location: matchedSess?.location,
        locationUrl: matchedSess?.location_url,
        capacity: matchedSess?.capacity,
        totalRegistered: matchedSess?.total_registered,
        description: matchedSess?.description,
        slidesUrl: matchedSess?.slides_url,
        slidesTitle: matchedSess?.slides_title,
        relatedLinks: matchedSess?.related_links,
        items: unifiedItems,
      });
    });
  }

  // Case 2: Any remaining unmatched Firestore sessions
  const remainingSessions = sessions.filter((s) => !matchedSessionIds.has(s.id));
  if (remainingSessions.length > 0) {
    remainingSessions.forEach((sess) => {
      sessionGroups.push({
        id: `session-${sess.id}`,
        sessionTitle: sess.title,
        timeRange: sess.time_slot,
        checkinDeadline: sess.checkin_deadline,
        location: sess.location,
        locationUrl: sess.location_url,
        capacity: sess.capacity,
        totalRegistered: sess.total_registered,
        description: sess.description,
        slidesUrl: sess.slides_url,
        slidesTitle: sess.slides_title,
        relatedLinks: sess.related_links,
        items: [],
      });
    });
  }

  const totalItemsCount = sessionGroups.reduce((acc, g) => acc + g.items.length, 0);

  return {
    sessionGroups,
    hasMultipleSessions: sessionGroups.length > 1,
    totalItemsCount,
  };
}
