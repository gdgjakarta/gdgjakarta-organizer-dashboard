"use server";

import { getAllBevyEventAttendees, getBevyChapterMembers, getBevyChapterTeams } from "@/lib/bevy/client";

import { AUDIENCE_OPTIONS, type AudienceOptionDefinition, type AudienceType } from "../_types/audience";

export type { AudienceOptionDefinition, AudienceType };

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

      resolvedList = rawAttendees
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
      resolvedList = teams
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
        attendeeEmailSet = new Set(eventAtts.map((a) => (a.email || "").trim().toLowerCase()));
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
