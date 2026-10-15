import type {
  CustomQuestion,
  EventMerchandiseItem,
  EventSession,
  EventTicketTier,
  FirestoreEvent,
} from "@/lib/firestore/types";

import { getRecommendedTicketsForFormat } from "./ticket-templates";

/**
 * Section definitions for structuring the combined registration form.
 */
export const REGISTRATION_SECTIONS = [
  "Payment Details",
  "Payment & Ticket Details",
  "Commitment Fee & Attendance",
  "Personal & Contact Information",
  "Professional Background & Experience",
  "Technical Focus & Event Preferences",
  "Expectations & Community",
  "Consent & Code of Conduct",
] as const;

/**
 * Standard locked payment details questions required for paid passes, commitment fees, or merchandise.
 * These cannot be modified or deleted by organizers to preserve ticketing and invoice delivery integrity.
 */
export const DEFAULT_PAYMENT_DETAILS_QUESTIONS: CustomQuestion[] = [
  {
    id: "full_name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "e.g. John Doe",
    description: "Official attendee name for payment receipt, ticket pass issuance, and badge printing.",
    section: "Payment Details",
    locked: true,
    is_payment_required_field: true,
  },
  {
    id: "email",
    label: "Email Address",
    type: "text",
    required: true,
    placeholder: "e.g. name@example.com",
    description: "Payment confirmation invoice, DOKU payment link, and e-ticket pass will be delivered here.",
    section: "Payment Details",
    validation_type: "isEmail",
    locked: true,
    is_payment_required_field: true,
  },
  {
    id: "whatsapp",
    label: "WhatsApp Phone Number",
    type: "text",
    required: true,
    placeholder: "e.g. 628123444555",
    description: "Required for payment link dispatch, check-in QR coordination, and checkpoint updates.",
    section: "Payment Details",
    validation_type: "isWhatsappNumber",
    locked: true,
    is_payment_required_field: true,
  },
];

/**
 * Checks whether an event configuration requires payment details (paid tickets, commitment fees, or paid merchandise).
 */
export function hasPaidTicketOrMerchandise(eventOrConfig: {
  tickets?: EventTicketTier[] | null;
  merchandise?: EventMerchandiseItem[] | null;
  bundles?: { price?: number }[] | null;
}): boolean {
  const hasPaidTicket = (eventOrConfig.tickets ?? []).some(
    (t) => t.type === "paid" || t.type === "commitment_fee" || (t.price ?? 0) > 0,
  );
  const hasPaidBundle = (eventOrConfig.bundles ?? []).some((b) => (b.price ?? 0) > 0);
  const hasPaidMerch = (eventOrConfig.merchandise ?? []).some((m) => !m.is_free && (m.price ?? 0) > 0);
  return hasPaidTicket || hasPaidBundle || hasPaidMerch;
}

export interface DuplicateFieldReport {
  hasDuplicates: boolean;
  duplicateLabels: string[];
  duplicateDetails: string[];
}

/**
 * Detects duplicate registration questions (such as duplicate Full Name, Email, or WhatsApp questions)
 * across sections to warn organizers when saving changes.
 */
export function detectDuplicateRegistrationFields(questions: CustomQuestion[]): DuplicateFieldReport {
  const duplicateLabels: string[] = [];
  const duplicateDetails: string[] = [];

  // Check 1: Duplicate labels
  const labelCounts = new Map<string, number>();
  for (const q of questions) {
    const norm = q.label.trim().toLowerCase();
    if (norm) {
      labelCounts.set(norm, (labelCounts.get(norm) ?? 0) + 1);
    }
  }
  for (const [norm, count] of labelCounts.entries()) {
    if (count > 1) {
      const original = questions.find((q) => q.label.trim().toLowerCase() === norm)?.label || norm;
      if (!duplicateLabels.includes(original)) {
        duplicateLabels.push(original);
        duplicateDetails.push(`Multiple questions (${count}) share the label "${original}".`);
      }
    }
  }

  // Check 2: If Payment Details exists, check if other sections duplicate Name, primary Email, or WhatsApp
  const paymentQuestions = questions.filter((q) => q.section === "Payment Details" || q.is_payment_required_field);
  const otherQuestions = questions.filter((q) => q.section !== "Payment Details" && !q.is_payment_required_field);

  if (paymentQuestions.length > 0) {
    const hasPaymentName = paymentQuestions.some(
      (q) => q.id === "full_name" || q.label.toLowerCase().includes("full name"),
    );
    const hasPaymentEmail = paymentQuestions.some(
      (q) => q.id === "email" || q.label.toLowerCase() === "email" || q.label.toLowerCase() === "email address",
    );
    const hasPaymentPhone = paymentQuestions.some(
      (q) =>
        q.id === "whatsapp" || q.label.toLowerCase().includes("whatsapp") || q.label.toLowerCase().includes("phone"),
    );

    for (const other of otherQuestions) {
      const lower = other.label.toLowerCase();
      // Duplicate name check
      if (
        hasPaymentName &&
        (other.id === "full_name" ||
          (lower.includes("full name") && !lower.includes("billing") && !lower.includes("receipt")))
      ) {
        if (!duplicateLabels.includes(other.label)) {
          duplicateLabels.push(other.label);
          duplicateDetails.push(
            `"${other.label}" in section "${other.section || "General"}" duplicates the required Full Name in Payment Details.`,
          );
        }
      }
      // Duplicate primary email check (do not flag work email)
      if (
        hasPaymentEmail &&
        (other.id === "email" || lower === "email" || lower === "email address") &&
        other.id !== "work_email" &&
        !lower.includes("work email")
      ) {
        if (!duplicateLabels.includes(other.label)) {
          duplicateLabels.push(other.label);
          duplicateDetails.push(
            `"${other.label}" in section "${other.section || "General"}" duplicates Email Address in Payment Details.`,
          );
        }
      }
      // Duplicate whatsapp check
      if (hasPaymentPhone && (other.id === "whatsapp" || lower.includes("whatsapp"))) {
        if (!duplicateLabels.includes(other.label)) {
          duplicateLabels.push(other.label);
          duplicateDetails.push(
            `"${other.label}" in section "${other.section || "General"}" duplicates WhatsApp Phone Number in Payment Details.`,
          );
        }
      }
    }
  }

  return {
    hasDuplicates: duplicateLabels.length > 0,
    duplicateLabels,
    duplicateDetails,
  };
}

/**
 * Elaborated Default Registration Questionnaire combining Road to DevFest and Common Event forms.
 */
