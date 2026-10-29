export interface FaqItem {
  id: string;
  category: string;
  categoryLabel: string;
  question: string;
  answer: string;
  order?: number;
  isActive?: boolean;
}

export interface FaqCategory {
  key: string;
  label: string;
  iconName?: string;
}

export interface FaqNotice {
  enabled: boolean;
  title: string;
  description: string;
  verifiedEmails: string[];
  policyUrl: string;
  policyLinkText: string;
}

export interface FaqHeader {
  badge: string;
  title: string;
  description: string;
}

export interface FaqContact {
  title: string;
  description: string;
  email: string;
  instagram: string;
}

export interface FaqContent {
  header: FaqHeader;
  notice: FaqNotice;
  categories: FaqCategory[];
  items: FaqItem[];
  contact: FaqContact;
  updatedAt?: string;
  updatedBy?: string;
}

// ── Partnership Types ────────────────────────────────────────────────────────

export interface PartnershipStat {
  id: string;
  label: string;
  value: string;
}

export interface PartnershipHeroConfig {
  badge: string;
  title: string;
  description: string;
  contactEmail: string;
  proposalDeckUrl?: string;
  stats: PartnershipStat[];
}

export interface PartnershipWhyUsItem {
  id: string;
  title: string;
  description: string;
  badge: string;
  iconName: string;
  isActive?: boolean;
}

export interface PartnershipDevfestHighlight {
  id: string;
  label: string;
  value: string;
}

export interface PartnershipDevfestConfig {
  badge: string;
  title: string;
  description: string;
  highlights: PartnershipDevfestHighlight[];
  tracks: string[];
}

export type PartnershipFeaturedEventHighlight = PartnershipDevfestHighlight;
export type PartnershipFeaturedEventConfig = PartnershipDevfestConfig;

export interface PartnershipFormat {
  id: string;
  title: string;
  tag: string;
  description: string;
  iconName: string;
  deliverables: string[];
  isActive?: boolean;
}

export interface PartnershipBenefit {
  id: string;
  category: string;
  title: string;
  iconName: string;
  points: string[];
  isActive?: boolean;
}

export interface PartnershipTier {
  id: string;
  name: string;
  badge?: string;
  popular?: boolean;
  description: string;
  slots: string;
  price?: string;
  highlights: string[];
  isActive?: boolean;
}

export interface PartnershipFaq {
  id: string;
  question: string;
  answer: string;
}

export interface PartnershipContactConfig {
  heading: string;
  subheading: string;
  contactEmail: string;
  instagramUrl: string;
  interestOptions: string[];
  contactPerson?: string;
  phoneOrWhatsapp?: string;
}

export interface PartnershipContent {
  hero: PartnershipHeroConfig;
  whyUs: PartnershipWhyUsItem[];
  devfest: PartnershipDevfestConfig;
  formats: PartnershipFormat[];
  benefits: PartnershipBenefit[];
  tiers: PartnershipTier[];
  faqs: PartnershipFaq[];
  contact: PartnershipContactConfig;
  updatedAt?: string;
  updatedBy?: string;
}

// ── Featured Event Types ───────────────────────────────────────────────────

export interface FeaturedEventContent {
  enabled: boolean;
  eventId?: string; // Optional Bevy/Firestore event ID to link
  badge: string; // e.g. "Featured Gathering", "Flagship Conference"
  title: string; // e.g. "DevFest Jakarta 2026"
  description: string; // Brief event summary
  dateString?: string; // e.g. "Saturday, Nov 14, 2026 • 09:00 WIB"
  location?: string; // e.g. "Auditorium Google Indonesia / Jakarta"
  ctaText: string; // e.g. "RSVP & Get Tickets"
  ctaUrl: string; // Destination URL
  secondaryCtaText?: string; // e.g. "View Event Details"
  secondaryCtaUrl?: string;

  // Video Configuration
  videoSourceType: "url" | "upload";
  videoUrl: string; // External video URL or R2 streaming URL
  videoPosterUrl?: string; // Fallback thumbnail image URL
  videoStorageKey?: string; // R2 key if uploaded (e.g. featured-videos/devfest-teaser.mp4)
  autoplay: boolean; // default: true
  muted: boolean; // default: true (required for browser autoplay)
  loop: boolean; // default: true
  showControls?: boolean; // default: true

  updatedAt?: string;
  updatedBy?: string;
}

// ── Payment Policy Types ───────────────────────────────────────────────────

export interface PaymentPolicySection {
  id: string;
  title: string;
  iconName?: string;
  badge?: string;
  body: string;
  bullets?: string[];
  callout?: {
    type: "info" | "warning" | "destructive" | "success";
    title?: string;
    message: string;
  };
  order?: number;
  isActive?: boolean;
}

export interface PaymentPolicyChannel {
  id: string;
  title: string;
  description: string;
  iconName?: string;
  links: {
    label: string;
    url: string;
    isExternal?: boolean;
  }[];
}

export interface PaymentPolicyContent {
  header: {
    badge: string;
    title: string;
    description: string;
  };
  notice: {
    enabled: boolean;
    title: string;
    description: string;
    verifiedEmails: string[];
  };
  sections: PaymentPolicySection[];
  channels: PaymentPolicyChannel[];
  contact: {
    title: string;
    description: string;
    email: string;
    instagram: string;
  };
  updatedAt?: string;
  updatedBy?: string;
}
