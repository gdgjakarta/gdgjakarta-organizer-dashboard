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
 * Extracts and groups all presenters from an event into categorized groups
 * (e.g. Speakers, Panelists, Moderators, etc.).
 * When firestoreEvent is provided, merges newly added presenters from Firestore
 * so any confirmed/added speakers not yet on Bevy immediately show on the public page.
 */
export function extractEventSpeakerGroups(
  event: BevyEvent | null | undefined,
  firestoreEvent?: Partial<BevyEvent> | null,
): BevySpeakerGroup[] {
  if (!event && !firestoreEvent) return [];

  const groups: BevySpeakerGroup[] = [];

  // Build lookup of names across other roles to avoid duplicating panelists/moderators into speakers
  const otherRoleNames = new Set<string>();
  for (const role of SPEAKER_ROLES_CONFIG) {
    if (role.key === "speakers") continue;
    const list = [
      ...(Array.isArray(event?.[role.key as keyof BevyEvent]) ? (event![role.key as keyof BevyEvent] as BevySpeaker[]) : []),
      ...(Array.isArray(firestoreEvent?.[role.key as keyof BevyEvent]) ? (firestoreEvent![role.key as keyof BevyEvent] as BevySpeaker[]) : []),
    ];
    for (const sp of list) {
      const name = (sp.full_name || sp.first_name || "").trim().toLowerCase();
      if (name) otherRoleNames.add(name);
    }
  }

  for (const role of SPEAKER_ROLES_CONFIG) {
    const bevyList = Array.isArray(event?.[role.key as keyof BevyEvent])
      ? (event![role.key as keyof BevyEvent] as BevySpeaker[])
      : [];
    const fsList = Array.isArray(firestoreEvent?.[role.key as keyof BevyEvent])
      ? (firestoreEvent![role.key as keyof BevyEvent] as BevySpeaker[])
      : [];

    const mergedList: BevySpeaker[] = [...bevyList];
    const seenNames = new Set(
      bevyList.map((s) => (s.full_name || s.first_name || "").trim().toLowerCase()).filter(Boolean),
    );
    const seenIds = new Set(
      bevyList.map((s) => (s.id ? String(s.id) : "")).filter(Boolean),
    );

    for (const sp of fsList) {
      const name = (sp.full_name || sp.first_name || "").trim().toLowerCase();
      const idStr = sp.id ? String(sp.id) : "";

      // For the generic "speakers" group, avoid adding people who belong to specialized roles (panelists/moderators)
      if (role.key === "speakers" && name && otherRoleNames.has(name)) {
        continue;
      }

      if (idStr && seenIds.has(idStr)) continue;
      if (name && seenNames.has(name)) continue;

      if (idStr) seenIds.add(idStr);
      if (name) seenNames.add(name);
      mergedList.push(sp);
    }

    if (mergedList.length > 0) {
      const normalizedSpeakers = mergedList.map((sp) => normalizeSpeaker(sp, role.title));
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
export function getAllEventSpeakers(
  event: BevyEvent | null | undefined,
  firestoreEvent?: Partial<BevyEvent> | null,
): BevySpeaker[] {
  if (!event && !firestoreEvent) return [];

  const groups = extractEventSpeakerGroups(event, firestoreEvent);
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
export function getTotalSpeakersCount(
  event: BevyEvent | null | undefined,
  firestoreEvent?: Partial<BevyEvent> | null,
): number {
  if (!event && !firestoreEvent) return 0;
  return extractEventSpeakerGroups(event, firestoreEvent).reduce((sum, g) => sum + g.speakers.length, 0);
}
