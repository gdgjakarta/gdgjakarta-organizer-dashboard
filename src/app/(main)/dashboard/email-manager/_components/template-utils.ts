import {
  DEFAULT_ACCEPTED_EMAIL_HTML,
  DEFAULT_CANCELLED_ATTENDEE_EMAIL_HTML,
  DEFAULT_CANCELLED_EMAIL_HTML,
  DEFAULT_INTEREST_EMAIL_HTML,
  DEFAULT_PAID_WAITLISTED_EMAIL_HTML,
  DEFAULT_REJECTED_HYBRID_EMAIL_HTML,
  DEFAULT_REJECTED_NON_HYBRID_EMAIL_HTML,
  DEFAULT_REJECTED_PAID_WAITLISTED_EMAIL_HTML,
  DEFAULT_REJECTED_VIRTUAL_EMAIL_HTML,
  DEFAULT_REJECTED_WAITLISTED_EMAIL_HTML,
  DEFAULT_WAITLISTED_EMAIL_HTML,
  convertTemplateToCleanTokens,
} from "@/lib/events/email-templates";

export { convertTemplateToCleanTokens };

import {
  defaultHtmlTemplate,
  getFeatureTemplateOverrides,
  memberOnlineInvitationHtmlTemplate,
  memberRegisterInvitationHtmlTemplate,
  speakerInvitationHtmlTemplate,
  venueTicketHtmlTemplate,
} from "./default-html-template";

export interface EmailFeatureTemplateItem {
  id: string;
  name: string;
  category: "general" | "rsvp" | "curation" | "waitlist" | "cancellation" | "invitation";
  badge: string;
  defaultSubject: string;
  description: string;
  getRawHtml: () => string;
}



export function resolveFeatureTemplateContent(tpl: EmailFeatureTemplateItem): {
  subject: string;
  headerUrl?: string;
  body: string;
} {
  const override = getFeatureTemplateOverrides()[tpl.id];
  return {
    subject: override?.subject || tpl.defaultSubject,
    headerUrl: override?.headerUrl,
    body: override?.body || tpl.getRawHtml(),
  };
}

