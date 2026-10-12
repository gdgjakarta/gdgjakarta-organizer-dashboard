import type { EventTicketTier, TicketPerk, TicketType } from "@/lib/firestore/types";

export interface TicketTemplate {
  id: string;
  name: string;
  type: TicketType;
  price: number;
  description: string;
  maxPerPerson: number;
  capacity?: number | null;
  perks?: TicketPerk[];
  is_custom?: boolean;
  created_at?: string;
}

export const CUSTOM_TICKET_TEMPLATES_STORAGE_KEY = "gdg_custom_ticket_templates";

/**
 * Stable identifier of the default "Regular Ticket" tier.
 * Kept stable so registrations made against the fallback ticket still match once it is persisted.
 */
export const DEFAULT_REGULAR_TICKET_ID = "ticket-regular";

/**
 * Name matches the "Regular Ticket" session key used by n8n webhook mappings.
 */
export const DEFAULT_REGULAR_TICKET_NAME = "Regular Ticket";

/**
 * Default ticket template applied to every event that has no ticket tiers configured.
 */
export const REGULAR_TICKET_TEMPLATE: TicketTemplate = {
  id: "tpl-default-regular",
  name: DEFAULT_REGULAR_TICKET_NAME,
  type: "free",
  price: 0,
  description: "General admission regular session access.",
  maxPerPerson: 1,
  capacity: null,
  perks: [],
};

/**
 * Builds the default "Regular Ticket" tier for an event.
 */
export function createDefaultRegularTicket(): EventTicketTier {
  return {
    id: DEFAULT_REGULAR_TICKET_ID,
    name: REGULAR_TICKET_TEMPLATE.name,
    description: REGULAR_TICKET_TEMPLATE.description,
    type: REGULAR_TICKET_TEMPLATE.type,
    price: REGULAR_TICKET_TEMPLATE.price,
    capacity: REGULAR_TICKET_TEMPLATE.capacity ?? null,
    max_per_person: REGULAR_TICKET_TEMPLATE.maxPerPerson,
    status: "active",
    perks: [],
  };
}

/**
 * Guarantees an event always has at least one ticket type.
 * Returns the configured tickets, or a single default "Regular Ticket" tier when none exist.
 */
export function ensureEventTickets(tickets?: EventTicketTier[] | null): EventTicketTier[] {
  if (Array.isArray(tickets) && tickets.length > 0) return tickets;
  return [createDefaultRegularTicket()];
}

/**
 * Built-in GDG community default ticket templates with curated included perks.
 */