export const DEFAULT_COMBINED_QUESTIONS: CustomQuestion[] = [
  // ── Section 1: Personal & Contact Information ─────────────────────────────
  {
    id: "full_name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "e.g. John Doe",
    description: "Your official name for badges, ticketing, certification, and invoice receipt.",
    section: "Personal & Contact Information",
  },
  {
    id: "work_email",
    label: "Work Email (Validation Purpose)",
    type: "text",
    required: true,
    placeholder: "e.g. info@gdgjakarta.org",
    description: "Usually using the domain name of your company, startup, or institution.",
    section: "Personal & Contact Information",
    validation_type: "isWorkEmail",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Phone Number",
    type: "text",
    required: true,
    placeholder: "e.g. 628123444555",
    description: "For checkpoint coordination, emergency updates, and group announcements.",
    section: "Personal & Contact Information",
    validation_type: "isWhatsappNumber",
  },
  {
    id: "gender",
    label: "Gender",
    type: "radio",
    options: ["Male", "Female", "Prefer not to say"],
    required: true,
    description: "Helps GDG ensure diverse, welcoming, and inclusive community participation.",
    section: "Personal & Contact Information",
  },
  {
    id: "linkedin_url",
    label: "LinkedIn Profile URL",
    type: "text",
    required: false,
    placeholder: "https://linkedin.com/in/username",
    description: "Please make sure your LinkedIn profile is publicly accessible and not set to a private account.",
    section: "Personal & Contact Information",
    validation_type: "isLinkedInProfileUrl",
  },
  {
    id: "portfolio_github_url",
    label: "GitHub / Portfolio / Project Link",
    type: "text",
    required: false,
    placeholder: "https://github.com/username",
    description: "Used by the organizing committee to review and curate participants.",
    section: "Personal & Contact Information",
    validation_type: "isGithubUrl",
  },

  // ── Section 2: Professional Background & Experience ───────────────────────
  {
    id: "professional_background",
    label: "Professional Background",
    type: "radio",
    options: ["Tech", "Non-Tech"],
    required: true,
    description: "Indicate whether your primary background is technical or non-technical.",
    section: "Professional Background & Experience",
  },
  {
    id: "company_or_institution",
    label: "Current Company / Organization / Institution",
    type: "text",
    required: true,
    placeholder: "e.g. Google, GoTo, Universitas Indonesia, Freelance",
    description: "Your current employer, school, or community affiliation.",
    section: "Professional Background & Experience",
  },
  {
    id: "role_or_title",
    label: "Current Role / Occupation / Job Title",
    type: "text",
    required: true,
    placeholder: "e.g. Senior Software Engineer, Android Developer, Student",
    description: "Your primary role or area of focus.",
    section: "Professional Background & Experience",
  },
  {
    id: "persona_description",
    label: "What is the best way to describe you?",
    type: "select",
    options: [
      "I'm a professional that works for an enterprise",
      "I'm a professional that works for a startup",
      "I'm a professional who does project as freelancer",
      "I'm a fresh graduate who is looking for a job as developer",
      "I'm a student",
      "Not a developer",
    ],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "years_of_experience",
    label: "Years of Professional Experience",
    type: "select",
    options: ["Student / < 1 year", "1 – 3 years", "3 – 5 years", "5+ years"],
    required: true,
    description: "Helps tailor the technical depth of talks and breakout sessions.",
    section: "Professional Background & Experience",
  },
  {
    id: "primary_tech_stack",
    label: "Primary Tech Stack & Languages",
    type: "select",
    options: [
      "TypeScript / JavaScript",
      "Python",
      "Kotlin / Android",
      "Go",
      "Java",
      "Cloud / DevOps",
      "AI / ML",
      "Flutter",
      "Other",
    ],
    required: true,
    section: "Professional Background & Experience",
  },

  // ── Section 3: Technical Focus & Event Preferences ────────────────────────
  {
    id: "genai_experience",
    label: "Experience with Generative AI & Google Cloud Technologies",
    type: "multiselect",
    options: [
      "Gemini API / Google AI Studio",
      "Google Agent Development Kit (ADK) / Agent Engines",
      "Android Studio Agent Mode / AICore",
      "Local LLMs & Tokenization Optimization",
      "Cloud Run / Container Sandboxes / Vertex AI",
      "None yet, but eager to learn",
      "Other",
    ],
    required: false,
    description: "Select all technologies that you have worked with or are actively exploring.",
    section: "Technical Focus & Event Preferences",
  },
  {
    id: "preferred_activities",
    label: "What kind of activities are you interested in joining?",
    type: "multiselect",
    options: ["Keynote", "Technical Talk with Demo", "Workshop / Hands-on Lab", "Networking Space", "Fireside Chat"],
    required: false,
    section: "Technical Focus & Event Preferences",
  },
  {
    id: "topics_of_interest",
    label: "What topics do you want to explore or discuss at this event?",
    type: "multiselect",
    options: [
      "Android",
      "Flutter",
      "Vertex AI",
      "Gemini & AI Agents",
      "Web",
      "Cloud & Infrastructure",
      "Antigravity",
      "Other",
    ],
    required: false,
    section: "Technical Focus & Event Preferences",
  },
  {
    id: "project_idea",
    label: "Brief Project Idea / Problem Statement (Optional)",
    type: "textarea",
    required: false,
    placeholder: "What problem are you interested in solving during the building sprint or hackathon?",
    description: "Share any prototype concepts or engineering problems you wish to tackle.",
    section: "Technical Focus & Event Preferences",
  },

  // ── Section 4: Expectations & Community ───────────────────────────────────
  {
    id: "expectations",
    label: "What do you expect by the end of this program / event?",
    type: "textarea",
    required: false,
    placeholder: "Tell us what you hope to learn, who you hope to meet, or what you plan to build...",
    section: "Expectations & Community",
  },
  {
    id: "hobbies_interests",
    label: "What else are you into besides tech stuff?",
    type: "text",
    required: false,
    placeholder: "e.g. Photography, specialty coffee, gaming, running, music",
    description: "Fun icebreakers for networking tables!",
    section: "Expectations & Community",
  },
  {
    id: "referral_source",
    label: "How did you know about our event?",
    type: "select",
    options: [
      "Community Platform (https://gdg.community.dev/gdg-jakarta)",
      "Instagram (https://gdgjakarta.org/instagram)",
      "LinkedIn (https://gdgjakarta.org/linkedin)",
      "Discord (https://goo.gle/googledevsid)",
      "Email / Newsletters",
      "Friends / Colleagues",
      "Other",
    ],
    required: true,
    section: "Expectations & Community",
  },

  // ── Section 5: Consent & Code of Conduct ──────────────────────────────────
  {
    id: "terms_agreement",
    label: "Terms & Code of Conduct Agreement",
    type: "checkbox",
    options: [
      "I agree that videos and photos taken during the event might be used for GDG community and media coverage.",
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
      "I understand that any sprint/hackathon submissions must be newly built during the event timeline.",
    ],
    required: true,
    checkbox_requirement: "all",
    description: "Please check all boxes to confirm your commitment.",
    section: "Consent & Code of Conduct",
  },
];

/**
 * Road to DevFest specialized template (Focus on Builders & AI Engineering Sprint).
 */
export const ROAD_TO_DEVFEST_TEMPLATE: CustomQuestion[] = DEFAULT_COMBINED_QUESTIONS.filter((q) =>
  [
    "full_name",
    "work_email",
    "whatsapp",
    "gender",
    "linkedin_url",
    "portfolio_github_url",
    "professional_background",
    "role_or_title",
    "years_of_experience",
    "company_or_institution",
    "primary_tech_stack",
    "genai_experience",
    "project_idea",
    "expectations",
    "hobbies_interests",
    "referral_source",
    "terms_agreement",
  ].includes(q.id),
);

/**
 * Common Meetup template (Balanced for general community talks and workshops).
 */
