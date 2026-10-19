import { GDG_SESSION_CAPACITY_MAP } from "@/lib/events/registration-defaults";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";

export interface CapacityCheckDetails {
  capacity: number | null; // null means unlimited
  currentCount: number;
  remainingSeats: number; // Infinity if unlimited
  isFull: boolean;
  isOverreached: boolean;
}

export interface CapacityValidationResult {
  allowed: boolean;
  isWaitlist?: boolean;
  reason?: "venue_full" | "session_full";
  title: string;
  message: string;
  venue: CapacityCheckDetails;
  session?: CapacityCheckDetails & {
    id?: string;
    title: string;
  };
}

export interface BatchCapacityValidationResult {
  allowed: boolean;
  title?: string;
  message?: string;
  overreachedItems: Array<{
    type: "venue" | "session";
    title: string;
    currentApproved: number;
    maxCapacity: number;
    requestedToApprove: number;
    exceededBy: number;
  }>;
}

/**
 * Resolves maximum venue capacity from event metadata.
 * Priority:
 * 1. event.max_attendees (if > 0)
 * 2. Sum of session capacities (if multiple sessions defined with capacities)
 * 3. event.total_capacity (if synced from Bevy)
 * Returns null if unlimited.
 */
export function getEventVenueCapacity(event?: FirestoreEvent | null): number | null {
  if (!event) return null;

  if (typeof event.max_attendees === "number" && event.max_attendees > 0) {
    return event.max_attendees;
  }

  if (Array.isArray(event.sessions) && event.sessions.length > 0) {
    const totalSessionCapacity = event.sessions.reduce((acc, s) => acc + (Number(s.capacity) || 0), 0);
    if (totalSessionCapacity > 0) {
      return totalSessionCapacity;
    }
  }

  const bevyCapacity = (event as unknown as { total_capacity?: number }).total_capacity;
  if (typeof bevyCapacity === "number" && bevyCapacity > 0) {
    return bevyCapacity;
  }

  return null;
}

export interface EventCapacityStatus {
  isFull: boolean;
  venueCapacity: number | null;
  currentCount: number;
  remainingSeats: number;
  isCurated: boolean;
  allowWaitlist: boolean;
  totalWaitlisted: number;
}

/**
 * Checks overall event capacity status (venue and sessions).
 */
export function checkEventCapacityStatus(event?: FirestoreEvent | null): EventCapacityStatus {
  if (!event) {
    return {
      isFull: false,
      venueCapacity: null,
      currentCount: 0,
      remainingSeats: Number.POSITIVE_INFINITY,
      isCurated: false,
      allowWaitlist: true,
      totalWaitlisted: 0,
    };
  }

  const venueCapacity = getEventVenueCapacity(event);
  const isCurated = Boolean(event.requires_approval || event.curation_mode);
  const totalApproved = event.total_approved;
  const totalRegistered = event.total_registrations;
  const currentCount = isCurated ? totalApproved : totalRegistered;
  const totalWaitlisted = event.total_waitlisted ?? 0;
  const allowWaitlist = event.allow_waitlist !== false;

  let isFull = false;
  if (venueCapacity !== null && venueCapacity > 0) {
    if (isCurated) {
      if (totalApproved >= venueCapacity) {
        isFull = true;
      } else if (
        typeof event.max_attendees === "number" &&
        event.max_attendees > 0 &&
        totalRegistered >= event.max_attendees
      ) {
        isFull = true;
      }
    } else {
      if (totalRegistered >= venueCapacity) {
        isFull = true;
      }
    }
  }

  // Also check if all sessions or tickets are full (if multiple sessions or tickets defined)
  if (!isFull && Array.isArray(event.sessions) && event.sessions.length > 0) {
    const sessionsWithCap = event.sessions.filter((s) => typeof s.capacity === "number" && s.capacity > 0);
    if (sessionsWithCap.length > 0) {
      const allSessionsFull = sessionsWithCap.every((s) => (s.total_registered ?? 0) >= s.capacity);
      if (allSessionsFull) {
        isFull = true;
      }
    }
  }

  const remainingSeats = venueCapacity === null ? Number.POSITIVE_INFINITY : Math.max(0, venueCapacity - currentCount);

  return {
    isFull,
    venueCapacity,
    currentCount,
    remainingSeats,
    isCurated,
    allowWaitlist,
    totalWaitlisted,
  };
}

/**
 * Resolves the session key and capacity for a registration and event.
 */
