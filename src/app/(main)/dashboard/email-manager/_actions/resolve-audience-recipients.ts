"use server";

import { getAllBevyEventAttendees, getBevyChapterMembers, getBevyChapterTeams } from "@/lib/bevy/client";

export type AudienceType =
  | "attendees_checked_in"
  | "attendees_not_checked_in"
  | "chapter_members"
  | "chapter_members_never_registered"
  | "chapter_members_without_ticket"
  | "event_chapter_teams"
  | "ticket_all"
  | "ticket_hybrid"
  | "ticket_in_person"
  | "ticket_virtual"
  | "waitlist";

export interface AudienceOptionDefinition {
  id: AudienceType;
  label: string;
  category: "attendees_tickets" | "checkin" | "chapter_community";
  description: string;
  badge?: string;
}

export const AUDIENCE_OPTIONS: AudienceOptionDefinition[] = [
  // 1. Attendees & Tickets
  {
    id: "ticket_all",
    label: "People with event ticket (All ticket types)",
    category: "attendees_tickets",
    description: "Every confirmed ticket holder registered for this event.",
    badge: "All Tickets",
  },
  {
    id: "ticket_in_person",
    label: "People with in-person event ticket",
    category: "attendees_tickets",
    description: "Confirmed attendees holding physical in-person admission tickets.",
    badge: "In-Person",
  },
  {
    id: "ticket_virtual",
    label: "People with virtual event ticket",
    category: "attendees_tickets",
    description: "Confirmed attendees joining via live stream or online broadcast.",
    badge: "Virtual",
  },
  {
    id: "ticket_hybrid",
    label: "People with hybrid event ticket",
    category: "attendees_tickets",
    description: "Attendees registered with hybrid ticket privileges.",
    badge: "Hybrid",
  },
  {
    id: "waitlist",
    label: "Users on event waitlist",
    category: "attendees_tickets",
    description: "Registrants currently waiting for ticket approval or capacity release.",
    badge: "Waitlist",
  },

  // 2. Check-in & Attendance
  {
    id: "attendees_checked_in",
    label: "Attendees who checked in",
    category: "checkin",
    description: "Verified attendees whose tickets were scanned and checked in.",
    badge: "Checked In",
  },
  {
    id: "attendees_not_checked_in",
    label: "Attendees who did not check in",
    category: "checkin",
    description: "Ticket holders who have not checked in to the venue yet.",
    badge: "Not Checked In",
  },

  // 3. Chapter & Community
  {
    id: "chapter_members",
    label: "Chapter Members",
    category: "chapter_community",
    description: "All registered members of the GDG Jakarta community chapter.",
    badge: "All Members",
  },
  {
    id: "chapter_members_without_ticket",
    label: "Chapter members without event ticket",
    category: "chapter_community",
    description: "Community members who have not yet secured a ticket for this event.",
    badge: "No Ticket",
  },
  {
    id: "chapter_members_never_registered",
    label: "Chapter members - never registered for an event",
    category: "chapter_community",
    description: "Community members who have never completed an event registration.",
    badge: "Inactive",
  },
  {
    id: "event_chapter_teams",
    label: "Event Chapter Teams",
    category: "chapter_community",
    description: "Core organizers, facilitators, and chapter committee leads.",
    badge: "Team",
  },
];

export interface ResolvedRecipient {
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  ticketType?: string;
  isCheckedIn?: boolean;
  status?: string;
}

export interface ResolveAudienceResult {
  success: boolean;
  audienceType: AudienceType;
  audienceLabel: string;
  totalCount: number;
  sampleRecipients: ResolvedRecipient[];
  recipients: ResolvedRecipient[];
  error?: string;
}

/**
 * Resolves audience recipients for a given event ID and selected audience segment.
 */
