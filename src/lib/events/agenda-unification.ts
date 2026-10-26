import type { BevyAgenda, BevySpeaker } from "@/lib/bevy/types";
import type { EventPresentationSlide, EventSession, SessionRelatedLink } from "@/lib/firestore/types";

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

/**
 * Determines whether an agenda payload contains at least one actual activity.
 * Guards against empty Bevy agenda shells (e.g. empty: true, or days with 0 items)
 * from overwriting populated upstream agendas.
 */
export function hasActualAgendaActivities(agenda: unknown): boolean {
  if (!agenda || typeof agenda !== "object") return false;

  const rec = agenda as Record<string, unknown>;
  if (rec.empty === true) return false;

  if (Array.isArray(agenda)) {
    return agenda.some((item) => {
      if (!item || typeof item !== "object") return false;
      const it = item as { activity?: string; items?: unknown[]; agenda?: unknown[] };
      if (it.activity?.trim()) return true;
      const subItems = it.items ?? it.agenda;
      return (
        Array.isArray(subItems) &&
        subItems.some((s) => s && typeof s === "object" && Boolean((s as { activity?: string }).activity?.trim()))
      );
    });
  }

  if ("days" in rec && Array.isArray(rec.days)) {
    return rec.days.some((day: unknown) => {
      if (!day || typeof day !== "object") return false;
      const d = day as { items?: unknown[]; agenda?: unknown[] };
      const items = d.items ?? d.agenda;
      return (
        Array.isArray(items) &&
        items.some((it) => it && typeof it === "object" && Boolean((it as { activity?: string }).activity?.trim()))
      );
    });
  }

  return false;
}

/**
 * Resolves the full display name for a Bevy speaker across different API structures
 * (handles full_name, first_name + last_name, or legacy name fields).
 */
export function getSpeakerFullName(speaker?: BevySpeaker | null): string {
  if (!speaker) return "";
  if (speaker.full_name && speaker.full_name.trim().length > 0) {
    return speaker.full_name.trim();
  }
  const rawName = `${speaker.first_name ?? ""} ${speaker.last_name ?? ""}`.trim();
  if (rawName.length > 0) return rawName;
  const legacyName = (speaker as unknown as { name?: string }).name?.trim();
  if (legacyName) return legacyName;
  return "";
}

/**
 * Resolves the role and company attribution string for a Bevy speaker.
 */
export function getSpeakerRole(speaker?: BevySpeaker | null): string {
  if (!speaker) return "";
  return [speaker.title?.trim(), speaker.company?.trim()].filter(Boolean).join(" @ ");
}

/**
 * Resolves the best available avatar URL for a Bevy speaker.
 */
export function getSpeakerAvatar(speaker?: BevySpeaker | null): string | undefined {
  if (!speaker) return undefined;
  return (
    speaker.picture?.url ||
    speaker.picture?.thumbnail_url ||
    speaker.picture_url ||
    (speaker as unknown as { picture_url?: string }).picture_url ||
    undefined
  );
}

/**
 * Matches a query string (name or text) against a list of Bevy speakers.
 */
export function findSpeakerByNameOrRole(
  nameOrQuery?: string | null,
  speakers?: BevySpeaker[] | null,
): BevySpeaker | null {
  if (!speakers || speakers.length === 0 || !nameOrQuery?.trim()) return null;
  const normQuery = normalizeStr(nameOrQuery);
  if (!normQuery) return null;

  // 1. Exact match by full name
  for (const sp of speakers) {
    const fullName = getSpeakerFullName(sp);
    if (fullName && normalizeStr(fullName) === normQuery) {
      return sp;
    }
  }

  // 2. Substring / contains match by full name (minimum 3 chars)
  for (const sp of speakers) {
    const fullName = getSpeakerFullName(sp);
    const normName = normalizeStr(fullName);
    if (
      normName &&
      normName.length >= 3 &&
      (normQuery.includes(normName) || normName.includes(normQ(normQuery, normName)))
    ) {
      return sp;
    }
  }

  return null;
}

