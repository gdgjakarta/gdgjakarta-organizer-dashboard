export type SponsorProposalStatus =
  | "draft"
  | "proposal_sent"
  | "in_discussion"
  | "confirmed"
  | "declined"
  | "cancelled";

export type SponsorCategory = "platinum" | "gold" | "silver" | "bronze" | "community" | "partner" | "media_partner";

export interface EventSponsorConfig {
  enabled: boolean;
  share_token: string;
  default_tier?: SponsorCategory;
  allow_company_description?: boolean;
  allow_company_url?: boolean;
  auto_send_invitation?: boolean;
  require_logo_url?: boolean;
  allowed_tiers?: string[];
  brand_guide_url?: string;
}

export interface ChapterSponsorConfig {
  enabled: boolean;
  share_token: string;
  default_tier?: SponsorCategory;
  allow_company_description?: boolean;
  allow_company_url?: boolean;
  allowed_tiers?: string[];
  brand_guide_url?: string;
  email_header_url?: string;
  updated_at?: string;
}

export interface FirestoreSponsor {
  id: string; // Firestore doc ID: sps_xxxx
  company: string;
  company_legal_name?: string;
  company_address?: string;
  url?: string;
  description?: string;
  logo?: string;
  tier: SponsorCategory;
  status: SponsorProposalStatus;
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  bevy_id?: number | null;
  is_active?: boolean; // Controls whether featured on chapter and event pages
  display_order?: number; // Sorting position index
  created_at: string;
  updated_at: string;
}

export interface SponsorProposalSession {
  id: string; // proposal token
  token: string;
  event_id: string;
  event_title: string;
  company_name: string;
  recipient_email: string;
  recipient_name?: string;
  status: SponsorProposalStatus;
  deck_url?: string;
  tier?: SponsorCategory;
  notes?: string;
  sent_at: string;
  updated_at: string;
}

export interface EventSponsorConfirmation {
  id: string; // spsconf_{eventId}_{sanitizedEmail}
  event_id: string;
  event_title?: string;

  // Section 1: Company Profile (Displayed on Website & Poster)
  email?: string;
  company_name: string;
  company_legal_name?: string;
  company_address?: string;
  company_url?: string;
  company_description?: string;
  company_logo_url: string;

  // Section 2: Contact Internal
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  contact_phone?: string;

  // Assignment & Bevy Metadata
  selected_tier: SponsorCategory;
  bevy_sponsor_id?: number | null;
  bevy_synced: boolean;
  synced_at?: string | null;

  status: SponsorProposalStatus;
  submitted_at: string;
  updated_at: string;
}

// ── Sponsor Documents (Invoice V2, Quotation V1, LOA V2) ─────────────────────

export type SponsorDocumentType = "invoice" | "quotation" | "loa" | "mou";

export type SponsorDocumentStatus = "draft" | "sent" | "viewed" | "signed" | "paid" | "cancelled";

export interface SponsorDocumentLineItem {
  id: string;
  description: string;
  qty: number;
  unit_price: number;
  total: number;
}

export interface SponsorDocumentTemplatesConfig {
  // Global Organization & Banking Defaults
  org_name: string;
  org_address: string;
  org_email: string;
  org_phone: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  bank_swift_code: string;
  invoice_signer_name: string;
  invoice_signer_title: string;
  quotation_signer_name: string;
  quotation_signer_title: string;
  loa_signer_name: string;
  loa_signer_title: string;
  mou_signer_name?: string;
  mou_signer_title?: string;
  organizer_signature_url?: string;
  invoice_number_pattern: string;
  quotation_number_pattern: string;
  loa_number_pattern: string;
  mou_number_pattern?: string;

  // Adjustable Template Clauses / Notes
  invoice_tax_note: string;
  quotation_validity_note: string;
  loa_intro_text: string;
  loa_payment_term_days: string;
  loa_clause_1_text: string;
  loa_clause_2_text: string;
  loa_clause_5_text: string;
  loa_term_payment_method: string;
  loa_term_workshop: string;
  loa_term_duration: string;
  loa_term_termination: string;
  loa_disclaimer: string;

  // MOU (Memorandum of Understanding — Community & Media Partners) Clauses
  mou_intro_text?: string;
  mou_clause_1_purpose?: string;
  mou_clause_4_logo_ip?: string;
  mou_clause_5_term?: string;
  mou_clause_6_non_financial?: string;
  mou_disclaimer?: string;
  default_mou_organizer_commitments?: Record<string, string[]>;

  default_tier_deliverables?: Record<string, string[]>;
  default_tier_prices?: Record<string, number>;
  updated_at?: string;
}

export interface SponsorDocument {
  id: string; // spdoc_...
  token: string; // opaque 32-char hex token for /partnership/documents/[token]
  doc_type: SponsorDocumentType;
  doc_number: string;
  source_quotation_id?: string;
  source_quotation_number?: string;
  custom_title?: string;
  status: SponsorDocumentStatus;
  event_id?: string | null;
  event_title?: string;
  event_date?: string;
  event_location?: string;
  event_website?: string;
  sponsor_id: string;
  company_name: string;
  company_legal_name?: string;
  company_address?: string;
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  sponsor_tier: SponsorCategory;
  currency: "IDR" | "USD";
  line_items: SponsorDocumentLineItem[];
  grand_total: number;
  deliverables: string[];
  organizer_commitments?: string[];
  payment_term_days?: string;
  quotation_validity_note?: string;
  invoice_tax_note?: string;
  loa_overrides?: Partial<
    Pick<
      SponsorDocumentTemplatesConfig,
      | "loa_intro_text"
      | "loa_clause_1_text"
      | "loa_clause_2_text"
      | "loa_clause_5_text"
      | "loa_term_payment_method"
      | "loa_term_workshop"
      | "loa_term_duration"
      | "loa_term_termination"
      | "loa_disclaimer"
    >
  >;
  mou_overrides?: Partial<
    Pick<
      SponsorDocumentTemplatesConfig,
      | "mou_intro_text"
      | "mou_clause_1_purpose"
      | "mou_clause_4_logo_ip"
      | "mou_clause_5_term"
      | "mou_clause_6_non_financial"
      | "mou_disclaimer"
    >
  >;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  bank_swift_code: string;
  organizer_signer_name: string;
  organizer_signer_title: string;
  organizer_signature_url?: string;
  document_date: string;
  partner_signer_name?: string;
  partner_signer_title?: string;
  sponsor_signed_name?: string;
  sponsor_signed_title?: string;
  sponsor_signed_at?: string;
  sponsor_signature_data_url?: string;
  email_status?: "not_sent" | "sent" | "failed";
  email_sent_at?: string;
  email_recipient?: string;
  created_at: string;
  updated_at: string;
}
