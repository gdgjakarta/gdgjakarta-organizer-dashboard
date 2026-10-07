import type { CustomQuestion, EventSession } from "@/lib/firestore/types";

/**
 * Section definitions for structuring the combined registration form.
 */
export const REGISTRATION_SECTIONS = [
  "Payment & Ticket Details",
  "Commitment Fee & Attendance",
  "Personal & Contact Information",
  "Professional Background & Experience",
  "Technical Focus & Event Preferences",
  "Expectations & Community",
  "Consent & Code of Conduct",
] as const;

/**
 * Elaborated Default Registration Questionnaire combining Road to DevFest and Common Event forms.
 */
export const DEFAULT_COMBINED_QUESTIONS: CustomQuestion[] = [
  // ── Section 1: Personal & Contact Information ─────────────────────────────
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
    description: "Please make sure your LinkedIn profile is publicly accessible.",
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
    description: "Please check all boxes to confirm your commitment.",
    section: "Consent & Code of Conduct",
  },
];

/**
 * Road to DevFest specialized template (Focus on Builders & AI Engineering Sprint).
 */
export const ROAD_TO_DEVFEST_TEMPLATE: CustomQuestion[] = DEFAULT_COMBINED_QUESTIONS.filter((q) =>
  [
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
    section: "Consent & Code of Conduct",
  },
];

/**
 * Paid Registration Template (Ticketing with Payment Reconciliation & Invoicing).
 */
export const PAID_REGISTRATION_TEMPLATE: CustomQuestion[] = [
  {
    id: "ticket_tier",
    label: "Selected Ticket Tier",
    type: "select",
    options: ["Regular Admission", "Early Bird Pass", "Student / Academic Pass", "Corporate / VIP Pass"],
    required: true,
    section: "Payment & Ticket Details",
  },
  {
    id: "payment_proof",
    label: "Payment Reference / Bank Transfer Slip",
    type: "text",
    required: true,
    placeholder: "Transfer reference number, bank receipt number, or public image URL",
    description: "Used by organizers to verify payment before ticket confirmation.",
    section: "Payment & Ticket Details",
  },
  {
    id: "billing_name",
    label: "Full Name for Invoice / E-Receipt",
    type: "text",
    required: true,
    placeholder: "e.g. John Doe / PT. Tech Nusantara",
    section: "Payment & Ticket Details",
  },
  {
    id: "billing_company",
    label: "Company / Tax Entity for Official Receipt (Optional)",
    type: "text",
    required: false,
    placeholder: "Leave empty if registering as individual",
    section: "Payment & Ticket Details",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Phone Number",
    type: "text",
    required: true,
    placeholder: "e.g. 628123444555",
    description: "For e-ticket dispatch and check-in QR coordination.",
    section: "Personal & Contact Information",
    validation_type: "isWhatsappNumber",
  },
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
    id: "tshirt_size",
    label: "Event Merchandise T-Shirt Size",
    type: "select",
    options: ["S", "M", "L", "XL", "2XL", "3XL"],
    required: true,
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
    section: "Consent & Code of Conduct",
  },
];

/**
 * Free Registration with Commitment Fee Template.
 * Fully refundable upon physical check-in at the venue desk; strictly forfeited on no-show.
 */
export const COMMITMENT_FEE_TEMPLATE: CustomQuestion[] = [
  {
    id: "commitment_fee_proof",
    label: "Commitment Fee Transfer Slip / Reference",
    type: "text",
    required: true,
    placeholder: "e.g. Bank transfer reference number or slip image URL",
    description:
      "Proof of commitment fee transfer. Fee is 100% refunded in cash at the venue check-in desk upon physical attendance.",
    section: "Commitment Fee & Attendance",
  },
  {
    id: "commitment_refund_choice",
    label: "Commitment Fee Refund Disbursement",
    type: "select",
    options: [
      "Cash Refund at Venue Desk upon Check-in (Standard)",
      "Bank Transfer / E-Wallet (Emergency fallback only)",
    ],
    required: true,
    section: "Commitment Fee & Attendance",
  },
  {
    id: "commitment_refund_account",
    label: "Bank Name & Account Number (Emergency Digital Fallback)",
    type: "text",
    required: false,
    placeholder: "e.g. BCA 123456789 a/n Nama Lengkap",
    section: "Commitment Fee & Attendance",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Phone Number",
    type: "text",
    required: true,
    placeholder: "e.g. 628123444555",
    description: "For check-in verification and commitment fee cash return desk.",
    section: "Personal & Contact Information",
    validation_type: "isWhatsappNumber",
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
      "I agree to adhere to the GDG Community Guidelines.",
    ],
    required: true,
    section: "Consent & Code of Conduct",
  },
];

/**
 * Multiple Track / Session Registration Template.
 * Tailored for multi-track agendas (e.g. Morning Keynote vs Afternoon Codelabs vs Regular Ticket).
 */
