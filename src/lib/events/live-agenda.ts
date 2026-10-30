import type { BevyAgenda, BevySpeaker } from "@/lib/bevy/types";
import type { EventPresentationSlide, EventSession } from "@/lib/firestore/types";

import { buildUnifiedAgenda } from "./agenda-unification";

export const LIVE_AGENDA_TIME_ZONE = "Asia/Jakarta";
export const LIVE_AGENDA_TIME_ZONE_LABEL = "WIB";

/** Live agenda page background; applied through the `--live-agenda-bg` CSS variable. */
export const LIVE_AGENDA_BACKGROUND_URL = "https://assets.gdgjakarta.org/devfest/background.png";
export const LIVE_AGENDA_LOGO_URL = "https://assets.gdgjakarta.org/devfest/devfest-logo.png";

export const LIVE_AGENDA_VENUE_MAP_URL = "https://assets.gdgjakarta.org/devfest/instagram-post-21.png";
/** Public event page with the full agenda, linked under the live highlights. */
export const LIVE_AGENDA_FULL_AGENDA_PATH = "/events/132640";
export const LIVE_AGENDA_FEEDBACK_URL = "http://gdgjakarta.org/feedback";

const DEFAULT_LAST_ITEM_MINUTES = 60;
const GENERIC_STAGE_TITLES = new Set(["agenda schedule", "event agenda schedule"]);

/** Serializable agenda item handed from the server page to the client view. */
export interface LiveAgendaItem {
  id: string;
  activity: string;
  /** Raw time label as organizers typed it, e.g. "09:05 WIB - 09:45 WIB". */
  time: string;
}

export interface LiveAgendaStage {
  id: string;
  eventId: string;
  /** Display name without the "Track" suffix, e.g. "Conference". */
  name: string;
  items: LiveAgendaItem[];
}

export type LiveAgendaStatus = "live" | "upcoming" | "finished";

export interface LiveAgendaHighlight {
  item: LiveAgendaItem;
  status: LiveAgendaStatus;
  startMinutes: number;
  endMinutes: number;
}

const TIME_PATTERN = /(\d{1,2})[:.](\d{2})\s*([ap]\.?m\.?)?/gi;
const ZONE_OFFSETS_FROM_WIB: Record<string, number> = { WIB: 0, WITA: 60, WIT: 120 };

function to24Hour(hour: number, minute: number, meridiem?: string): number | null {
  if (minute > 59) return null;
  let h = hour;
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    const isPm = meridiem.toLowerCase().startsWith("p");
    h = (h % 12) + (isPm ? 12 : 0);
  } else if (h > 23) {
    return null;
  }
  return h * 60 + minute;
}

function zoneShiftMinutes(label: string): number {
  const match = label.match(/\b(WIB|WITA|WIT)\b/i);
  return match ? (ZONE_OFFSETS_FROM_WIB[match[1].toUpperCase()] ?? 0) : 0;
}

/**
 * Parses an organizer-typed time label ("09:05 WIB", "08:15 - 12:00", "9:00 AM – 10:30 AM")
 * into minutes since midnight in WIB. `end` is null when the label only has a start time.
 */
export function parseTimeLabel(label: string): { start: number; end: number | null } | null {
  const shift = zoneShiftMinutes(label);
  const matches = [...label.matchAll(TIME_PATTERN)];
  if (matches.length === 0) return null;

  const [first, second] = matches;
  // "9:00 - 10:00 PM": the first time borrows the meridiem of the second one.
  let start = to24Hour(Number(first[1]), Number(first[2]), first[3] ?? second?.[3]);
  if (start === null) return null;

  let end: number | null = null;
  if (second) {
    end = to24Hour(Number(second[1]), Number(second[2]), second[3]);
    // "11:00 - 1:00 PM" would otherwise make the first time land after the second one.
    if (end !== null && first[3] === undefined && second[3] && start > end) {
      start = to24Hour(Number(first[1]), Number(first[2]), "am") ?? start;
    }
  }

  return { start: start - shift, end: end === null ? null : end - shift };
}

/** Current WIB wall-clock time as minutes since midnight (fractional seconds included). */
export function getMinutesInTimeZone(date: Date, timeZone = LIVE_AGENDA_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return read("hour") * 60 + read("minute") + read("second") / 60;
}

/** `YYYY-MM-DD` of the given instant in the live agenda time zone. */
export function getDateKeyInTimeZone(date: Date | string, timeZone = LIVE_AGENDA_TIME_ZONE): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    value,
  );
}

function toStageName(title: string): string {
  return title.replace(/\s+track$/i, "").trim() || title;
}

/** Groups an event's unified agenda into stages (one per Bevy agenda day / breakout session). */
export function buildLiveAgendaStages(params: {
  eventId: string;
  eventTitle: string;
  agenda?: BevyAgenda | null;
  speakers?: BevySpeaker[] | null;
  sessions?: EventSession[] | null;
  presentationSlides?: EventPresentationSlide[] | null;
}): LiveAgendaStage[] {
  const { eventId, eventTitle, agenda, speakers, sessions, presentationSlides } = params;
  const unified = buildUnifiedAgenda(agenda, speakers, sessions, presentationSlides);

  return unified.sessionGroups
    .filter((group) => group.items.length > 0)
    .map((group) => {
      const isGeneric = GENERIC_STAGE_TITLES.has(group.sessionTitle.trim().toLowerCase());
      return {
        id: `${eventId}:${group.id}`,
        eventId,
        name: toStageName(isGeneric && !unified.hasMultipleSessions ? eventTitle : group.sessionTitle),
        items: group.items.map((item) => ({ id: item.id, activity: item.activity, time: item.time })),
      };
    });
}

/**
 * Picks the agenda the audience should look at for a stage: the one running right now,
 * otherwise the next one to start, otherwise the last one (everything is finished).
 */
export function getStageHighlight(items: LiveAgendaItem[], nowMinutes: number): LiveAgendaHighlight | null {
  const timed = items
    .flatMap((item) => {
      const parsed = parseTimeLabel(item.time);
      return parsed ? [{ item, start: parsed.start, end: parsed.end }] : [];
    })
    .sort((a, b) => a.start - b.start);

  if (timed.length === 0) return null;

  const resolved = timed.map((entry, index) => ({
    item: entry.item,
    startMinutes: entry.start,
    // A missing end time runs until the next agenda starts.
    endMinutes: entry.end ?? timed[index + 1]?.start ?? entry.start + DEFAULT_LAST_ITEM_MINUTES,
  }));

  const live = resolved.find((r) => nowMinutes >= r.startMinutes && nowMinutes < r.endMinutes);
  if (live) return { ...live, status: "live" };

  const upcoming = resolved.find((r) => r.startMinutes > nowMinutes);
  if (upcoming) return { ...upcoming, status: "upcoming" };

  return { ...resolved[resolved.length - 1], status: "finished" };
}
