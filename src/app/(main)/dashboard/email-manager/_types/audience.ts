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
