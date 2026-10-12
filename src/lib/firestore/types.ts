import type { BevyAgenda, BevySpeaker } from "@/lib/bevy/types";

export type RegistrationStatus = "pending" | "approved" | "registered" | "rejected" | "waitlisted" | "attended";

export type QuestionValidationType =
  | "none"
  | "isEmail"
  | "isWorkEmail"
  | "isUrl"
  | "isGithubUrl"
  | "isLinkedInProfileUrl"
  | "isWhatsappNumber"
  | "isNumber"
  | "customRegex";

export interface CustomQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "multiselect";
  options?: string[];
  required: boolean;
  placeholder?: string;
  description?: string;
  section?: string;

  // Question validation & constraint settings
  validation_type?: QuestionValidationType;
  regex_pattern?: string;
  min_length?: number;
  max_length?: number;
  custom_error_message?: string;

  // Other option with custom text input (Google Forms style)
  allow_other?: boolean;
  other_placeholder?: string;
}

export interface SessionRelatedLink {
  title: string;
  url: string;
}

export interface EventSession {
  id: string;
  title: string;
  description?: string;
  time_slot?: string;
  checkin_deadline?: string;
  location?: string;
  location_url?: string;
  capacity: number;
  total_registered?: number;

  // Speaker slides & resources
  slides_url?: string;
  slides_title?: string;
  speaker_name?: string;
  related_links?: SessionRelatedLink[];
}

export interface MerchandiseVariationOptionDetail {
  price?: number | null; // specific price override (IDR), null or undefined = use base item price
  stock?: number | null; // specific quota/stock override, null or undefined = use base stock
  image_url?: string | null; // specific image for this variation option
}

export interface MerchandiseVariation {
  name: string; // e.g. "Size", "Color", "Material"
  options: string[]; // e.g. ["S", "M", "L", "XL"]
  option_details?: Record<string, MerchandiseVariationOptionDetail>; // option name -> details
}

export interface MerchandiseGuideline {
  title?: string; // e.g. "T-Shirt Size Guideline & Measurements"
  text?: string; // markdown or text sizing table / instructions
  image_url?: string; // size chart / guideline illustration URL
}

export interface EventMerchandiseItem {
  id: string;
  name: string;
  description: string;
  price: number; // In IDR (0 for free/included perk)
  is_free: boolean;
  tag: string; // e.g. "Free Perk", "Included with Ticket", "Exclusive", "Limited Edition"
  image_url: string; // Primary thumbnail URL
  images?: string[]; // Multiple product photos
  stock?: number | null; // null or undefined means unlimited
  variations: MerchandiseVariation[];
  max_per_person?: number | null; // Limit items per person (null = unlimited or event-level limit)
  status: "active" | "draft" | "out_of_stock";
  guideline?: MerchandiseGuideline; // Dedicated field notes / size chart
  created_at?: string;
  updated_at?: string;
}

export type TicketType = "free" | "paid" | "commitment_fee";

export type TicketPerkIcon = "gift" | "shirt" | "coffee" | "award" | "star" | "ticket" | "sparkles";

export interface TicketPerk {
  id: string;
  name: string; // e.g. "Official DevFest T-Shirt", "Lunch & Coffee Break"
  description?: string; // e.g. "Unisex 100% Cotton combed 24s"
  merchandise_id?: string; // Optional link to an EventMerchandiseItem.id
  icon?: TicketPerkIcon;
}

export interface EventTicketTier {
  id: string;
  name: string; // e.g. "General Admission (Free)", "VIP Community Pass", "Commitment Deposit"
  description?: string;
  type: TicketType; // "free" | "paid" | "commitment_fee"
  price: number; // In IDR (0 for free, amount for paid or refundable commitment fee)
  capacity?: number | null; // null or undefined means unlimited
  total_registered?: number;
  max_per_person?: number | null; // maximum tickets allowed per person (default 1)
  status: "active" | "sold_out" | "hidden";
  sales_start_date?: string | null;
  sales_end_date?: string | null;
  perks?: TicketPerk[];
  created_at?: string;
  updated_at?: string;
}

export type VoucherDiscountType = "percentage" | "fixed";
export type VoucherAppliesTo = "all" | "ticket" | "merchandise";
export type VoucherStatus = "active" | "inactive" | "expired";