export const EMAIL_FEATURE_TEMPLATES: EmailFeatureTemplateItem[] = [
  {
    id: "default",
    name: "General Announcement & Event Update",
    category: "general",
    badge: "Campaign Default",
    defaultSubject: "Update regarding: [[EventName]]",
    description:
      "Standard responsive template featuring hero banner, agenda checklist, and RSVP call-to-action button.",
    getRawHtml: () => defaultHtmlTemplate,
  },
  {
    id: "accepted",
    name: "Accepted / Official Ticket Confirmation",
    category: "rsvp",
    badge: "Official Pass",
    defaultSubject: "Your Official Ticket & Reminders: [[EventName]]",
    description:
      "Includes official entry pass ticket card, date/time breakdown, venue link, and attendee check-in reminders.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_ACCEPTED_EMAIL_HTML),
  },
  {
    id: "venue_ticket",
    name: "Venue Ticket",
    category: "rsvp",
    badge: "Venue Pass",
    defaultSubject: "Your Venue Ticket: [[EventName]]",
    description:
      "Sends the participant's personal venue entry pass link with view-only access granted to their registered email.",
    getRawHtml: () => venueTicketHtmlTemplate,
  },
  {
    id: "interest",
    name: "Registration Interest (Receipt)",
    category: "curation",
    badge: "Pending Review",
    defaultSubject: "Registration Received: [[EventName]]",
    description:
      "Confirms submission of registration and informs applicant that their application is undergoing curation review.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_INTEREST_EMAIL_HTML),
  },
  {
    id: "waitlisted",
    name: "Waitlist Notification (Free/Unpaid)",
    category: "waitlist",
    badge: "Waitlist Notice",
    defaultSubject: "Waitlist Update: [[EventName]]",
    description: "Notifies attendees when registration capacity is filled and they have been queued on the waitlist.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_WAITLISTED_EMAIL_HTML),
  },
  {
    id: "paid_waitlisted",
    name: "Paid Waitlist Notification (Priority)",
    category: "waitlist",
    badge: "Payment Verified",
    defaultSubject: "Payment Confirmed - Waitlist Priority: [[EventName]]",
    description: "Confirms payment receipt and notifies of priority waitlist queuing and refund privileges.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_PAID_WAITLISTED_EMAIL_HTML),
  },
  {
    id: "rejected_waitlisted",
    name: "Rejected Waitlisted (Free Event)",
    category: "waitlist",
    badge: "Waitlist Closed",
    defaultSubject: "Waitlist Update: [[EventName]]",
    description:
      "Notifies waitlisted attendees on a free event that all seats remained full and the waitlist is closed.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_REJECTED_WAITLISTED_EMAIL_HTML),
  },
  {
    id: "rejected_paid_waitlisted",
    name: "Rejected Paid Waitlisted (Refund Eligible)",
    category: "waitlist",
    badge: "Refund Eligible",
    defaultSubject: "Waitlist Update & Refund Instructions: [[EventName]]",
    description:
      "Notifies paid waitlisted attendees that capacity remained full and instructs them to submit a 100% refund request on their dashboard.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_REJECTED_PAID_WAITLISTED_EMAIL_HTML),
  },
  {
    id: "rejected_hybrid",
    name: "Application Regret (Hybrid Event)",
    category: "curation",
    badge: "Hybrid Regret",
    defaultSubject: "Update regarding: [[EventName]]",
    description: "Polite curation regret notice for hybrid events, providing access to virtual livestream broadcast.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_REJECTED_HYBRID_EMAIL_HTML),
  },
  {
    id: "rejected_non_hybrid",
    name: "Application Regret (In-Person Event)",
    category: "curation",
    badge: "In-Person Regret",
    defaultSubject: "Update regarding: [[EventName]]",
    description:
      "Polite regret notice for physical in-person sessions that have reached strict physical capacity limits.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_REJECTED_NON_HYBRID_EMAIL_HTML),
  },
  {
    id: "rejected_virtual",
    name: "Application Regret (Virtual Event)",
    category: "curation",
    badge: "Virtual Regret",
    defaultSubject: "Update regarding: [[EventName]]",
    description: "Regret notification for interactive virtual sessions and workshops with capped attendee quotas.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_REJECTED_VIRTUAL_EMAIL_HTML),
  },
  {
    id: "cancelled",
    name: "Registration Cancelled (By Organizer)",
    category: "cancellation",
    badge: "Cancelled Notice",
    defaultSubject: "Registration Cancelled: [[EventName]]",
    description:
      "Notifies attendee that their registration was cancelled by an organizer and removed from event roster.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_CANCELLED_EMAIL_HTML),
  },
  {
    id: "cancelled_attendee",
    name: "Registration Cancelled (By Attendee)",
    category: "cancellation",
    badge: "Self Cancellation",
    defaultSubject: "Registration Cancelled: [[EventName]]",
    description: "Confirmation of attendee self-service registration cancellation from user portal.",
    getRawHtml: () => convertTemplateToCleanTokens(DEFAULT_CANCELLED_ATTENDEE_EMAIL_HTML),
  },
  {
    id: "speaker_invitation",
    name: "Speaker Invitation",
    category: "invitation",
    badge: "Speaker Outreach",
    defaultSubject: "Invitation to Speak at [[EventName]]: [[SessionTitle]]",
    description: "Official invitation to speak with session topic and speaker handbook guidelines.",
    getRawHtml: () => speakerInvitationHtmlTemplate,
  },
  {
    id: "member_register_invitation",
    name: "Member Invitation (Register to Event)",
    category: "invitation",
    badge: "Community Outreach",
    defaultSubject: "You're Invited! Register Now for [[EventName]] 🚀",
    description: "Community-wide invitation encouraging members to register and secure their spot.",
    getRawHtml: () => memberRegisterInvitationHtmlTemplate,
  },
  {
    id: "member_online_invitation",
    name: "Member Invitation (Join Online Event)",
    category: "invitation",
    badge: "Online Stream",
    defaultSubject: "Join Us Live Online: [[EventName]] 💻",
    description: "Virtual event invitation & livestream access guide for members joining online.",
    getRawHtml: () => memberOnlineInvitationHtmlTemplate,
  },
];
