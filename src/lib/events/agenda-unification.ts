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

export function normalizeStr(str?: string | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findMatchingSpeaker(
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

      // Attempt matching with an available Firestore session for the Day Group Header:
      // A session only matches at the Day level if it doesn't match an activity item inside the day.
      let matchedDaySess = sessions.find((sess) => {
        if (matchedSessionIds.has(sess.id)) return false;
        const normSessTitle = normalizeStr(sess.title);
        if (!normSessTitle || !normDayTitle) return false;

        // Check if this session matches any rawItem activity instead
        const matchesActivity = rawItems.some((item) => {
          const normAct = normalizeStr(item.activity);
          return normAct === normSessTitle || (normSessTitle.length >= 6 && normAct.includes(normSessTitle));
        });
        if (matchesActivity) return false;

        return (
          normDayTitle === normSessTitle || normDayTitle.includes(normSessTitle) || normSessTitle.includes(normDayTitle)
        );
      });

      // Position-based fallback if count matches, day title didn't match, and session doesn't match an activity
      if (
        !matchedDaySess &&
        days.length === sessions.length &&
        sessions[dIdx] &&
        !matchedSessionIds.has(sessions[dIdx].id)
      ) {
        const matchesActivity = rawItems.some((item) => {
          const normAct = normalizeStr(item.activity);
          const normSessTitle = normalizeStr(sessions[dIdx].title);
          return normAct === normSessTitle || (normSessTitle.length >= 6 && normAct.includes(normSessTitle));
        });
        if (!matchesActivity) {
          matchedDaySess = sessions[dIdx];
        }
      }

      if (matchedDaySess) {
        matchedSessionIds.add(matchedDaySess.id);
      }

      // Map raw Bevy items to UnifiedAgendaItem and bind matching Firestore session slide decks directly
      const unifiedItems: UnifiedAgendaItem[] = rawItems.map((rawItem, iIdx) => {
        const normActivity = normalizeStr(rawItem.activity);

        // Find matching session for this specific activity
        const matchedItemSess = sessions.find((sess) => {
          if (matchedSessionIds.has(sess.id)) return false;
          if (matchedDaySess && sess.id === matchedDaySess.id) return false;

          // 1. Explicit ID link if set
          if (
            sess.agenda_activity_id &&
            (sess.agenda_activity_id === rawItem.activity || sess.agenda_activity_id === `item-${dIdx}-${iIdx}`)
          ) {
            return true;
          }

          const normSessTitle = normalizeStr(sess.title);
          if (!normActivity || !normSessTitle) return false;

          // 2. Exact activity title match
          if (normActivity === normSessTitle) return true;

          // 3. Substring match (min 6 characters)
          if (
            normSessTitle.length >= 6 &&
            (normActivity.includes(normSessTitle) || normSessTitle.includes(normActivity))
          ) {
            return true;
          }

          // 4. Time slot match + word overlap
          if (rawItem.time && sess.time_slot) {
            const rawTimeNorm = normalizeStr(rawItem.time);
            const sessTimeNorm = normalizeStr(sess.time_slot);
            if (rawTimeNorm === sessTimeNorm) {
              const actWords = normActivity.split(" ").filter((w) => w.length > 3);
              return actWords.some((w) => normSessTitle.includes(w));
            }
          }

          return false;
        });

        if (matchedItemSess) {
          matchedSessionIds.add(matchedItemSess.id);
        }

        const speakerMatch =
          findMatchingSpeaker(rawItem.description || "", speakers) ??
          findMatchingSpeaker(rawItem.activity, speakers) ??
          (matchedItemSess?.speaker_name ? { speakerName: matchedItemSess.speaker_name } : null) ??
          (matchedDaySess?.speaker_name ? { speakerName: matchedDaySess.speaker_name } : null);

        const slidesUrl = matchedItemSess?.slides_url || rawItem.slides_url;
        const slidesTitle = matchedItemSess?.slides_title || rawItem.slides_title || "Open Slides";
        const relatedLinks =
          matchedItemSess?.related_links && matchedItemSess.related_links.length > 0
            ? matchedItemSess.related_links
            : rawItem.related_links;

        return {
          id: `item-${dIdx}-${iIdx}-${rawItem.time}`,
          time: rawItem.time,
          activity: rawItem.activity,
          description: rawItem.description || matchedItemSess?.description,
          audienceType: rawItem.audience_type,
          speakerName: speakerMatch?.speakerName,
          speakerRole: speakerMatch?.speakerRole,
          speakerAvatar: speakerMatch?.speakerAvatar,
          slidesUrl,
          slidesTitle,
          relatedLinks,
        };
      });

      if (unifiedItems.length === 0 && !matchedDaySess) {
        return;
      }

      const effectiveTitle =
        matchedDaySess?.title || dayTitle || (days.length > 1 ? `Session ${dIdx + 1}` : "Agenda Schedule");

      const effectiveTimeRange = matchedDaySess?.time_slot || formatTimeRange(rawItems);

      sessionGroups.push({
        id: matchedDaySess ? `session-${matchedDaySess.id}` : `session-group-${dIdx}`,
        sessionTitle: effectiveTitle,
        timeRange: effectiveTimeRange,
        checkinDeadline: matchedDaySess?.checkin_deadline,
        location: matchedDaySess?.location,
        locationUrl: matchedDaySess?.location_url,
        capacity: matchedDaySess?.capacity,
        totalRegistered: matchedDaySess?.total_registered,
        description: matchedDaySess?.description,
        slidesUrl: matchedDaySess?.slides_url,
        slidesTitle: matchedDaySess?.slides_title,
        relatedLinks: matchedDaySess?.related_links,
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