export const COMMON_MEETUP_TEMPLATE: CustomQuestion[] = DEFAULT_COMBINED_QUESTIONS.filter((q) =>
  [
    "full_name",
    "work_email",
    "whatsapp",
    "gender",
    "company_or_institution",
    "persona_description",
    "years_of_experience",
    "role_or_title",
    "linkedin_url",
    "preferred_activities",
    "topics_of_interest",
    "expectations",
    "hobbies_interests",
    "referral_source",
    "terms_agreement",
  ].includes(q.id),
);

/**
 * Fast RSVP Lightweight template (Low friction for open community meetups).
 */
export const QUICK_RSVP_TEMPLATE: CustomQuestion[] = [
  {
    id: "full_name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "e.g. John Doe",
    section: "Personal & Contact Information",
  },
  {
    id: "email",
    label: "Email Address",
    type: "text",
    required: true,
    placeholder: "e.g. name@example.com",
    section: "Personal & Contact Information",
    validation_type: "isEmail",
  },
  {
    id: "role_or_title",
    label: "Current Role / Occupation",
    type: "text",
    required: true,
    placeholder: "e.g. Software Engineer, Student",
    section: "Professional Background & Experience",
  },
  {
    id: "company_or_institution",
    label: "Company or Institution",
    type: "text",
    required: true,
    placeholder: "e.g. GoTo, UI, Freelance",
    section: "Professional Background & Experience",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Phone Number",
    type: "text",
    required: true,
    placeholder: "e.g. 628123444555",
    section: "Personal & Contact Information",
    validation_type: "isWhatsappNumber",
  },
  {
    id: "referral_source",
    label: "How did you find this event?",
    type: "select",
    options: ["Community Platform (gdg.community.dev)", "Instagram (@gdgjakarta)", "LinkedIn (GDG Jakarta)", "Friends"],
    required: false,
    section: "Expectations & Community",
  },
];

/**
 * Free Registration Template (Open Community Meetup / Tech Talk).
 * Low friction, open community admission.
 */
export const FREE_REGISTRATION_TEMPLATE: CustomQuestion[] = [
  {
    id: "full_name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "e.g. John Doe",
    description: "Official name for check-in and community participation.",
    section: "Personal & Contact Information",
  },
  {
    id: "email",
    label: "Email Address",
    type: "text",
    required: true,
    placeholder: "e.g. name@example.com",
    description: "Event updates and digital ticket check-in barcode will be sent here.",
    section: "Personal & Contact Information",
    validation_type: "isEmail",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Phone Number",
    type: "text",
    required: true,
    placeholder: "e.g. 628123444555",
    description: "For venue access, checkpoint coordination, and announcements.",
    section: "Personal & Contact Information",
    validation_type: "isWhatsappNumber",
  },
  {
    id: "gender",
    label: "Gender",
    type: "radio",
    options: ["Male", "Female", "Prefer not to say"],
    required: true,
    section: "Personal & Contact Information",
  },
  {
    id: "role_or_title",
    label: "Current Role / Job Title",
    type: "text",
    required: true,
    placeholder: "e.g. Frontend Developer, Student",
    section: "Professional Background & Experience",
  },
  {
    id: "company_or_institution",
    label: "Current Company or Institution",
    type: "text",
    required: true,
    placeholder: "e.g. GoTo, UI, Freelance",
    section: "Professional Background & Experience",
  },
  {
    id: "dietary_preference",
    label: "Dietary Restrictions / Catering Preference",
    type: "select",
    options: ["No Restrictions (Standard)", "Halal", "Vegetarian", "Vegan", "No Beef", "Other"],
    required: true,
    section: "Personal & Contact Information",
  },
  {
    id: "tshirt_size",
    label: "T-Shirt Size (Unisex)",
    type: "select",
    options: ["S", "M", "L", "XL", "2XL", "3XL"],
    required: false,
    description: "For GDG community event merchandise and apparel.",
    section: "Personal & Contact Information",
  },
  {
    id: "referral_source",
    label: "How did you find out about this event?",
    type: "select",
    options: [
      "Community Platform (https://gdg.community.dev/gdg-jakarta)",
      "Instagram (https://gdgjakarta.org/instagram)",
      "LinkedIn (https://gdgjakarta.org/linkedin)",
      "Friends / Colleagues",
      "Other",
    ],
    required: true,
    section: "Expectations & Community",
  },
  {
    id: "terms_agreement",
    label: "GDG Community Guidelines & Media Consent",
    type: "checkbox",
    options: [
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
      "I agree that event photos and videos may be taken for GDG community coverage.",
    ],
    required: true,
    checkbox_requirement: "all",
    section: "Consent & Code of Conduct",
  },
];

/**
 * Paid Registration Template (Ticketing with Payment Gateway Reconciliation & Optional Invoicing).
 * Note: Ticket tier selection is handled in Step 1 of registration. Payment is processed via DOKU payment link.
 */
export const PAID_REGISTRATION_TEMPLATE: CustomQuestion[] = [
  ...DEFAULT_PAYMENT_DETAILS_QUESTIONS,
  {
    id: "role_or_title",
    label: "Current Role / Occupation",
    type: "text",
    required: true,
    placeholder: "e.g. Software Engineer, Tech Lead",
    section: "Professional Background & Experience",
  },
  {
    id: "company_or_institution",
    label: "Company / Organization",
    type: "text",
    required: true,
    placeholder: "e.g. GoTo, Shopee, Startup",
    section: "Professional Background & Experience",
  },
  {
    id: "billing_name",
    label: "Full Name for E-Receipt / Tax Invoice (Optional)",
    type: "text",
    required: false,
    placeholder: "e.g. John Doe / PT. Tech Nusantara",
    description: "Provide if an official tax invoice or company reimbursement receipt is required.",
    section: "Payment & Ticket Details",
  },
  {
    id: "billing_company",
    label: "Company / Tax Entity for Official Receipt (Optional)",
    type: "text",
    required: false,
    placeholder: "Corporate billing name or NPWP/tax ID if employer sponsored",
    section: "Payment & Ticket Details",
  },
  {
    id: "tshirt_size",
    label: "Event Merchandise T-Shirt Size",
    type: "select",
    options: ["S", "M", "L", "XL", "2XL", "3XL"],
    required: true,
    description: "Apparel sizing for conference swag kit included with your pass.",
    section: "Personal & Contact Information",
  },
  {
    id: "dietary_preference",
    label: "Dietary Restrictions / Catering",
    type: "select",
    options: ["No Restrictions (Standard)", "Halal", "Vegetarian", "Vegan", "No Beef", "Other"],
    required: true,
    section: "Personal & Contact Information",
  },
  {
    id: "terms_paid",
    label: "Ticketing & Refund Terms",
    type: "checkbox",
    options: [
      "I understand that purchased tickets are non-refundable and non-transferable.",
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
    ],
    required: true,
    checkbox_requirement: "all",
    section: "Consent & Code of Conduct",
  },
];

/**
 * Free Registration with Commitment Fee Template.
 * Deposit pass is paid via payment link; 100% refunded in cash upon physical on-site check-in at venue desk.
 */