export interface EventVoucher {
  id: string;
  code: string; // e.g. "DEVFEST50", uppercase and trimmed
  description?: string; // e.g. "Early Bird 50% discount on tickets"
  discount_type: VoucherDiscountType; // "percentage" | "fixed"
  discount_value: number; // e.g. 20 (for 20%) or 50000 (for Rp 50.000)
  applies_to: VoucherAppliesTo; // "all" | "ticket" | "merchandise"
  min_spend?: number | null; // Minimum eligible cart amount in IDR
  max_discount?: number | null; // Maximum discount cap in IDR (for percentage discounts)
  usage_limit?: number | null; // Total redemptions allowed across all attendees (null = unlimited)
  times_used?: number; // Times this voucher has been redeemed
  start_date?: string | null; // ISO string
  end_date?: string | null; // ISO string
  status: VoucherStatus;
  created_at?: string;
  updated_at?: string;
}

export type EmailTemplateKey =
  | "interest"
  | "accepted"
  | "rejected_hybrid"
  | "rejected_non_hybrid"
  | "rejected_virtual"
  | "cancelled"
  | "cancelled_attendee";

export interface EventEmailTemplateData {
  headerEmailUrl?: string;
  eventName?: string;
  eventCtaUrl?: string;
  eventChecklistItems?: string[];
  attendeeName?: string;
  attendeeEmail?: string;
  eventDate?: string;
  sessionTime?: string;
  checkinDeadline?: string;
  venueLocation?: string;
  venueLocationUrl?: string;
  attendeeCode?: string;
  qrCode?: string;
}

export interface EventEmailTemplates {
  interest?: string;
  accepted?: string;
  rejected_hybrid?: string;
  rejected_non_hybrid?: string;
  rejected_virtual?: string;
  direct_ticket?: string;
  cancelled?: string;
  cancelled_attendee?: string;

  // Custom subject lines
  interest_subject?: string;
  accepted_subject?: string;
  rejected_hybrid_subject?: string;
  rejected_non_hybrid_subject?: string;
  rejected_virtual_subject?: string;
  cancelled_subject?: string;
  cancelled_attendee_subject?: string;

  // Saved event template data configuration (legacy fallback)
  template_data?: EventEmailTemplateData;

  // Per-template configurable data
  templates_data?: Partial<Record<EmailTemplateKey, EventEmailTemplateData>>;
}

export interface FirestoreEvent {
  id: string; // Bevy Event ID or generated ID
  title: string;
  description?: string;
  description_short?: string;
  status: "Draft" | "Published" | "Completed" | "Canceled";
  start_date: string;
  end_date: string;
  picture_url?: string;
  banner_url?: string;
  picture?: {
    url?: string;
    thumbnail_url?: string;
  };
  banner?: {
    url?: string;
    thumbnail_url?: string;
  };
  cropped_picture_url?: string;
  cropped_banner_url?: string;
  event_type_title?: string;
  audience_type?: "IN_PERSON" | "VIRTUAL" | "HYBRID" | string;
  is_virtual?: boolean;
  venue?: {
    name?: string;
    address?: string;
    city?: string;
  };
  url?: string;
  static_url?: string;
  tags?: string[];
  is_hidden?: boolean;
  is_test?: boolean;

  // Dashboard & Registration Extensions
  requires_approval: boolean;
  curation_mode?: boolean;
  allow_waitlist?: boolean;
  max_attendees?: number | null;
  total_registrations: number;
  total_approved: number;
  total_checked_in: number;
  total_waitlisted?: number;
  custom_questions?: CustomQuestion[];
  agenda?: BevyAgenda;
  speakers?: BevySpeaker[];
  sessions?: EventSession[];
  tickets?: EventTicketTier[];
  max_tickets_per_person?: number | null; // Limit tickets per person (default 1)
  merchandise?: EventMerchandiseItem[];
  max_merchandise_per_person?: number | null; // Limit merchandise items per person (null = unlimited)
  vouchers?: EventVoucher[];
  webhook_url?: string | null;
  registration_status?: "Draft" | "Published" | "Closed";
  registration_start_date?: string | null;
  registration_end_date?: string | null;

