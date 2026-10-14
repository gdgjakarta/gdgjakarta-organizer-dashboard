import type { BevyAgenda, BevySpeaker } from "@/lib/bevy/types";
import type { EventSession } from "@/lib/firestore/types";

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
  isBreakoutSlot: boolean;
  tracks: UnifiedSessionTrack[];
  location?: string;
  locationUrl?: string;
  checkinDeadline?: string;
  slidesUrl?: string;
  slidesTitle?: string;
  relatedLinks?: Array<{ title: string; url: string }>;
}

export interface UnifiedAgendaSessionGroup {
  id: string;
  sessionTitle: string;
  timeRange?: string;
  items: UnifiedAgendaItem[];
  availableTracks: Array<{ id: string; name: string; number: number }>;
}

export interface UnifiedAgendaResult {
  sessionGroups: UnifiedAgendaSessionGroup[];
  hasMultipleSessions: boolean;
  allAvailableTracks: Array<{ id: string; name: string; number: number }>;
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
 * Builds a unified, deduplicated agenda structure from Bevy agenda days,
 * Bevy speakers, and Firestore sessions.
 */
export function buildUnifiedAgenda(
  bevyAgenda?: BevyAgenda | null,
  speakers?: BevySpeaker[] | null,
  firestoreSessions?: EventSession[] | null,
): UnifiedAgendaResult {
  const sessions = Array.isArray(firestoreSessions) ? [...firestoreSessions] : [];
  const days = Array.isArray(bevyAgenda?.days) ? bevyAgenda.days : [];

  const matchedSessionIds = new Set<string>();
  const allTracksMap = new Map<string, { id: string; name: string; number: number }>();

  // Helper to extract or register a track
  const getOrRegisterTrack = (sess: EventSession, index: number): UnifiedSessionTrack => {
    matchedSessionIds.add(sess.id);

    let trackNumber = index + 1;
    let trackName = `Track #${trackNumber}`;

    if (sess.time_slot?.toLowerCase().includes("track")) {
      const match = sess.time_slot.match(/track\s*#?(\d+)/i);
      if (match?.[1]) {
        trackNumber = Number.parseInt(match[1], 10);
        trackName = `Track #${trackNumber}`;
      } else {
        trackName = sess.time_slot;
      }
    }

    if (!allTracksMap.has(trackName)) {
      allTracksMap.set(trackName, {
        id: trackName.toLowerCase().replace(/[^\w]/g, "-"),
        name: trackName,
        number: trackNumber,
      });
    }

    return {
      id: sess.id,
      trackNumber,
      trackName,
      title: sess.title,
      speakerName: sess.speaker_name,
      description: sess.description,
      timeSlot: sess.time_slot,
      checkinDeadline: sess.checkin_deadline,
      location: sess.location,
      locationUrl: sess.location_url,
      capacity: sess.capacity,
      totalRegistered: sess.total_registered,
      slidesUrl: sess.slides_url,
      slidesTitle: sess.slides_title,
      relatedLinks: sess.related_links,
    };
  };

  const sessionGroups: UnifiedAgendaSessionGroup[] = [];

  // Case 1: Standard Bevy Days are available
  if (days.length > 0) {
    days.forEach((day, dIdx) => {
      const rawItems = day.items ?? day.agenda ?? [];
      if (rawItems.length === 0) return;

      const groupTracksMap = new Map<string, { id: string; name: string; number: number }>();
      const unifiedItems: UnifiedAgendaItem[] = [];

      rawItems.forEach((rawItem, iIdx) => {
        const normActivity = normalizeStr(rawItem.activity);
        const normTime = normalizeStr(rawItem.time);

        // Try to match with Firestore session(s)
        const matchedSessions = sessions.filter((sess) => {
          if (matchedSessionIds.has(sess.id)) return false;
          const normSessTitle = normalizeStr(sess.title);
          const normSessTime = normalizeStr(sess.time_slot);

          // Direct title match or title contains
          if (
            normSessTitle &&
            (normActivity === normSessTitle ||
              normActivity.includes(normSessTitle) ||
              normSessTitle.includes(normActivity))
          ) {
            return true;
          }

          // Same time match if session has time
          if (
            normSessTime &&
            normTime &&
            (normSessTime === normTime || normSessTime.startsWith(normTime) || normTime.startsWith(normSessTime))
          ) {
            return true;
          }

          return false;
        });

        const tracks: UnifiedSessionTrack[] = [];
        for (let sIdx = 0; sIdx < matchedSessions.length; sIdx++) {
          const sess = matchedSessions[sIdx];
          const track = getOrRegisterTrack(sess, allTracksMap.size);
          tracks.push(track);
          groupTracksMap.set(track.trackName, {
            id: track.id,
            name: track.trackName,
            number: track.trackNumber ?? 1,
          });
        }

        // Speaker discovery from activity/description and speakers list
        const speakerMatch =
          findMatchingSpeaker(rawItem.description || "", speakers) ?? findMatchingSpeaker(rawItem.activity, speakers);

        const primaryTrack = tracks[0];

        const item: UnifiedAgendaItem = {
          id: `item-${dIdx}-${iIdx}-${rawItem.time}`,
          time: rawItem.time,
          activity: rawItem.activity,
          description: rawItem.description,
          audienceType: rawItem.audience_type,
          speakerName: primaryTrack?.speakerName ?? speakerMatch?.speakerName,
          speakerRole: primaryTrack?.speakerRole ?? speakerMatch?.speakerRole,
          speakerAvatar: primaryTrack?.speakerAvatar ?? speakerMatch?.speakerAvatar,
          isBreakoutSlot: tracks.length > 1,
          tracks,
          location: primaryTrack?.location,
          locationUrl: primaryTrack?.locationUrl,
          checkinDeadline: primaryTrack?.checkinDeadline,
          slidesUrl: primaryTrack?.slidesUrl ?? rawItem.slides_url,
          slidesTitle: primaryTrack?.slidesTitle ?? rawItem.slides_title,
          relatedLinks: primaryTrack?.relatedLinks ?? rawItem.related_links,
        };

        unifiedItems.push(item);
      });

      const dayTitle = day.title?.trim() || (days.length > 1 ? `Day ${dIdx + 1}` : "Agenda Schedule");

      sessionGroups.push({
        id: `session-group-${dIdx}`,
        sessionTitle: dayTitle,
        timeRange: formatTimeRange(rawItems),
        items: unifiedItems,
        availableTracks: Array.from(groupTracksMap.values()).sort((a, b) => a.number - b.number),
      });
    });
  }

  // Any remaining unmatched Firestore sessions
  const remainingSessions = sessions.filter((s) => !matchedSessionIds.has(s.id));
  if (remainingSessions.length > 0) {
    if (sessionGroups.length === 0) {
      // No Bevy agenda at all: create session group from Firestore sessions
      const tracks: UnifiedSessionTrack[] = [];
      const items: UnifiedAgendaItem[] = remainingSessions.map((sess, idx) => {
        const track = getOrRegisterTrack(sess, idx);
        tracks.push(track);

        return {
          id: `fs-sess-${sess.id}`,
          time: sess.time_slot || `Track #${idx + 1}`,
          activity: sess.title,
          description: sess.description,
          speakerName: sess.speaker_name,
          isBreakoutSlot: false,
          tracks: [track],
          location: sess.location,
          locationUrl: sess.location_url,
          checkinDeadline: sess.checkin_deadline,
          slidesUrl: sess.slides_url,
          slidesTitle: sess.slides_title,
          relatedLinks: sess.related_links,
        };
      });

      sessionGroups.push({
        id: "session-group-fs",
        sessionTitle: "Event Agenda & Sessions",
        timeRange: formatTimeRange(items),
        items,
        availableTracks: Array.from(allTracksMap.values()).sort((a, b) => a.number - b.number),
      });
    } else {
      // Append remaining sessions to the last group or appropriate group
      const targetGroup = sessionGroups[sessionGroups.length - 1];
      remainingSessions.forEach((sess) => {
        const track = getOrRegisterTrack(sess, allTracksMap.size);
        targetGroup.items.push({
          id: `fs-sess-${sess.id}`,
          time: sess.time_slot || `Track #${track.trackNumber}`,
          activity: sess.title,
          description: sess.description,
          speakerName: sess.speaker_name,
          isBreakoutSlot: false,
          tracks: [track],
          location: sess.location,
          locationUrl: sess.location_url,
          checkinDeadline: sess.checkin_deadline,
          slidesUrl: sess.slides_url,
          slidesTitle: sess.slides_title,
          relatedLinks: sess.related_links,
        });
      });
    }
  }

  const allAvailableTracks = Array.from(allTracksMap.values()).sort((a, b) => a.number - b.number);
  const totalItemsCount = sessionGroups.reduce((acc, g) => acc + g.items.length, 0);

  return {
    sessionGroups,
    hasMultipleSessions: sessionGroups.length > 1,
    allAvailableTracks,
    totalItemsCount,
  };
}