export function resolveRegistrationSession(
  registration: Partial<FirestoreRegistration>,
  event?: FirestoreEvent | null,
): { sessionId?: string; sessionTitle: string; sessionCapacity: number | null } {
  const rawSession =
    registration.session_title ??
    (registration.answers?.Session as string | undefined) ??
    (registration.answers?.session as string | undefined) ??
    "";

  let sessionTitle = event?.default_session_name?.trim() || "Full Session";
  if (rawSession && typeof rawSession === "string") {
    const cleaned = rawSession.split(",")[0].trim();
    if (cleaned) {
      sessionTitle = cleaned;
    }
  } else if (event?.sessions && event.sessions.length > 0) {
    sessionTitle = event.sessions[0].title.trim() || event?.default_session_name?.trim() || "Full Session";
  }

  let matchedSessionId = registration.session_id ?? undefined;
  let sessionCapacity: number | null = null;

  // 1. Try matching session in event.sessions
  if (event?.sessions && event.sessions.length > 0) {
    const matched = event.sessions.find((s) => {
      if (registration.session_id && s.id === registration.session_id) return true;
      const sTitle = s.title.toLowerCase().trim();
      const target = sessionTitle.toLowerCase().trim();
      return sTitle === target || target.includes(sTitle) || sTitle.includes(target);
    });

    if (matched) {
      matchedSessionId = matched.id;
      sessionTitle = matched.title;
      if (typeof matched.capacity === "number" && matched.capacity > 0) {
        sessionCapacity = matched.capacity;
      }
    }
  }

  // 2. Try matching ticket tier in event.tickets if session capacity not yet found
  if (sessionCapacity === null && event?.tickets && event.tickets.length > 0) {
    const matchedTicket = event.tickets.find((t) => {
      if (registration.ticket_id && t.id === registration.ticket_id) return true;
      const tName = t.name.toLowerCase().trim();
      const target = sessionTitle.toLowerCase().trim();
      return tName === target || target.includes(tName) || tName.includes(target);
    });

    if (matchedTicket && typeof matchedTicket.capacity === "number" && matchedTicket.capacity > 0) {
      sessionCapacity = matchedTicket.capacity;
      sessionTitle = matchedTicket.name;
    }
  }

  // 3. Fallback to predefined GDG session capacity mapping if known session title
  if (sessionCapacity === null && GDG_SESSION_CAPACITY_MAP[sessionTitle]) {
    sessionCapacity = GDG_SESSION_CAPACITY_MAP[sessionTitle];
  }

  return {
    sessionId: matchedSessionId,
    sessionTitle,
    sessionCapacity,
  };
}

/**
 * Checks if a registration belongs to a given session name or ID.
 */
export function isRegistrationInSession(
  reg: FirestoreRegistration,
  sessionInfo: { sessionId?: string; sessionTitle: string },
): boolean {
  if (sessionInfo.sessionId && reg.session_id && reg.session_id === sessionInfo.sessionId) {
    return true;
  }
  if (sessionInfo.sessionId && reg.answers?.session_id && reg.answers.session_id === sessionInfo.sessionId) {
    return true;
  }

  const regSession =
    reg.session_title ??
    reg.ticket_name ??
    reg.ticket_tier ??
    (reg.answers?.Session as string | undefined) ??
    (reg.answers?.session as string | undefined) ??
    (reg.answers?.session_title as string | undefined) ??
    "";

  if (!regSession) return false;

  const regClean = regSession.toLowerCase().split(",")[0].trim();
  const targetClean = sessionInfo.sessionTitle.toLowerCase().trim();

  return regClean === targetClean || regClean.includes(targetClean) || targetClean.includes(regClean);
}

/**
 * Validates capacity before approving an attendee in the Organizer Dashboard.
 * Checks against already approved attendees ("approved" | "attended").
 */