export const COMMITMENT_FEE_TEMPLATE: CustomQuestion[] = [
  ...DEFAULT_PAYMENT_DETAILS_QUESTIONS,
  {
    id: "role_or_title",
    label: "Current Role / Occupation",
    type: "text",
    required: true,
    placeholder: "e.g. Software Engineer, Student",
    section: "Professional Background & Experience",
  },
  {
    id: "company_or_institution",
    label: "Company or Institution",
    type: "text",
    required: true,
    placeholder: "e.g. GoTo, UI, Freelance",
    section: "Professional Background & Experience",
  },
  {
    id: "tshirt_size",
    label: "T-Shirt Size",
    type: "select",
    options: ["S", "M", "L", "XL", "2XL", "3XL"],
    required: false,
    section: "Personal & Contact Information",
  },
  {
    id: "dietary_preference",
    label: "Dietary Restrictions",
    type: "select",
    options: ["No Restrictions (Standard)", "Halal", "Vegetarian", "Vegan", "No Beef", "Other"],
    required: true,
    section: "Personal & Contact Information",
  },
  {
    id: "commitment_policy_agreement",
    label: "Commitment Fee Terms & Attendance Agreement",
    type: "checkbox",
    options: [
      "I understand that the commitment fee will be refunded 100% in cash upon physical attendance and check-in on event day.",
      "I acknowledge that failing to attend the event physically forfeits the commitment fee to cover venue catering and reservation expenses.",
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
    ],
    required: true,
    checkbox_requirement: "all",
    section: "Consent & Code of Conduct",
  },
];

/**
 * Multiple Track / Session Registration Template.
 * Tailored for multi-track agendas (e.g. Morning Keynote vs Afternoon Codelabs vs Full session).
 */
export const MULTI_TRACK_TEMPLATE: CustomQuestion[] = [
  {
    id: "full_name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "e.g. John Doe",
    description: "Official attendee name for multi-track pass issuance and check-in.",
    section: "Personal & Contact Information",
  },
  {
    id: "email",
    label: "Email Address",
    type: "text",
    required: true,
    placeholder: "e.g. name@example.com",
    description: "Confirmation, agenda updates, and barcode will be sent to this email.",
    section: "Personal & Contact Information",
    validation_type: "isEmail",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Phone Number",
    type: "text",
    required: true,
    placeholder: "e.g. 628123444555",
    section: "Personal & Contact Information",
    validation_type: "isWhatsappNumber",
  },
  {
    id: "track_preference",
    label: "Technical Tracks of Interest",
    type: "multiselect",
    options: [
      "Keynote & Technical Roadmap",
      "AI & Machine Learning (Gemini / Vertex AI)",
      "Android & Mobile Engineering",
      "Cloud, Kubernetes & DevOps",
      "Web Technologies & Frameworks",
    ],
    required: true,
    description: "Helps the team allocate breakout room capacities.",
    section: "Technical Focus & Event Preferences",
  },
  {
    id: "primary_tech_stack",
    label: "Primary Tech Stack & Languages",
    type: "select",
    options: [
      "TypeScript / JavaScript",
      "Python",
      "Kotlin / Android",
      "Go",
      "Java",
      "Cloud / DevOps",
      "AI / ML",
      "Flutter",
      "Other",
    ],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "years_of_experience",
    label: "Years of Professional Experience",
    type: "select",
    options: ["Student / < 1 year", "1 – 3 years", "3 – 5 years", "5+ years"],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "company_or_institution",
    label: "Current Company or Institution",
    type: "text",
    required: true,
    placeholder: "e.g. GoTo, Universitas Indonesia, Freelance",
    section: "Professional Background & Experience",
  },
  {
    id: "role_or_title",
    label: "Current Role / Job Title",
    type: "text",
    required: true,
    placeholder: "e.g. Software Engineer, Student",
    section: "Professional Background & Experience",
  },
  {
    id: "dietary_preference",
    label: "Dietary Restrictions",
    type: "select",
    options: ["No Restrictions (Standard)", "Halal", "Vegetarian", "Vegan", "No Beef", "Other"],
    required: true,
    section: "Personal & Contact Information",
  },
  {
    id: "terms_agreement",
    label: "Code of Conduct & Media Agreement",
    type: "checkbox",
    options: [
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
      "I agree that photos and videos taken during the event may be shared for community highlights.",
    ],
    required: true,
    checkbox_requirement: "all",
    section: "Consent & Code of Conduct",
  },
];

/**
 * Curated Registration (Free) Template.
 * Enforces Curation Mode (requires_approval = true) with MANDATORY LinkedIn Profile and Work Email.
 */
export const CURATED_FREE_TEMPLATE: CustomQuestion[] = [
  {
    id: "full_name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "e.g. John Doe",
    description: "Official attendee name for curation review, badge printing, and event check-in.",
    section: "Personal & Contact Information",
  },
  {
    id: "work_email",
    label: "Work Email (Mandatory for Curation)",
    type: "text",
    required: true,
    placeholder: "e.g. alex@company.com or dev@startup.id",
    description: "Corporate or institutional domain. Consumer webmail (@gmail.com, @yahoo.com) is not accepted.",
    section: "Personal & Contact Information",
    validation_type: "isWorkEmail",
  },
  {
    id: "linkedin_url",
    label: "LinkedIn Profile URL (Mandatory for Curation)",
    type: "text",
    required: true,
    placeholder: "https://linkedin.com/in/username",
    description:
      "Public LinkedIn profile for organizing committee review. Note: Profile must not be a private account so organizers can review and verify your background.",
    section: "Personal & Contact Information",
    validation_type: "isLinkedInProfileUrl",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Phone Number",
    type: "text",
    required: true,
    placeholder: "e.g. 628123444555",
    section: "Personal & Contact Information",
    validation_type: "isWhatsappNumber",
  },
  {
    id: "portfolio_github_url",
    label: "GitHub / Portfolio Link",
    type: "text",
    required: false,
    placeholder: "https://github.com/username",
    description: "Projects or repositories demonstrating engineering experience.",
    section: "Personal & Contact Information",
    validation_type: "isGithubUrl",
  },
  {
    id: "company_or_institution",
    label: "Company / Organization / Institution",
    type: "text",
    required: true,
    placeholder: "e.g. Google, GoTo, Blibli, UI",
    section: "Professional Background & Experience",
  },
  {
    id: "role_or_title",
    label: "Current Role / Job Title",
    type: "text",
    required: true,
    placeholder: "e.g. Senior Software Engineer, Engineering Lead",
    section: "Professional Background & Experience",
  },
  {
    id: "years_of_experience",
    label: "Years of Professional Experience",
    type: "select",
    options: ["Student / < 1 year", "1 – 3 years", "3 – 5 years", "5+ years"],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "primary_tech_stack",
    label: "Primary Tech Stack & Languages",
    type: "select",
    options: [
      "TypeScript / JavaScript",
      "Python",
      "Kotlin / Android",
      "Go",
      "Java",
      "Cloud / DevOps",
      "AI / ML",
      "Flutter",
      "Other",
    ],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "curation_motivation",
    label: "Why are you interested in joining, and what will you contribute?",
    type: "textarea",
    required: true,
    min_length: 30,
    max_length: 600,
    placeholder: "Share your engineering motivations, goals, and technical background...",
    description: "The organizing committee reviews this answer to curate the participant cohort.",
    section: "Expectations & Community",
  },
  {
    id: "curation_terms",
    label: "Curation & Admission Agreement",
    type: "checkbox",
    options: [
      "I understand that submissions are curated and registration is only confirmed once approved by the organizing committee.",
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
    ],
    required: true,
    checkbox_requirement: "all",
    section: "Consent & Code of Conduct",
  },
];

