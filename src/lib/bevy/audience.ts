export type EventAudienceType = "IN_PERSON" | "VIRTUAL" | "HYBRID";

export interface EventAudienceInfo {
  audienceType: EventAudienceType;
  isVirtual: boolean;
  isHybrid: boolean;
  isInPerson: boolean;
  label: string;
}

/**
 * Resolves the canonical audience type and virtual flag for an event.
 *
 * NOTE: Bevy's API often returns `is_virtual_event: true` even for in-person events
 * because virtual stage/platform capabilities are provisioned by default.
 * Therefore, `audience_type` ("IN_PERSON", "VIRTUAL", "HYBRID") must always
 * take precedence over `is_virtual_event`.
 */
export function resolveEventAudience(
  rawAudienceType?: string | null,
  isVirtualEvent?: boolean | null,
): EventAudienceInfo {
  const normalized = (rawAudienceType ?? "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");

  if (normalized === "VIRTUAL") {
    return {
      audienceType: "VIRTUAL",
      isVirtual: true,
      isHybrid: false,
      isInPerson: false,
      label: "Virtual",
    };
  }

  if (normalized === "HYBRID") {
    return {
      audienceType: "HYBRID",
      isVirtual: false,
      isHybrid: true,
      isInPerson: false,
      label: "Hybrid",
    };
  }

  if (normalized === "IN_PERSON") {
    return {
      audienceType: "IN_PERSON",
      isVirtual: false,
      isHybrid: false,
      isInPerson: true,
      label: "In-Person",
    };
  }

  // Fallback when audience_type is missing or unspecified
  if (isVirtualEvent) {
    return {
      audienceType: "VIRTUAL",
      isVirtual: true,
      isHybrid: false,
      isInPerson: false,
      label: "Virtual",
    };
  }

  return {
    audienceType: "IN_PERSON",
    isVirtual: false,
    isHybrid: false,
    isInPerson: true,
    label: "In-Person",
  };
}