export function validateAttendeeApprovalCapacity(params: {
  event?: FirestoreEvent | null;
  registration: FirestoreRegistration;
  registrationsList: FirestoreRegistration[];
}): CapacityValidationResult {
  const { event, registration, registrationsList } = params;

  // 1. Venue capacity evaluation
  const venueCapacity = getEventVenueCapacity(event);
  const approvedAttendees = registrationsList.filter(
    (r) => r.id !== registration.id && (r.status === "approved" || r.status === "attended"),
  );
  const currentVenueApproved = approvedAttendees.length;

  const isVenueFull = venueCapacity !== null && currentVenueApproved >= venueCapacity;
  const isVenueOverreached = venueCapacity !== null && currentVenueApproved > venueCapacity;

  const venueDetails: CapacityCheckDetails = {
    capacity: venueCapacity,
    currentCount: currentVenueApproved,
    remainingSeats:
      venueCapacity === null ? Number.POSITIVE_INFINITY : Math.max(0, venueCapacity - currentVenueApproved),
    isFull: isVenueFull,
    isOverreached: isVenueOverreached,
  };

  // 2. Session capacity evaluation
  const sessionInfo = resolveRegistrationSession(registration, event);
  let sessionDetails: (CapacityCheckDetails & { id?: string; title: string }) | undefined;

  if (sessionInfo.sessionCapacity !== null && sessionInfo.sessionCapacity > 0) {
    const approvedInSession = approvedAttendees.filter((r) => isRegistrationInSession(r, sessionInfo)).length;
    const isSessionFull = approvedInSession >= sessionInfo.sessionCapacity;
    const isSessionOverreached = approvedInSession > sessionInfo.sessionCapacity;

    sessionDetails = {
      id: sessionInfo.sessionId,
      title: sessionInfo.sessionTitle,
      capacity: sessionInfo.sessionCapacity,
      currentCount: approvedInSession,
      remainingSeats: Math.max(0, sessionInfo.sessionCapacity - approvedInSession),
      isFull: isSessionFull,
      isOverreached: isSessionOverreached,
    };
  }

  // 3. Evaluate limits: Venue check first, then Session check
  if (isVenueFull) {
    return {
      allowed: false,
      reason: "venue_full",
      title: "Venue Capacity Limit Reached",
      message: `The venue capacity of ${venueCapacity} attendees has already been reached (${currentVenueApproved}/${venueCapacity} approved). Approving this attendee would exceed the venue quota.`,
      venue: venueDetails,
      session: sessionDetails,
    };
  }

  if (sessionDetails?.isFull) {
    return {
      allowed: false,
      reason: "session_full",
      title: "Session Capacity Limit Reached",
      message: `The session track "${sessionDetails.title}" has reached its maximum capacity of ${sessionDetails.capacity} attendees (${sessionDetails.currentCount}/${sessionDetails.capacity} approved). Approving this attendee would exceed the session quota.`,
      venue: venueDetails,
      session: sessionDetails,
    };
  }

  return {
    allowed: true,
    title: "Capacity Available",
    message: "Capacity is available for this applicant.",
    venue: venueDetails,
    session: sessionDetails,
  };
}

/**
 * Validates capacity before executing a batch approval of multiple attendees.
 */
export function validateBatchApprovalCapacity(params: {
  event?: FirestoreEvent | null;
  toApprove: FirestoreRegistration[];
  registrationsList: FirestoreRegistration[];
}): BatchCapacityValidationResult {
  const { event, toApprove, registrationsList } = params;

  const venueCapacity = getEventVenueCapacity(event);
  const currentlyApproved = registrationsList.filter(
    (r) => !toApprove.some((item) => item.id === r.id) && (r.status === "approved" || r.status === "attended"),
  );

  const overreachedItems: BatchCapacityValidationResult["overreachedItems"] = [];

  // Check venue limit
  if (venueCapacity !== null && venueCapacity > 0) {
    const currentVenueCount = currentlyApproved.length;
    const requested = toApprove.length;
    if (currentVenueCount + requested > venueCapacity) {
      overreachedItems.push({
        type: "venue",
        title: "Total Event / Venue Capacity",
        currentApproved: currentVenueCount,
        maxCapacity: venueCapacity,
        requestedToApprove: requested,
        exceededBy: currentVenueCount + requested - venueCapacity,
      });
    }
  }

  // Check each session limit
  const sessionGroups = new Map<string, { info: ReturnType<typeof resolveRegistrationSession>; count: number }>();
  for (const reg of toApprove) {
    const info = resolveRegistrationSession(reg, event);
    if (info.sessionCapacity !== null && info.sessionCapacity > 0) {
      const key = info.sessionId ?? info.sessionTitle;
      const existing = sessionGroups.get(key) ?? { info, count: 0 };
      existing.count += 1;
      sessionGroups.set(key, existing);
    }
  }

  for (const [, group] of sessionGroups) {
    const { info, count } = group;
    const cap = info.sessionCapacity;
    if (cap !== null && cap > 0) {
      const currentInSession = currentlyApproved.filter((r) => isRegistrationInSession(r, info)).length;
      if (currentInSession + count > cap) {
        overreachedItems.push({
          type: "session",
          title: info.sessionTitle,
          currentApproved: currentInSession,
          maxCapacity: cap,
          requestedToApprove: count,
          exceededBy: currentInSession + count - cap,
        });
      }
    }
  }

  if (overreachedItems.length > 0) {
    const summary = overreachedItems
      .map((item) => `${item.title}: ${item.currentApproved + item.requestedToApprove}/${item.maxCapacity}`)
      .join(", ");
    return {
      allowed: false,
      title: "Capacity Exceeded for Selected Applicants",
      message: `Approving all ${toApprove.length} selected applicants would exceed capacity limits: ${summary}.`,
      overreachedItems,
    };
  }

  return {
    allowed: true,
    overreachedItems: [],
  };
}

/**
 * Validates capacity before an attendee submits the registration form in EventRegistrationModal.
 */