/** Backwards-compatible alias for CURATED_FREE_TEMPLATE */
export const CURATED_REGISTRATION_TEMPLATE: CustomQuestion[] = CURATED_FREE_TEMPLATE;

/**
 * Curated Registration (Commitment Fee) Template.
 * Combines organizer curation review (Work Email + LinkedIn Profile) with refundable commitment fee.
 */
export const CURATED_COMMITMENT_FEE_TEMPLATE: CustomQuestion[] = [
  ...DEFAULT_PAYMENT_DETAILS_QUESTIONS,
  {
    id: "work_email",
    label: "Work Email (Mandatory for Curation)",
    type: "text",
    required: true,
    placeholder: "e.g. alex@company.com or dev@startup.id",
    description: "Corporate or institutional domain. Personal email (@gmail.com) is not accepted.",
    section: "Personal & Contact Information",
    validation_type: "isWorkEmail",
  },
  {
    id: "linkedin_url",
    label: "LinkedIn Profile URL (Mandatory for Curation)",
    type: "text",
    required: true,
    placeholder: "https://linkedin.com/in/username",
    description:
      "Public LinkedIn profile for organizing committee review. Note: Profile must not be a private account so organizers can review and verify your background.",
    section: "Personal & Contact Information",
    validation_type: "isLinkedInProfileUrl",
  },
  {
    id: "portfolio_github_url",
    label: "GitHub / Portfolio / Project Link",
    type: "text",
    required: false,
    placeholder: "https://github.com/username",
    description: "Projects or repositories demonstrating engineering experience.",
    section: "Personal & Contact Information",
    validation_type: "isGithubUrl",
  },
  {
    id: "company_or_institution",
    label: "Company / Organization / Institution",
    type: "text",
    required: true,
    placeholder: "e.g. GoTo, Shopee, UI, ITB",
    section: "Professional Background & Experience",
  },
  {
    id: "role_or_title",
    label: "Current Role / Job Title",
    type: "text",
    required: true,
    placeholder: "e.g. Senior Software Engineer, ML Engineer",
    section: "Professional Background & Experience",
  },
  {
    id: "years_of_experience",
    label: "Years of Professional Experience",
    type: "select",
    options: ["Student / < 1 year", "1 – 3 years", "3 – 5 years", "5+ years"],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "primary_tech_stack",
    label: "Primary Tech Stack",
    type: "select",
    options: [
      "TypeScript / JavaScript",
      "Python",
      "Kotlin / Android",
      "Go",
      "Java",
      "Cloud / DevOps",
      "AI / ML",
      "Flutter",
      "Other",
    ],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "curation_motivation",
    label: "Why are you interested in joining, and what will you contribute?",
    type: "textarea",
    required: true,
    min_length: 30,
    max_length: 600,
    placeholder: "Tell us about what you hope to build, problems you're tackling, and your sprint goals...",
    description: "Reviewers evaluate this essay to select participants for limited seats.",
    section: "Expectations & Community",
  },
  {
    id: "curation_commitment_terms",
    label: "Curation & Commitment Terms Agreement",
    type: "checkbox",
    options: [
      "I understand that submissions are curated and registration is only confirmed once approved by the organizing committee.",
      "I understand that the commitment fee will be refunded 100% in cash upon physical check-in on event day, and forfeited on no-show.",
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
    ],
    required: true,
    checkbox_requirement: "all",
    section: "Consent & Code of Conduct",
  },
];

/**
 * Curated Registration + Multiple Sessions (Free) Template (e.g. Road to DevFest Builder Sprint).
 * Combines Multi-Track session breakdown with mandatory LinkedIn Profile and Work Email curation.
 */
export const CURATED_MULTI_FREE_TEMPLATE: CustomQuestion[] = [
  {
    id: "full_name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "e.g. John Doe",
    description: "Official attendee name for session track curation, badges, and check-in.",
    section: "Personal & Contact Information",
  },
  {
    id: "work_email",
    label: "Work Email (Mandatory for Curated Combined Sessions)",
    type: "text",
    required: true,
    placeholder: "e.g. alex@company.com or dev@startup.id",
    description: "Corporate or institutional domain. Personal email (@gmail.com) is not accepted.",
    section: "Personal & Contact Information",
    validation_type: "isWorkEmail",
  },
  {
    id: "linkedin_url",
    label: "LinkedIn Profile URL (Mandatory for Curated Combined Sessions)",
    type: "text",
    required: true,
    placeholder: "https://linkedin.com/in/username",
    description:
      "Public LinkedIn profile for organizing committee review. Note: Profile must not be a private account so organizers can review and verify your background.",
    section: "Personal & Contact Information",
    validation_type: "isLinkedInProfileUrl",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Phone Number",
    type: "text",
    required: true,
    placeholder: "e.g. 628123444555",
    section: "Personal & Contact Information",
    validation_type: "isWhatsappNumber",
  },
  {
    id: "portfolio_github_url",
    label: "GitHub / Portfolio / Project Link",
    type: "text",
    required: false,
    placeholder: "https://github.com/username",
    description: "Open-source work, personal projects, or published repositories.",
    section: "Personal & Contact Information",
    validation_type: "isGithubUrl",
  },
  {
    id: "company_or_institution",
    label: "Company / Organization / University",
    type: "text",
    required: true,
    placeholder: "e.g. GoTo, Shopee, UI, ITB",
    section: "Professional Background & Experience",
  },
  {
    id: "role_or_title",
    label: "Current Role / Job Title",
    type: "text",
    required: true,
    placeholder: "e.g. Senior Software Engineer, ML Engineer",
    section: "Professional Background & Experience",
  },
  {
    id: "years_of_experience",
    label: "Years of Professional Experience",
    type: "select",
    options: ["Student / < 1 year", "1 – 3 years", "3 – 5 years", "5+ years"],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "primary_tech_stack",
    label: "Primary Tech Stack",
    type: "select",
    options: [
      "TypeScript / JavaScript",
      "Python",
      "Kotlin / Android",
      "Go",
      "Java",
      "Cloud / DevOps",
      "AI / ML",
      "Flutter",
      "Other",
    ],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "genai_experience",
    label: "Experience with Generative AI & Google Cloud Technologies",
    type: "multiselect",
    options: [
      "Gemini API / Google AI Studio",
      "Google Agent Development Kit (ADK) / Agent Engines",
      "Android Studio Agent Mode / AICore",
      "Cloud Run / Container Sandboxes / Vertex AI",
      "None yet, but eager to learn",
      "Other",
    ],
    required: false,
    section: "Technical Focus & Event Preferences",
  },
  {
    id: "curation_motivation",
    label: "Why are you interested in joining, and what will you contribute?",
    type: "textarea",
    required: true,
    min_length: 30,
    max_length: 600,
    placeholder: "Tell us about what you hope to build, problems you're tackling, and your sprint goals...",
    description: "Reviewers evaluate this essay to select participants for limited breakout session seats.",
    section: "Expectations & Community",
  },
  {
    id: "curation_terms",
    label: "Curation & Admission Agreement",
    type: "checkbox",
    options: [
      "I understand that submissions are curated and registration is only confirmed once approved by the organizing committee.",
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
    ],
    required: true,
    checkbox_requirement: "all",
    section: "Consent & Code of Conduct",
  },
];