export const MULTI_TRACK_TEMPLATE: CustomQuestion[] = [
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
    section: "Consent & Code of Conduct",
  },
];

/**
 * Curated Registration Template (Single Track / General).
 * Enforces Curation Mode (requires_approval = true) with MANDATORY LinkedIn Profile and Work Email.
 */
export const CURATED_REGISTRATION_TEMPLATE: CustomQuestion[] = [
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
    description: "Public LinkedIn profile for organizing committee review.",
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
    section: "Consent & Code of Conduct",
  },
];

/**
 * Curated Registration with Combined Multi-Track Sessions Template (e.g. Road to DevFest Builder Sprint).
 * Combines Multi-Track session breakdown with mandatory LinkedIn Profile and Work Email curation.
 */
export const CURATED_COMBINED_SESSIONS_TEMPLATE: CustomQuestion[] = [
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
    description: "Public LinkedIn profile for organizing committee review.",
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
    section: "Consent & Code of Conduct",
  },
];

/**
 * Standard GDG Jakarta Session Tracks matching n8n workflow configurations:
 * - Morning Session: 105 seats, 08:15 WIB - 12:00 WIB (checkin deadline: 09:05 WIB)
 * - Afternoon Session: 100 seats, 13:10 WIB - 16:55 WIB (checkin deadline: 14:00 WIB)
 * - Regular Ticket: 136 seats, 12:15 WIB - 17:00 WIB (checkin deadline: 13:15 WIB)
 */
export const DEFAULT_GDG_SESSION_CAPACITY = 136;
export const DEFAULT_GDG_SESSION_TIME = "12:15 WIB - 17:00 WIB";
export const DEFAULT_GDG_CHECKIN_DEADLINE = "13:15 WIB";

export const GDG_SESSION_CAPACITY_MAP: Record<string, number> = {
  "Morning Session": 105,
  "Afternoon Session": 100,
  "Regular Ticket": 136,
};

export const GDG_SESSION_TIME_MAP: Record<string, string> = {
  "Morning Session": "08:15 WIB - 12:00 WIB (Morning Session)",
  "Afternoon Session": "13:10 WIB - 16:55 WIB (Afternoon Session)",
  "Regular Ticket": "12:15 WIB - 17:00 WIB",
};

export const GDG_SESSION_CHECKIN_DEADLINE_MAP: Record<string, string> = {
  "Morning Session": "09:05 WIB",
  "Afternoon Session": "14:00 WIB",
  "Regular Ticket": "13:15 WIB",
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
    id: "regular-ticket",
    title: "Regular Ticket",
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
 */
export interface EventFormatTemplate {
  id: string;
  name: string;
  badge: string;
  description: string;
  requires_approval: boolean;
  sessions?: EventSession[];
  questions: CustomQuestion[];
}

/**
 * Registry of all GDG Jakarta Event Format Templates.
 */
export const EVENT_FORMAT_TEMPLATES: EventFormatTemplate[] = [
  {
    id: "free",
    name: "Free Registration",
    badge: "Open RSVP",
    description: "Open community meetup or tech talk with instant RSVP confirmation.",
    requires_approval: false,
    questions: FREE_REGISTRATION_TEMPLATE,
  },
  {
    id: "paid",
    name: "Paid Registration",
    badge: "Paid Admission",
    description: "Paid conference or summit with payment reconciliation, ticket tier, and invoicing.",
    requires_approval: false,
    questions: PAID_REGISTRATION_TEMPLATE,
  },
  {
    id: "commitment_fee",
    name: "Free Registration with Commitment Fee",
    badge: "Refundable Fee",
    description: "100% refundable fee returned in cash upon physical check-in; strictly forfeited on no-show.",
    requires_approval: false,
    questions: COMMITMENT_FEE_TEMPLATE,
  },
  {
    id: "multi_track",
    name: "Multiple Track / Session Registration",
    badge: "Multi-Track",
    description: "Event split into Morning, Afternoon, and Regular session tracks with independent capacity.",
    requires_approval: false,
    sessions: DEFAULT_GDG_SESSIONS,
    questions: MULTI_TRACK_TEMPLATE,
  },
  {
    id: "curated",
    name: "Curated Registration",
    badge: "Curated RSVP",
    description: "Organizer curation mode. ALWAYS requires verified Work Email and LinkedIn Profile.",
    requires_approval: true,
    questions: CURATED_REGISTRATION_TEMPLATE,
  },
  {
    id: "curated_combined_sessions",
    name: "Curated Registration with Combined Sessions",
    badge: "Curated + Tracks",
    description: "Multi-track breakout sessions with curation review. ALWAYS requires Work Email & LinkedIn Profile.",
    requires_approval: true,
    sessions: DEFAULT_GDG_SESSIONS,
    questions: CURATED_COMBINED_SESSIONS_TEMPLATE,
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