export function validateRegistrationSubmissionCapacity(params: {
  event: FirestoreEvent;
  selectedSessionId?: string;
  selectedTicketId?: string;
  existingRegistrationCount?: number;
}): CapacityValidationResult {
  const { event, selectedSessionId, selectedTicketId, existingRegistrationCount } = params;

  // 1. Venue capacity evaluation
  const venueCapacity = getEventVenueCapacity(event);
  const totalApproved = event.total_approved;
  const totalRegistered = existingRegistrationCount ?? event.total_registrations;

  // For curated events, if all seats are already approved, venue is full
  const isCurated = Boolean(event.requires_approval || event.curation_mode);
  let isVenueFull = false;

  if (venueCapacity !== null && venueCapacity > 0) {
    if (isCurated) {
      // If approved count reached capacity, no seats remain
      if (totalApproved >= venueCapacity) {
        isVenueFull = true;
      } else if (
        typeof event.max_attendees === "number" &&
        event.max_attendees > 0 &&
        totalRegistered >= event.max_attendees
      ) {
        // If max application submissions reached
        isVenueFull = true;
      }
    } else {
      // Open RSVP: registration count takes spots immediately
      if (totalRegistered >= venueCapacity) {
        isVenueFull = true;
      }
    }
  }

  const currentCount = isCurated ? totalApproved : totalRegistered;
  const venueDetails: CapacityCheckDetails = {
    capacity: venueCapacity,
    currentCount,
    remainingSeats: venueCapacity === null ? Number.POSITIVE_INFINITY : Math.max(0, venueCapacity - currentCount),
    isFull: isVenueFull,
    isOverreached: venueCapacity !== null && currentCount > venueCapacity,
  };

  // 2. Session capacity evaluation
  let sessionDetails: (CapacityCheckDetails & { id?: string; title: string }) | undefined;

  if (selectedSessionId && event.sessions && event.sessions.length > 0) {
    const matchingSession = event.sessions.find((s) => s.id === selectedSessionId);
    if (matchingSession) {
      const cap = matchingSession.capacity;
      const count = matchingSession.total_registered ?? 0;
      const isSessionFull = cap > 0 && count >= cap;
      sessionDetails = {
        id: matchingSession.id,
        title: matchingSession.title,
        capacity: cap > 0 ? cap : null,
        currentCount: count,
        remainingSeats: cap > 0 ? Math.max(0, cap - count) : Number.POSITIVE_INFINITY,
        isFull: isSessionFull,
        isOverreached: cap > 0 && count > cap,
      };
    }
  } else if (selectedTicketId && event.tickets && event.tickets.length > 0) {
    const matchingTicket = event.tickets.find((t) => t.id === selectedTicketId);
    if (matchingTicket && typeof matchingTicket.capacity === "number" && matchingTicket.capacity > 0) {
      const cap = matchingTicket.capacity;
      const count = matchingTicket.total_registered ?? 0;
      const isTicketFull = count >= cap;
      sessionDetails = {
        id: matchingTicket.id,
        title: matchingTicket.name,
        capacity: cap,
        currentCount: count,
        remainingSeats: Math.max(0, cap - count),
        isFull: isTicketFull,
        isOverreached: count > cap,
      };
    }
  }

  const allowWaitlist = event.allow_waitlist !== false;

  if (isVenueFull) {
    if (allowWaitlist) {
      return {
        allowed: true,
        isWaitlist: true,
        reason: "venue_full",
        title: "Event Registration Full — Joining Waitlist",
        message: `This event has reached its maximum capacity of ${venueCapacity} attendees. By submitting, you will be placed on the waitlist.`,
        venue: venueDetails,
        session: sessionDetails,
      };
    }
    return {
      allowed: false,
      isWaitlist: false,
      reason: "venue_full",
      title: "Event Registration Already Full",
      message: `This event has reached its maximum capacity of ${venueCapacity} attendees. Registration is currently closed to prevent exceeding venue limits.`,
      venue: venueDetails,
      session: sessionDetails,
    };
  }

  if (sessionDetails?.isFull) {
    if (allowWaitlist) {
      return {
        allowed: true,
        isWaitlist: true,
        reason: "session_full",
        title: "Session Track Full — Joining Waitlist",
        message: `The selected track "${sessionDetails.title}" has reached maximum capacity (${sessionDetails.capacity} attendees). By submitting, you will be placed on the waitlist.`,
        venue: venueDetails,
        session: sessionDetails,
      };
    }
    return {
      allowed: false,
      isWaitlist: false,
      reason: "session_full",
      title: "Session Track Already Full",
      message: `The selected session track "${sessionDetails.title}" has reached its maximum capacity of ${sessionDetails.capacity} attendees. Please choose another session track to continue your registration.`,
      venue: venueDetails,
      session: sessionDetails,
    };
  }

  return {
    allowed: true,
    isWaitlist: false,
    title: "Capacity Available",
    message: "Spots are available for this registration.",
    venue: venueDetails,
    session: sessionDetails,
  };
}