/** Backwards-compatible alias for CURATED_MULTI_FREE_TEMPLATE */
export const CURATED_COMBINED_SESSIONS_TEMPLATE: CustomQuestion[] = CURATED_MULTI_FREE_TEMPLATE;

/**
 * Curated Registration + Multiple Sessions (Commitment Fee) Template.
 * Combines multi-track capacity split, mandatory Work Email & LinkedIn curation, and refundable commitment fee.
 */
export const CURATED_MULTI_COMMITMENT_TEMPLATE: CustomQuestion[] = [
  ...DEFAULT_PAYMENT_DETAILS_QUESTIONS,
  {
    id: "work_email",
    label: "Work Email (Mandatory for Curation)",
    type: "text",
    required: true,
    placeholder: "e.g. alex@company.com or dev@startup.id",
    description: "Corporate or institutional domain. Personal email (@gmail.com) is not accepted.",
    section: "Personal & Contact Information",
    validation_type: "isWorkEmail",
  },
  {
    id: "linkedin_url",
    label: "LinkedIn Profile URL (Mandatory for Curation)",
    type: "text",
    required: true,
    placeholder: "https://linkedin.com/in/username",
    description:
      "Public LinkedIn profile for organizing committee review. Note: Profile must not be a private account so organizers can review and verify your background.",
    section: "Personal & Contact Information",
    validation_type: "isLinkedInProfileUrl",
  },
  {
    id: "portfolio_github_url",
    label: "GitHub / Portfolio / Project Link",
    type: "text",
    required: false,
    placeholder: "https://github.com/username",
    description: "Open-source work, personal projects, or published repositories.",
    section: "Personal & Contact Information",
    validation_type: "isGithubUrl",
  },
  {
    id: "company_or_institution",
    label: "Company / Organization / University",
    type: "text",
    required: true,
    placeholder: "e.g. GoTo, Shopee, UI, ITB",
    section: "Professional Background & Experience",
  },
  {
    id: "role_or_title",
    label: "Current Role / Job Title",
    type: "text",
    required: true,
    placeholder: "e.g. Senior Software Engineer, ML Engineer",
    section: "Professional Background & Experience",
  },
  {
    id: "years_of_experience",
    label: "Years of Professional Experience",
    type: "select",
    options: ["Student / < 1 year", "1 – 3 years", "3 – 5 years", "5+ years"],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "primary_tech_stack",
    label: "Primary Tech Stack",
    type: "select",
    options: [
      "TypeScript / JavaScript",
      "Python",
      "Kotlin / Android",
      "Go",
      "Java",
      "Cloud / DevOps",
      "AI / ML",
      "Flutter",
      "Other",
    ],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "curation_motivation",
    label: "Why are you interested in joining, and what will you contribute?",
    type: "textarea",
    required: true,
    min_length: 30,
    max_length: 600,
    placeholder: "Tell us about what you hope to build, problems you're tackling, and your sprint goals...",
    description: "Reviewers evaluate this essay to select participants for limited breakout session seats.",
    section: "Expectations & Community",
  },
  {
    id: "curation_multi_commitment_terms",
    label: "Curation, Session Track & Commitment Fee Agreement",
    type: "checkbox",
    options: [
      "I understand that session tracks are curated and registration is confirmed only upon organizer approval.",
      "I understand that the commitment fee will be refunded 100% in cash upon physical check-in on event day, and forfeited on no-show.",
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
    ],
    required: true,
    checkbox_requirement: "all",
    section: "Consent & Code of Conduct",
  },
];

/**
 * Curated Registration + Multiple Sessions (Paid) Template.
 * Combines multi-track sessions, mandatory Work Email & LinkedIn curation, and paid ticketing with optional invoicing.
 * Note: Ticket tier selection is performed in Step 1. Payment is processed upon organizer approval.
 */
export const CURATED_MULTI_PAID_TEMPLATE: CustomQuestion[] = [
  ...DEFAULT_PAYMENT_DETAILS_QUESTIONS,
  {
    id: "work_email",
    label: "Work Email (Mandatory for Curation)",
    type: "text",
    required: true,
    placeholder: "e.g. alex@company.com or dev@startup.id",
    description: "Corporate or institutional domain. Personal email (@gmail.com) is not accepted.",
    section: "Personal & Contact Information",
    validation_type: "isWorkEmail",
  },
  {
    id: "linkedin_url",
    label: "LinkedIn Profile URL (Mandatory for Curation)",
    type: "text",
    required: true,
    placeholder: "https://linkedin.com/in/username",
    description:
      "Public LinkedIn profile for organizing committee review. Note: Profile must not be a private account so organizers can review and verify your background.",
    section: "Personal & Contact Information",
    validation_type: "isLinkedInProfileUrl",
  },
  {
    id: "portfolio_github_url",
    label: "GitHub / Portfolio / Project Link",
    type: "text",
    required: false,
    placeholder: "https://github.com/username",
    description: "Projects or repositories demonstrating engineering experience.",
    section: "Personal & Contact Information",
    validation_type: "isGithubUrl",
  },
  {
    id: "billing_name",
    label: "Full Name for Invoice / Tax Receipt (Optional)",
    type: "text",
    required: false,
    placeholder: "e.g. John Doe / PT. Company",
    description: "Provide if an official tax invoice or corporate reimbursement receipt is required.",
    section: "Payment & Ticket Details",
  },
  {
    id: "billing_company",
    label: "Company / Tax Entity for Official Receipt (Optional)",
    type: "text",
    required: false,
    placeholder: "Corporate billing details if employer sponsored",
    section: "Payment & Ticket Details",
  },
  {
    id: "company_or_institution",
    label: "Company / Organization / University",
    type: "text",
    required: true,
    placeholder: "e.g. GoTo, Shopee, UI, ITB",
    section: "Professional Background & Experience",
  },
  {
    id: "role_or_title",
    label: "Current Role / Job Title",
    type: "text",
    required: true,
    placeholder: "e.g. Senior Software Engineer, ML Engineer",
    section: "Professional Background & Experience",
  },
  {
    id: "years_of_experience",
    label: "Years of Professional Experience",
    type: "select",
    options: ["Student / < 1 year", "1 – 3 years", "3 – 5 years", "5+ years"],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "primary_tech_stack",
    label: "Primary Tech Stack",
    type: "select",
    options: [
      "TypeScript / JavaScript",
      "Python",
      "Kotlin / Android",
      "Go",
      "Java",
      "Cloud / DevOps",
      "AI / ML",
      "Flutter",
      "Other",
    ],
    required: true,
    section: "Professional Background & Experience",
  },
  {
    id: "curation_motivation",
    label: "Why are you interested in joining, and what will you contribute?",
    type: "textarea",
    required: true,
    min_length: 30,
    max_length: 600,
    placeholder: "Tell us about what you hope to build, problems you're tackling, and your sprint goals...",
    description: "Reviewers evaluate this essay to select participants for limited breakout session seats.",
    section: "Expectations & Community",
  },
  {
    id: "curation_paid_terms",
    label: "Curated Admission & Ticketing Agreement",
    type: "checkbox",
    options: [
      "I understand that registrations are curated and admission is subject to organizing committee confirmation.",
      "I understand that purchased tickets are non-refundable once approved and confirmed.",
      "I agree to adhere to the GDG Community Guidelines and Code of Conduct.",
    ],
    required: true,
    checkbox_requirement: "all",
    section: "Consent & Code of Conduct",
  },
];