export async function resolveAudienceRecipientsAction(
  eventId: string,
  audienceType: AudienceType,
): Promise<ResolveAudienceResult> {
  const option = AUDIENCE_OPTIONS.find((o) => o.id === audienceType);
  const audienceLabel = option?.label || audienceType;

  if (!eventId) {
    return {
      success: false,
      audienceType,
      audienceLabel,
      totalCount: 0,
      sampleRecipients: [],
      recipients: [],
      error: "Event ID is required to resolve audience recipients.",
    };
  }

  try {
    let resolvedList: ResolvedRecipient[] = [];

    // Branch A: Event Attendee-based Segments
    if (
      audienceType === "ticket_all" ||
      audienceType === "ticket_in_person" ||
      audienceType === "ticket_virtual" ||
      audienceType === "ticket_hybrid" ||
      audienceType === "attendees_checked_in" ||
      audienceType === "attendees_not_checked_in" ||
      audienceType === "waitlist"
    ) {
      const { results: rawAttendees } = await getAllBevyEventAttendees(eventId);

      resolvedList = (rawAttendees || [])
        .filter((att) => {
          if (!att.email) return false;
          const statusLower = (att.status || "").toLowerCase();
          const ticketTitleLower = (att.ticket_title || "").toLowerCase();

          switch (audienceType) {
            case "attendees_checked_in":
              return Boolean(att.is_checked_in);

            case "attendees_not_checked_in":
              return !att.is_checked_in && statusLower !== "canceled" && statusLower !== "cancelled";

            case "ticket_all":
              return statusLower !== "canceled" && statusLower !== "cancelled";

            case "ticket_in_person":
              return (
                (ticketTitleLower.includes("in-person") ||
                  ticketTitleLower.includes("offline") ||
                  ticketTitleLower.includes("general") ||
                  !ticketTitleLower.includes("virtual")) &&
                statusLower !== "canceled" &&
                statusLower !== "cancelled"
              );

            case "ticket_virtual":
              return (
                (ticketTitleLower.includes("virtual") || ticketTitleLower.includes("online")) &&
                statusLower !== "canceled" &&
                statusLower !== "cancelled"
              );

            case "ticket_hybrid":
              return ticketTitleLower.includes("hybrid") && statusLower !== "canceled" && statusLower !== "cancelled";

            case "waitlist":
              return statusLower === "waitlist" || statusLower === "waitlisted";

            default:
              return true;
          }
        })
        .map((att) => {
          const fName = att.first_name || att.name?.split(" ")[0] || "";
          const lName = att.last_name || att.name?.split(" ").slice(1).join(" ") || "";
          const fullName = att.name || [fName, lName].filter(Boolean).join(" ") || "Attendee";

          return {
            name: fullName,
            email: att.email.trim().toLowerCase(),
            firstName: fName,
            lastName: lName,
            ticketType: att.ticket_title || "General Ticket",
            isCheckedIn: Boolean(att.is_checked_in),
            status: att.status || (att.is_checked_in ? "Checked In" : "Confirmed"),
          };
        });
    }
    // Branch B: Event Chapter Teams
    else if (audienceType === "event_chapter_teams") {
      const teams = await getBevyChapterTeams();
      resolvedList = (teams || [])
        .filter((tm) => Boolean(tm.user?.email))
        .map((tm) => {
          const email = (tm.user?.email || "").trim().toLowerCase();
          const roleTitle = typeof tm.role === "string" ? tm.role : tm.role?.name || tm.title || "Chapter Team";
          const fullName =
            tm.user?.full_name || [tm.user?.first_name, tm.user?.last_name].filter(Boolean).join(" ") || "Team Member";
          return {
            name: fullName,
            email,
            firstName: tm.user?.first_name || "",
            lastName: tm.user?.last_name || "",
            ticketType: roleTitle,
            status: "Team Member",
          };
        });
    }
    // Branch C: Chapter Members Segments
    else if (
      audienceType === "chapter_members" ||
      audienceType === "chapter_members_without_ticket" ||
      audienceType === "chapter_members_never_registered"
    ) {
      const membersRes = await getBevyChapterMembers(undefined, 250);
      const members = membersRes?.results ?? [];

      // If we need to filter out ticket holders, get current event attendee emails
      let attendeeEmailSet = new Set<string>();
      if (audienceType === "chapter_members_without_ticket") {
        const { results: eventAtts } = await getAllBevyEventAttendees(eventId);
        attendeeEmailSet = new Set((eventAtts || []).map((a) => (a.email || "").trim().toLowerCase()));
      }

      resolvedList = members
        .filter((m) => {
          const email = (m.user?.email || "").trim().toLowerCase();
          if (!email) return false;

          if (audienceType === "chapter_members_without_ticket") {
            return !attendeeEmailSet.has(email);
          }

          if (audienceType === "chapter_members_never_registered") {
            // Bevy member events_registered_count or status
            const regCount = (m as { events_registered_count?: number }).events_registered_count ?? 0;
            return regCount === 0;
          }

          return true;
        })
        .map((m) => {
          const email = (m.user?.email || "").trim().toLowerCase();
          const fullName = m.user?.full_name || "Chapter Member";
          const nameParts = fullName.split(" ");
          return {
            name: fullName,
            email,
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            ticketType: "Community Member",
            status: "Chapter Member",
          };
        });
    }

    // Deduplicate by email
    const seenEmails = new Set<string>();
    const deduplicated: ResolvedRecipient[] = [];
    for (const r of resolvedList) {
      if (!seenEmails.has(r.email)) {
        seenEmails.add(r.email);
        deduplicated.push(r);
      }
    }

    return {
      success: true,
      audienceType,
      audienceLabel,
      totalCount: deduplicated.length,
      sampleRecipients: deduplicated.slice(0, 10),
      recipients: deduplicated,
    };
  } catch (error) {
    console.error(`[resolveAudienceRecipientsAction] Error resolving for ${audienceType}:`, error);
    return {
      success: false,
      audienceType,
      audienceLabel,
      totalCount: 0,
      sampleRecipients: [],
      recipients: [],
      error: error instanceof Error ? error.message : "Failed to resolve audience recipients.",
    };
  }
}