  // Post-Event Recap & Media Extensions
  highlight_video_url?: string;
  highlight_video_title?: string;
  photo_album_url?: string;
  photo_album_title?: string;
  recap_description?: string;

  // Email Automation Templates (n8n workflows)
  email_templates?: EventEmailTemplates;

  // Metadata
  synced_from_bevy_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FirestoreMember {
  id: string; // Bevy User ID or Firebase UID
  uid?: string;
  bevy_user_id?: string | number | null;
  bevy_member_id?: string | number | null;
  name: string; // Full name (first_name + last_name)
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  company?: string | null; // e.g. "PT. Lumio Inovasi Technology"
  title?: string | null; // Job Title, e.g. "Software Engineer"
  role: string; // Chapter role: "Organizer" | "Core Team" | "Check-in Staff" | "Member"
  chapter_role?: string | null;
  team?: "Core Team" | "Community";
  status: "Active" | "Inactive";
  joined_date: string;
  raw_created_date?: string; // Exact ISO timestamp from Bevy (created_date)
  events_registered_count?: number;

  // Custom Dashboard Extensions (not in Bevy CSV)
  avatar_url?: string | null;
  profile_url?: string | null;
  is_email_verified?: boolean;
  company_or_institution?: string;
  phone?: string;
  events_attended_count?: number; // Tracked through on-site scanner/check-ins
  last_active?: string | null;
  notes?: string;

  // Sync Metadata
  synced_from_bevy_at?: string;
  updated_at: string;
}

export interface SelectedMerchandiseOrder {
  id: string;
  name: string;
  quantity: number;
  price: number;
  selected_variations?: Record<string, string>;
}

export interface RegistrationStatusLog {
  id: string;
  status: RegistrationStatus;
  previous_status?: RegistrationStatus;
  changed_at: string;
  changed_by_id: string;
  changed_by_name: string;
  changed_by_email?: string;
  notes?: string;
}

export interface AuditLogEntry {
  id?: string;
  action: "registration_status_change" | "event_update" | "member_update";
  entity_type: "registration" | "event" | "member";
  entity_id: string;
  event_id?: string;
  event_title?: string;
  member_id?: string;
  member_name?: string;
  member_email?: string;
  actor_id: string;
  actor_name: string;
  actor_email?: string;
  previous_value?: unknown;
  new_value?: unknown;
  notes?: string;
  timestamp: string;
}

export interface FirestoreRegistration {
  id: string; // `${event_id}_${member_id}`
  event_id: string;
  event_title: string;
  event_picture_url?: string;
  event_banner_url?: string;
  member_id: string;
  member_name: string;
  member_email: string;
  member_avatar?: string;
  member_role?: string;
  status: RegistrationStatus;
  answers?: Record<string, unknown>;
  session_id?: string | null;
  session_title?: string | null;
  notes?: string;
  ticket_tier?: string;
  ticket_id?: string | null;
  ticket_name?: string | null;
  ticket_type?: TicketType;
  ticket_price?: number;
  selected_merchandise?: SelectedMerchandiseOrder[];
  registered_at: string;
  reviewed_at?: string;
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  reviewed_by_email?: string;
  status_logs?: RegistrationStatusLog[];
  checked_in_at?: string;
  is_checked_in?: boolean;
  bevy_attendee_id?: number | null;
  checkin_date?: string | null;
  attendee_code?: string | null;

  // Payment tracking (DOKU Checkout API)
  payment_status?: "unpaid" | "pending" | "paid" | "expired" | "refunded";
  payment_url?: string;
  payment_invoice_number?: string;
  payment_amount?: number;
  payment_expired_datetime?: string;

  // Voucher tracking
  voucher_id?: string;
  voucher_code?: string;
  voucher_discount_amount?: number;
  voucher_discount_type?: VoucherDiscountType;
  voucher_discount_value?: number;
  voucher_applies_to?: VoucherAppliesTo;

  updated_at?: string;
}

export interface FirestoreSyncMetadata {
  id: "bevy";
  last_synced_events_at?: string;
  last_synced_members_at?: string;
  total_events_synced?: number;
  total_members_synced?: number;
  status: "idle" | "syncing" | "success" | "error";
  error_message?: string;
  synced_by?: string;
}