/**
 * Standard GDG Jakarta Session Tracks matching n8n workflow configurations:
 * - Morning Session: 105 seats, 08:15 WIB - 12:00 WIB (checkin deadline: 09:05 WIB)
 * - Afternoon Session: 100 seats, 13:10 WIB - 16:55 WIB (checkin deadline: 14:00 WIB)
 * - Full session: 136 seats, 12:15 WIB - 17:00 WIB (checkin deadline: 13:15 WIB)
 */
export const DEFAULT_GDG_SESSION_NAME = "Full session";
export const DEFAULT_GDG_SESSION_CAPACITY = 136;
export const DEFAULT_GDG_SESSION_TIME = "12:15 WIB - 17:00 WIB";
export const DEFAULT_GDG_CHECKIN_DEADLINE = "13:15 WIB";

export const GDG_SESSION_CAPACITY_MAP: Record<string, number> = {
  "Morning Session": 105,
  "Afternoon Session": 100,
  "Full session": 136,
  "Regular Ticket": 136, // Backwards compatibility for existing events & webhooks
};

export const GDG_SESSION_TIME_MAP: Record<string, string> = {
  "Morning Session": "08:15 WIB - 12:00 WIB (Morning Session)",
  "Afternoon Session": "13:10 WIB - 16:55 WIB (Afternoon Session)",
  "Full session": "12:15 WIB - 17:00 WIB",
  "Regular Ticket": "12:15 WIB - 17:00 WIB", // Backwards compatibility
};

export const GDG_SESSION_CHECKIN_DEADLINE_MAP: Record<string, string> = {
  "Morning Session": "09:05 WIB",
  "Afternoon Session": "14:00 WIB",
  "Full session": "13:15 WIB",
  "Regular Ticket": "13:15 WIB", // Backwards compatibility
};

export const DEFAULT_GDG_SESSIONS: EventSession[] = [
  {
    id: "morning-session",
    title: "Morning Session",
    description: "Keynote, technical announcements, and morning sessions.",
    time_slot: "08:15 WIB - 12:00 WIB (Morning Session)",
    checkin_deadline: "09:05 WIB",
    location: "Main Venue",
    capacity: 105,
    total_registered: 0,
  },
  {
    id: "afternoon-session",
    title: "Afternoon Session",
    description: "Technical deep dives, codelabs, and hands-on workshops.",
    time_slot: "13:10 WIB - 16:55 WIB (Afternoon Session)",
    checkin_deadline: "14:00 WIB",
    location: "Main Venue",
    capacity: 100,
    total_registered: 0,
  },
  {
    id: "full-session",
    title: "Full session",
    description: "General admission regular session access.",
    time_slot: "12:15 WIB - 17:00 WIB",
    checkin_deadline: "13:15 WIB",
    location: "Main Venue",
    capacity: 136,
    total_registered: 0,
  },
];

/**
 * Event Format Template structure definition.
 * Encompasses admission policy, breakout session tracks, ticket tiers, and custom questionnaire.
 */
export interface EventFormatTemplate {
  id: string;
  name: string;
  badge: string;
  category: "standard" | "curated";
  description: string;
  requires_approval: boolean;
  sessions?: EventSession[];
  tickets?: EventTicketTier[];
  questions: CustomQuestion[];
}

/**
 * Registry of all GDG Jakarta Event Format Templates.
 * Encompasses 4 Standard Open Formats and 5 Curated Formats, complete with pre-configured ticket tiers.
 */
export const EVENT_FORMAT_TEMPLATES: EventFormatTemplate[] = [
  // ── 1. Standard Open Formats ──
  {
    id: "free",
    name: "Free Registration",
    badge: "Free RSVP",
    category: "standard",
    description: "Open community meetup or tech talk with instant RSVP confirmation.",
    requires_approval: false,
    tickets: getRecommendedTicketsForFormat("free"),
    questions: FREE_REGISTRATION_TEMPLATE,
  },
  {
    id: "paid",
    name: "Paid Registration",
    badge: "Paid Pass",
    category: "standard",
    description: "Paid conference or summit with payment reconciliation, ticket tier, and invoicing.",
    requires_approval: false,
    tickets: getRecommendedTicketsForFormat("paid"),
    questions: PAID_REGISTRATION_TEMPLATE,
  },
  {
    id: "commitment_fee",
    name: "Free Registration with Commitment Fee",
    badge: "Commitment Fee",
    category: "standard",
    description: "100% refundable fee returned in cash upon physical check-in; strictly forfeited on no-show.",
    requires_approval: false,
    tickets: getRecommendedTicketsForFormat("commitment_fee"),
    questions: COMMITMENT_FEE_TEMPLATE,
  },
  {
    id: "multi_track",
    name: "Free / Paid Registration with Multiple Sessions",
    badge: "Multi-Session",
    category: "standard",
    description: "Event split into Morning, Afternoon, and Full session tracks with independent capacity limits.",
    requires_approval: false,
    sessions: DEFAULT_GDG_SESSIONS,
    tickets: getRecommendedTicketsForFormat("multi_track"),
    questions: MULTI_TRACK_TEMPLATE,
  },

  // ── 2. Curated Formats (ALWAYS require Work Email & LinkedIn Profile) ──
  {
    id: "curated_free",
    name: "Curated Registration (Free)",
    badge: "Curated Free",
    category: "curated",
    description:
      "Curated free admission reviewed by organizers. Requires Work Email and Public LinkedIn Profile (not a private account).",
    requires_approval: true,
    tickets: getRecommendedTicketsForFormat("curated_free"),
    questions: CURATED_FREE_TEMPLATE,
  },
  {
    id: "curated_commitment",
    name: "Curated Registration (Commitment Fee)",
    badge: "Curated Fee",
    category: "curated",
    description:
      "Curated admission with refundable commitment fee. Requires Work Email and Public LinkedIn Profile (not a private account).",
    requires_approval: true,
    tickets: getRecommendedTicketsForFormat("curated_commitment"),
    questions: CURATED_COMMITMENT_FEE_TEMPLATE,
  },
  {
    id: "curated_multi_free",
    name: "Curated Registration + Multiple Sessions (Free)",
    badge: "Curated + Sessions",
    category: "curated",
    description:
      "Curated multi-track breakout sessions with free admission. Requires Work Email and Public LinkedIn Profile (not a private account).",
    requires_approval: true,
    sessions: DEFAULT_GDG_SESSIONS,
    tickets: getRecommendedTicketsForFormat("curated_multi_free"),
    questions: CURATED_MULTI_FREE_TEMPLATE,
  },
  {
    id: "curated_multi_commitment",
    name: "Curated Registration + Multiple Sessions (Commitment Fee)",
    badge: "Curated + Fee",
    category: "curated",
    description:
      "Curated multi-track sessions with refundable commitment fee. Requires Work Email and Public LinkedIn Profile (not a private account).",
    requires_approval: true,
    sessions: DEFAULT_GDG_SESSIONS,
    tickets: getRecommendedTicketsForFormat("curated_multi_commitment"),
    questions: CURATED_MULTI_COMMITMENT_TEMPLATE,
  },
  {
    id: "curated_multi_paid",
    name: "Curated Registration + Multiple Sessions (Paid)",
    badge: "Curated + Paid",
    category: "curated",
    description:
      "Curated multi-track conference with paid ticketing & invoicing. Requires Work Email and Public LinkedIn Profile (not a private account).",
    requires_approval: true,
    sessions: DEFAULT_GDG_SESSIONS,
    tickets: getRecommendedTicketsForFormat("curated_multi_paid"),
    questions: CURATED_MULTI_PAID_TEMPLATE,
  },
];