function normQ(query: string, name: string): string {
  return query.length >= 3 && query.includes(name) ? name : "";
}

export function findMatchingSpeaker(
  text: string,
  speakers?: BevySpeaker[] | null,
): { speakerName?: string; speakerRole?: string; speakerAvatar?: string; cleanDescription?: string } | null {
  if (!speakers || speakers.length === 0 || !text) return null;

  for (const sp of speakers) {
    const fullName = getSpeakerFullName(sp);
    if (!fullName) continue;

    // Check if full name is in text (case-insensitive)
    const idx = text.toLowerCase().indexOf(fullName.toLowerCase());
    if (idx !== -1) {
      const avatar = getSpeakerAvatar(sp);
      const role = getSpeakerRole(sp);

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
      const matched = findSpeakerByNameOrRole(extractedName, speakers);
      return {
        speakerName: extractedName,
        speakerRole: extractedRole || (matched ? getSpeakerRole(matched) : undefined) || undefined,
        speakerAvatar: matched ? getSpeakerAvatar(matched) : undefined,
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
  presentationSlides?: EventPresentationSlide[] | null,
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

        // 1. Check for slides specifically bound to this Bevy agenda activity
        const matchedSlide = presentationSlides?.find((slide) => {
          if (
            slide.agenda_activity_id &&
            (slide.agenda_activity_id === rawItem.activity || slide.agenda_activity_id === `item-${dIdx}-${iIdx}`)
          ) {
            return true;
          }
          const normSlideTitle = normalizeStr(slide.title);
          if (!normActivity || !normSlideTitle) return false;
          if (normActivity === normSlideTitle) return true;
          if (
            normSlideTitle.length >= 6 &&
            (normActivity.includes(normSlideTitle) || normSlideTitle.includes(normActivity))
          ) {
            return true;
          }
          if (rawItem.time && slide.time_slot) {
            const rawTimeNorm = normalizeStr(rawItem.time);
            const slideTimeNorm = normalizeStr(slide.time_slot);
            if (rawTimeNorm === slideTimeNorm) {
              const actWords = normActivity.split(" ").filter((w) => w.length > 3);
              return actWords.some((w) => normSlideTitle.includes(w));
            }
          }
          return false;
        });

        // 2. Fallback to matched breakout session if any (legacy compatibility)
        let speakerMatch =
          findMatchingSpeaker(rawItem.description || "", speakers) ??
          findMatchingSpeaker(rawItem.activity, speakers) ??
          (matchedSlide?.speaker_name ? { speakerName: matchedSlide.speaker_name } : null) ??
          (matchedItemSess?.speaker_name ? { speakerName: matchedItemSess.speaker_name } : null) ??
          (matchedDaySess?.speaker_name ? { speakerName: matchedDaySess.speaker_name } : null);

        // If speaker matched from slide/session without role or avatar, enrich from Bevy speaker list
        if (speakerMatch?.speakerName && (!speakerMatch.speakerRole || !speakerMatch.speakerAvatar)) {
          const detailSpeaker = findSpeakerByNameOrRole(speakerMatch.speakerName, speakers);
          if (detailSpeaker) {
            speakerMatch = {
              ...speakerMatch,
              speakerRole: speakerMatch.speakerRole || getSpeakerRole(detailSpeaker) || undefined,
              speakerAvatar: speakerMatch.speakerAvatar || getSpeakerAvatar(detailSpeaker),
            };
          }
        }

        const slidesUrl = matchedSlide?.slides_url || matchedItemSess?.slides_url || rawItem.slides_url;
        const slidesTitle =
          matchedSlide?.slides_title || matchedItemSess?.slides_title || rawItem.slides_title || "Open Slides";
        const relatedLinks =
          matchedSlide?.related_links && matchedSlide.related_links.length > 0
            ? matchedSlide.related_links
            : matchedItemSess?.related_links && matchedItemSess.related_links.length > 0
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