export const DEFAULT_TICKET_TEMPLATES: TicketTemplate[] = [
  REGULAR_TICKET_TEMPLATE,
  {
    id: "tpl-default-free-rsvp",
    name: "General Admission (Free)",
    type: "free",
    price: 0,
    description: "Complimentary admission with full access to speaker tracks, community networking, and swag.",
    maxPerPerson: 1,
    perks: [
      {
        id: "perk-community-swag",
        name: "Community Swag & Sticker Pack",
        description: "Official GDG stickers and event badge upon physical check-in.",
        icon: "gift",
      },
      {
        id: "perk-general-access",
        name: "Full Keynote & Technical Track Access",
        description: "Unrestricted entry to all main hall sessions and partner booths.",
        icon: "ticket",
      },
    ],
  },
  {
    id: "tpl-default-commitment",
    name: "Commitment Deposit Pass (Refundable)",
    type: "commitment_fee",
    price: 50000,
    description:
      "Deposit of Rp 50,000 returned 100% in cash upon on-site physical check-in; forfeited in case of no-show.",
    maxPerPerson: 1,
    perks: [
      {
        id: "perk-refund-cash",
        name: "100% Cash Refund on Venue Check-In",
        description: "Receive exact cash return immediately after QR check-in scan.",
        icon: "award",
      },
      {
        id: "perk-coffee-break",
        name: "Coffee Break & Afternoon Snack",
        description: "Refreshment vouchers included for morning & afternoon sessions.",
        icon: "coffee",
      },
      {
        id: "perk-swag-kit",
        name: "Official GDG Swag & Sticker Pack",
        description: "Event badges, laptop stickers, and lanyard kit.",
        icon: "sparkles",
      },
    ],
  },
  {
    id: "tpl-default-standard-pass",
    name: "Standard Conference Pass",
    type: "paid",
    price: 100000,
    description: "Full-day conference entry including catering, conference badge, and all workshop materials.",
    maxPerPerson: 2,
    perks: [
      {
        id: "perk-event-tshirt",
        name: "Official Event T-Shirt",
        description: "High-grade 100% cotton combed 24s conference attendee shirt.",
        icon: "shirt",
      },
      {
        id: "perk-buffet-lunch",
        name: "Buffet Lunch & All-Day Coffee",
        description: "Full catering lunch box and coffee bar access throughout the event.",
        icon: "coffee",
      },
      {
        id: "perk-digital-cert",
        name: "Verified Certificate of Attendance",
        description: "Digital certificate signed by GDG Jakarta organizers.",
        icon: "award",
      },
    ],
  },
  {
    id: "tpl-default-vip-workshop",
    name: "VIP & Hands-on Workshop Pass",
    type: "paid",
    price: 250000,
    description: "Priority front-row seating, dedicated lab mentoring, and exclusive speaker lounge access.",
    maxPerPerson: 1,
    perks: [
      {
        id: "perk-vip-tshirt-swag",
        name: "Exclusive VIP Swag Box & Hoodie",
        description: "Premium conference hoodie, limited edition tote bag, and enamel pins.",
        icon: "gift",
      },
      {
        id: "perk-vip-lounge",
        name: "Speaker Lounge & Networking Lunch",
        description: "Dedicated networking area with speakers, Google Developer Experts, and partners.",
        icon: "star",
      },
      {
        id: "perk-front-row",
        name: "Priority Front-Row Reserved Seating",
        description: "Reserved front-row seating for all keynotes and panel discussions.",
        icon: "sparkles",
      },
      {
        id: "perk-workshop-cert",
        name: "Hands-on Workshop Access & Certificate",
        description: "Access to limited lab seats with hands-on instructor guidance.",
        icon: "award",
      },
    ],
  },
];

/**
 * Retrieves custom ticket templates stored in browser localStorage.
 */
export function getCustomTicketTemplates(): TicketTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_TICKET_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn("[getCustomTicketTemplates] Failed to parse custom templates:", err);
    return [];
  }
}

/**
 * Saves a ticket tier as a custom reusable template in localStorage.
 */
export function saveTicketAsTemplate(ticket: EventTicketTier, templateName?: string): TicketTemplate {
  const currentTemplates = getCustomTicketTemplates();

  const template: TicketTemplate = {
    id: `tpl-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: templateName?.trim() || ticket.name,
    type: ticket.type,
    price: ticket.price,
    description: ticket.description ?? "",
    maxPerPerson: ticket.max_per_person ?? 1,
    capacity: ticket.capacity ?? null,
    perks: ticket.perks ? JSON.parse(JSON.stringify(ticket.perks)) : [],
    is_custom: true,
    created_at: new Date().toISOString(),
  };

  const updated = [template, ...currentTemplates.filter((t) => t.id !== template.id)];

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_TICKET_TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("[saveTicketAsTemplate] Failed to persist template to localStorage:", err);
    }
  }

  return template;
}

/**
 * Deletes a custom ticket template by id from localStorage.
 */
export function deleteCustomTicketTemplate(templateId: string): void {
  if (typeof window === "undefined") return;
  const current = getCustomTicketTemplates();
  const updated = current.filter((t) => t.id !== templateId);
  try {
    window.localStorage.setItem(CUSTOM_TICKET_TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[deleteCustomTicketTemplate] Failed to delete template:", err);
  }
}

/**
 * Returns all available templates split by default and custom.
 */
export function getAllTicketTemplates(): {
  defaultTemplates: TicketTemplate[];
  customTemplates: TicketTemplate[];
} {
  return {
    defaultTemplates: DEFAULT_TICKET_TEMPLATES,
    customTemplates: getCustomTicketTemplates(),
  };
}
