import type { BevyEvent, BevySpeaker, BevySpeakerGroup } from "./types";

/**
 * Supported Bevy participant roles in hierarchical presentation order.
 */
export const SPEAKER_ROLES_CONFIG = [
  { key: "speakers", title: "Speakers" },
  { key: "panelists", title: "Panelists" },
  { key: "moderators", title: "Moderators" },
  { key: "facilitators", title: "Facilitators" },
  { key: "hosts", title: "Hosts" },
  { key: "mentors", title: "Mentors" },
  { key: "judges", title: "Judges" },
] as const;

export type SpeakerRoleKey = (typeof SPEAKER_ROLES_CONFIG)[number]["key"];

/**
 * Resolves a Bevy speaker LinkedIn page or handle to a full valid URL.
 * Handles both full URLs (e.g. "https://www.linkedin.com/in/tanabee")
 * and raw handles (e.g. "tanabee", "irwanprabowo").
 */
export function resolveLinkedInUrl(pageOrUrl?: string | null): string | null {
  if (!pageOrUrl) return null;
  const trimmed = pageOrUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Strip leading slashes or "@"
  const cleanHandle = trimmed.replace(/^[/@]+/, "");
  return `https://www.linkedin.com/in/${cleanHandle}`;
}

/**
 * Resolves a Bevy speaker Twitter/X handle or URL to a full valid URL.
 */
export function resolveTwitterUrl(handleOrUrl?: string | null): string | null {
  if (!handleOrUrl) return null;
  const trimmed = handleOrUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const cleanHandle = trimmed.replace(/^[/@]+/, "");
  return `https://x.com/${cleanHandle}`;
}

/**
 * Resolves the full name of a speaker.
 */
export function getSpeakerFullName(speaker?: BevySpeaker | null): string {
  if (!speaker) return "";
  if (speaker.full_name && speaker.full_name.trim().length > 0) {
    return speaker.full_name.trim();
  }
  const rawName = `${speaker.first_name ?? ""} ${speaker.last_name ?? ""}`.trim();
  if (rawName.length > 0) return rawName;
  return "Speaker";
}

/**
 * Normalizes a Bevy speaker with consistent fields, full name, and resolved social URLs.
 */
export function normalizeSpeaker(speaker: BevySpeaker, defaultRoleTitle?: string): BevySpeaker {
  const fullName = getSpeakerFullName(speaker);
  const resolvedLinkedIn = speaker.linkedin_url || resolveLinkedInUrl(speaker.personal_linkedin_page) || undefined;
  const resolvedTwitter = resolveTwitterUrl(speaker.personal_twitter) || undefined;
  const avatarUrl = speaker.picture_url || speaker.picture?.url || speaker.picture?.thumbnail_url;

  return {
    ...speaker,
    full_name: fullName,
    linkedin_url: resolvedLinkedIn,
    personal_twitter: resolvedTwitter,
    picture_url: avatarUrl,
    speaker_type: speaker.speaker_type || defaultRoleTitle,
  };
}

/**
 * Extracts and groups all presenters from a Bevy event into categorized groups
 * (e.g. Speakers, Panelists, Moderators, etc.).
 */
export function extractEventSpeakerGroups(event: BevyEvent | null | undefined): BevySpeakerGroup[] {
  if (!event) return [];

  const groups: BevySpeakerGroup[] = [];

  for (const role of SPEAKER_ROLES_CONFIG) {
    const rawList = event[role.key as keyof BevyEvent];
    if (Array.isArray(rawList) && rawList.length > 0) {
      const normalizedSpeakers = (rawList as BevySpeaker[]).map((sp) => normalizeSpeaker(sp, role.title));
      groups.push({
        type: role.key,
        title: role.title,
        speakers: normalizedSpeakers,
      });
    }
  }

  return groups;
}

/**
 * Gathers a deduplicated list of all presenters (speakers, panelists, etc.) from an event.
 * Useful for timeline agenda matching and slide deck bindings.
 */
export function getAllEventSpeakers(event: BevyEvent | null | undefined): BevySpeaker[] {
  if (!event) return [];

  const groups = extractEventSpeakerGroups(event);
  const seenIds = new Set<string>();
  const all: BevySpeaker[] = [];

  for (const group of groups) {
    for (const sp of group.speakers) {
      const key = String(sp.id ?? sp.full_name ?? Math.random());
      if (!seenIds.has(key)) {
        seenIds.add(key);
        all.push(sp);
      }
    }
  }

  return all;
}

/**
 * Returns the total count of presenters across all speaker categories for an event.
 */
export function getTotalSpeakersCount(event: BevyEvent | null | undefined): number {
  if (!event) return 0;
  return extractEventSpeakerGroups(event).reduce((sum, g) => sum + g.speakers.length, 0);
}