/**
 * Helper to check if a specific session has available spots.
 */
export function isSessionAvailable(session: EventSession, registeredCount = 0): boolean {
  if (!session.capacity || session.capacity <= 0) return true;
  const count = session.total_registered ?? registeredCount;
  return count < session.capacity;
}

/**
 * Helper to calculate remaining seats for a session.
 */
export function getSessionRemainingSeats(session: EventSession, registeredCount = 0): number {
  if (!session.capacity || session.capacity <= 0) return Number.POSITIVE_INFINITY;
  const count = session.total_registered ?? registeredCount;
  return Math.max(0, session.capacity - count);
}

export interface RegistrationWindowStatus {
  isOpen: boolean;
  isWaitlist?: boolean;
  status: "draft" | "upcoming" | "open" | "waitlist" | "ended" | "completed";
  message: string;
  badgeLabel: string;
  opensAt?: string;
  closesAt?: string;
}

/**
 * Calculates real-time registration status based on event draft status,
 * custom registration window (start/end dates), capacity limits, and event start/end dates.
 */
export function getRegistrationWindowStatus(event: FirestoreEvent): RegistrationWindowStatus {
  // 1. Event completed
  if (event.status === "Completed") {
    return {
      isOpen: false,
      isWaitlist: false,
      status: "completed",
      message: "Event Concluded",
      badgeLabel: "Event Concluded",
    };
  }

  // 2. Draft check (registration not opened yet)
  const isDraft = event.registration_status === "Draft" || event.status === "Draft";
  if (isDraft) {
    return {
      isOpen: false,
      isWaitlist: false,
      status: "draft",
      message: "Registration Not Open Yet",
      badgeLabel: "Draft — Not Open",
    };
  }

  // 3. Explicitly closed check
  if (event.registration_status === "Closed") {
    return {
      isOpen: false,
      isWaitlist: false,
      status: "ended",
      message: "Registration Closed",
      badgeLabel: "Registration Closed",
    };
  }

  const now = Date.now();

  // 4. Registration Opens At (scheduled in future)
  if (event.registration_start_date) {
    try {
      const openTime = new Date(event.registration_start_date).getTime();
      if (!Number.isNaN(openTime) && now < openTime) {
        return {
          isOpen: false,
          isWaitlist: false,
          status: "upcoming",
          message: "Registration Opens Soon",
          badgeLabel: "Opens Soon",
          opensAt: event.registration_start_date,
        };
      }
    } catch {
      // ignore
    }
  }

  // 5. Registration Closes At (ended in past)
  if (event.registration_end_date) {
    try {
      const closeTime = new Date(event.registration_end_date).getTime();
      if (!Number.isNaN(closeTime) && now > closeTime) {
        return {
          isOpen: false,
          isWaitlist: false,
          status: "ended",
          message: "Registration Closed",
          badgeLabel: "Registration Closed",
          closesAt: event.registration_end_date,
        };
      }
    } catch {
      // ignore
    }
  }

  // 6. Event date past
  const targetDate = event.end_date || event.start_date;
  if (targetDate) {
    try {
      if (new Date(targetDate).getTime() < now) {
        return {
          isOpen: false,
          isWaitlist: false,
          status: "ended",
          message: "Registration Closed",
          badgeLabel: "Event Concluded",
        };
      }
    } catch {
      // ignore
    }
  }

  // 7. Event capacity check (auto-close direct admission & engage waitlist if allowed)
  const isCurated = Boolean(event.requires_approval || (event as unknown as Record<string, unknown>).curation_mode);
  let venueCapacity: number | null = null;
  if (typeof event.max_attendees === "number" && event.max_attendees > 0) {
    venueCapacity = event.max_attendees;
  } else if (Array.isArray(event.sessions) && event.sessions.length > 0) {
    const totalSessionCap = event.sessions.reduce((acc, s) => acc + (Number(s.capacity) || 0), 0);
    if (totalSessionCap > 0) {
      venueCapacity = totalSessionCap;
    }
  }

  let isFull = false;
  if (venueCapacity !== null && venueCapacity > 0) {
    if (isCurated) {
      if (Number(event.total_approved || 0) >= venueCapacity) {
        isFull = true;
      } else if (
        typeof event.max_attendees === "number" &&
        event.max_attendees > 0 &&
        Number(event.total_registrations || 0) >= event.max_attendees
      ) {
        isFull = true;
      }
    } else {
      if (Number(event.total_registrations || 0) >= venueCapacity) {
        isFull = true;
      }
    }
  }

  // Check if all sessions are full
  if (!isFull && Array.isArray(event.sessions) && event.sessions.length > 0) {
    const sessionsWithCap = event.sessions.filter((s) => typeof s.capacity === "number" && s.capacity > 0);
    if (sessionsWithCap.length > 0) {
      const allSessionsFull = sessionsWithCap.every((s) => (s.total_registered ?? 0) >= s.capacity);
      if (allSessionsFull) {
        isFull = true;
      }
    }
  }

  const allowWaitlist = event.allow_waitlist !== false;

  if (isFull) {
    if (allowWaitlist) {
      return {
        isOpen: true,
        isWaitlist: true,
        status: "waitlist",
        message: "Join Waitlist",
        badgeLabel: "Waitlist Open",
        opensAt: event.registration_start_date ?? undefined,
        closesAt: event.registration_end_date ?? undefined,
      };
    }
    return {
      isOpen: false,
      isWaitlist: false,
      status: "ended",
      message: "Registration Closed (Full)",
      badgeLabel: "Registration Full",
      closesAt: event.registration_end_date ?? undefined,
    };
  }

  return {
    isOpen: true,
    isWaitlist: false,
    status: "open",
    message: "Register for Event",
    badgeLabel: event.requires_approval ? "Approval Required" : "Open for RSVPs",
    opensAt: event.registration_start_date ?? undefined,
    closesAt: event.registration_end_date ?? undefined,
  };
}
