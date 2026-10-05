import type { FaqContent, PartnershipContent } from "./types";

export const DEFAULT_FAQ_CONTENT: FaqContent = {
  header: {
    badge: "GDG Jakarta Community Help Center",
    title: "Frequently Asked Questions",
    description:
      "Everything you need to know about our events, commitment fees, ticket reservations, merchandise distribution, and community guidelines.",
  },
  notice: {
    enabled: true,
    title: "Crucial Payment Notice",
    description:
      "All official payment requests and ticket instructions will ONLY come from verified emails: info@gdgjakarta.org or info@gdgjakarta.com. Please read our Payment Policy for complete rules on commitment fees and merchandise.",
    verifiedEmails: ["info@gdgjakarta.org", "info@gdgjakarta.com"],
    policyUrl: "/payment-policy",
    policyLinkText: "Payment Policy",
  },
  categories: [
    { key: "all", label: "All Questions", iconName: "HelpCircle" },
    { key: "commitment", label: "Commitment Fee", iconName: "Banknote" },
    { key: "merchandise", label: "Merchandise", iconName: "Package" },
    { key: "security", label: "Security & Fraud", iconName: "ShieldAlert" },
    { key: "registration", label: "Registration", iconName: "CheckCircle2" },
    { key: "general", label: "General", iconName: "HelpCircle" },
  ],
  items: [
    {
      id: "commitment-fee-reason",
      category: "commitment",
      categoryLabel: "Commitment Fee",
      question: "Why does GDG Jakarta require a commitment fee for events?",
      answer:
        "Spots for GDG Jakarta events are strictly limited and allocated on a first-come, first-served basis. In past free events, we observed high no-show rates where attendees registered but didn't show up, preventing eager waitlisted developers from attending.\n\nThe commitment fee guarantees that reserved seats are occupied by genuine attendees, respecting the venue capacity and the time our volunteer organizers invest in logistics.",
      order: 1,
      isActive: true,
    },
    {
      id: "commitment-fee-refund",
      category: "commitment",
      categoryLabel: "Commitment Fee",
      question: "How and when do I get my commitment fee refunded?",
      answer:
        "Your commitment fee is fully returned to you in cash on the day of the event upon your physical attendance and check-in at the registration desk.\n\nSimply present your event ticket or QR code to our registration volunteers. Once your check-in is verified, your commitment fee will be handed back to you in full cash.",
      order: 2,
      isActive: true,
    },
    {
      id: "commitment-fee-absence",
      category: "commitment",
      categoryLabel: "Commitment Fee",
      question: "What happens to my commitment fee if I cannot attend the event?",
      answer:
        "If you are unable to attend, the commitment fee will be strictly forfeited.\n\nForfeited fees cannot be refunded under any circumstances. They are used as a financial guarantee to cover the non-refundable venue rental, audiovisual equipment, and catering deposits committed for your reserved seat.",
      order: 3,
      isActive: true,
    },
    {
      id: "commitment-fee-transfer",
      category: "commitment",
      categoryLabel: "Commitment Fee",
      question: "Can I transfer my RSVP and commitment fee to a friend or colleague?",
      answer:
        "Event reservations and commitment fees are generally non-transferable due to venue security guidelines and badge printing.\n\nIf you have an urgent emergency, contact us at least 48 hours prior to the event at info@gdgjakarta.org with your registration details and your proxy's information for organizer consideration.",
      order: 4,
      isActive: true,
    },
    {
      id: "merch-announcements",
      category: "merchandise",
      categoryLabel: "Merchandise",
      question: "Where are merchandise and paid event tickets announced?",
      answer:
        "All sales for official merchandise (t-shirts, jackets, stickers, badges) and paid event access passes will be announced through our official Instagram account: @gdgjakarta.\n\nFollow our Instagram and turn on post notifications so you don't miss exclusive community merchandise drops.",
      order: 5,
      isActive: true,
    },
    {
      id: "merch-collection",
      category: "merchandise",
      categoryLabel: "Merchandise",
      question: "How and when do I collect my purchased merchandise?",
      answer:
        "Merchandise will be distributed on-site on the day of the designated event.\n\nWhen you arrive at the venue, visit the official GDG Jakarta Swag Counter and present your purchase confirmation email or receipt from our verified email address.",
      order: 6,
      isActive: true,
    },
    {
      id: "merch-no-refund-delivery",
      category: "merchandise",
      categoryLabel: "Merchandise",
      question: "Can I request a refund or postal delivery if I cannot attend the event to collect my merchandise?",
      answer:
        "No. If you are unable to attend, we will not provide any kind of refund or merchandise delivery for any reason.\n\nGDG Jakarta is a community-run chapter and does not operate postal shipping or home delivery logistics. If you purchase merchandise, please ensure you or someone authorized can attend in person to collect it.",
      order: 7,
      isActive: true,
    },
    {
      id: "security-verify-payments",
      category: "security",
      categoryLabel: "Security & Fraud",
      question: "How do I verify that a payment request or email is genuinely from GDG Jakarta?",
      answer:
        "CRUCIAL RULE: All official payment requests from GDG Jakarta will ONLY come from our verified email addresses:\n• info@gdgjakarta.org\n• info@gdgjakarta.com\n\nAny payment request originating from free Gmail accounts, WhatsApp messages, Telegram groups, or Instagram DMs is fraudulent and invalid. We will never ask you to transfer funds to personal unverified accounts.",
      order: 8,
      isActive: true,
    },
    {
      id: "security-suspicious-request",
      category: "security",
      categoryLabel: "Security & Fraud",
      question: "What should I do if I receive a suspicious message or payment request?",
      answer:
        "If you are ever in doubt or receive a suspicious request, do NOT send any funds or click suspicious links. Contact us immediately for clarification through our verified channels:\n• Email: info@gdgjakarta.org\n• Instagram DM: @gdgjakarta",
      order: 9,
      isActive: true,
    },
    {
      id: "official-channels",
      category: "security",
      categoryLabel: "Official Channels",
      question: "What are the official communication channels of GDG Jakarta?",
      answer:
        "All official information and communication from GDG Jakarta will come from our verified platforms only:\n• Email: info@gdgjakarta.org or info@gdgjakarta.com\n• Instagram: @gdgjakarta\n• Official Bevy Chapter: gdg.community.dev/gdg-jakarta",
      order: 10,
      isActive: true,
    },
    {
      id: "registration-how-to-rsvp",
      category: "registration",
      categoryLabel: "Registration",
      question: "How do I register for GDG Jakarta events?",
      answer:
        "You can browse upcoming events on our Events Directory or directly on the Google Developer Groups Bevy platform.\n\nClick on any event to see venue details, agenda, and speakers. Sign in with your Google account to RSVP. If a commitment fee is required, instructions will be sent to your registered email from info@gdgjakarta.org.",
      order: 11,
      isActive: true,
    },
    {
      id: "registration-qr-ticket",
      category: "registration",
      categoryLabel: "Registration",
      question: "Do I need a ticket or QR code to check in at the venue?",
      answer:
        "Yes. Once your registration is confirmed, your digital ticket with a unique check-in QR code will be available under your Member Dashboard in the 'My Events' tab, and also sent to your email.\n\nPlease keep the QR code ready on your phone or printed out for our volunteers to scan at the entrance door.",
      order: 12,
      isActive: true,
    },
    {
      id: "general-who-can-join",
      category: "general",
      categoryLabel: "General",
      question: "Who can attend GDG Jakarta events?",
      answer:
        "Everyone interested in technology is welcome! GDG Jakarta is an inclusive developer community open to software engineers, students, designers, data scientists, product managers, and tech hobbyists regardless of background or experience level.\n\nAll participants are expected to adhere to the official Google Community Guidelines.",
      order: 13,
      isActive: true,
    },
    {
      id: "general-speaker-volunteer",
      category: "general",
      categoryLabel: "General",
      question: "How can I become a speaker or volunteer for GDG Jakarta?",
      answer:
        "We are always looking for passionate speakers to share knowledge and volunteers to help make our events successful!\n\nWe regularly post Call for Speakers (CFS) and Call for Volunteers (CFV) links on our Instagram @gdgjakarta. You can also email your proposal directly to info@gdgjakarta.org.",
      order: 14,
      isActive: true,
    },
  ],
  contact: {
    title: "Still have questions or doubts?",
    description:
      "Can't find what you are looking for, or received a suspicious message? Our volunteer organizer team is ready to assist you.",
    email: "info@gdgjakarta.org",
    instagram: "@gdgjakarta",
  },
};

export const DEFAULT_PARTNERSHIP_CONTENT: PartnershipContent = {
  hero: {
    badge: "Brand Collaboration & Sponsorship",
    title: "Where AI Builders Come Together",
    description:
      "Connect your brand with over 15,600+ passionate software engineers, tech leads, system architects, and AI builders in Jakarta. Elevate your technology, launch new APIs, hire senior engineering talent, and build authentic developer trust.",
    contactEmail: "hello@gdgjakarta.org",
    proposalDeckUrl: "https://drive.google.com/file/d/16ckV0DMGfGw21bqiHCcA9rwkrhmd1hAt/view?usp=sharing",
    stats: [
      { id: "stat-1", label: "Dev Community Members", value: "15.6K+" },
      { id: "stat-2", label: "Expected DevFest Attendees", value: "1,500+" },
      { id: "stat-3", label: "Community Activities", value: "133+" },
      { id: "stat-4", label: "Speakers & Mentors", value: "80+" },
    ],
  },
  whyUs: [
    {
      id: "why-1",
      iconName: "Compass",
      title: "At the Center of Indonesia's Tech Capital",
      badge: "Direct Reach",
      description:
        "Jakarta is the vibrant heartbeat of Southeast Asian tech. Partnering with GDG Jakarta connects your brand directly with 15.6K+ developers, tech leads, system architects, and startup founders actively building Indonesia's digital products.",
    },
    {
      id: "why-2",
      iconName: "Lightbulb",
      title: "Turning Executors into High-Judgment Builders",
      badge: "Beyond AI Hype",
      description:
        "We move beyond passive prompt tutorials. GDG Jakarta provides an authentic technical platform focused on architectural judgment, code quality, engineering trade-offs, and scaling systems in an AI-first era.",
    },
    {
      id: "why-3",
      iconName: "Zap",
      title: "Hands-on Sandboxes & Real Production Adoption",
      badge: "Real Adoption",
      description:
        "Move beyond passive marketing. Our collaboration formats include silent headphone codelabs, live architecture teardowns, gamified venue challenges, and production deployment tracks that drive actual tool adoption.",
    },
    {
      id: "why-4",
      iconName: "Users",
      title: "Senior Engineering & Builder Talent Pipeline",
      badge: "Talent Pipeline",
      description:
        "With 53.6% engineering density and a core focus on practitioners with >2 years of experience, connect directly with senior software engineers, system architects, and engineering managers ready for complex challenges.",
    },
    {
      id: "why-5",
      iconName: "Award",
      title: "Global GDG Ecosystem Standard",
      badge: "High Standard",
      description:
        "As an official Google Developer Group chapter, we uphold world-class event production standards, transparent communication, vetted code-of-conduct compliance, and seamless execution with sponsor partners.",
    },
    {
      id: "why-6",
      iconName: "HeartHandshake",
      title: "Tailored to Your Strategic Milestones",
      badge: "Custom Activations",
      description:
        "Whether your goal is developer signups for an API, cloud infrastructure adoption, employer branding, or interactive booth activations, we craft partnership packages to maximize your specific ROI.",
    },
  ],
  devfest: {
    badge: "Flagship Annual Conference",
    title: "DevFest Jakarta 2026",
    description:
      "As Jakarta’s largest community-led tech conference, DevFest Jakarta 2026 moves beyond passive AI hype to bridge the AI reality gap. We provide an immersive, hands-on environment engineered to turn tactical executors into high-judgment builders equipped to design, secure, and scale technology in an AI-first era.",
    highlights: [
      { id: "h-1", label: "Expected Attendees", value: "1,500+ Hybrid" },
      { id: "h-2", label: "Conference Date", value: "Sun, 1 Nov 2026" },
      { id: "h-3", label: "Event Hours", value: "09:00 - 18:00 WIB" },
      { id: "h-4", label: "Practitioner Focus", value: ">2 YOE Builders (53.6%)" },
    ],
    tracks: [
      "Gemini & Generative AI Architecture",
      "Cloud Infrastructure, DevOps & Scalability",
      "Android, Flutter & Cross-Platform Systems",
      "Modern Web & High-Performance Frontend",
      "AI Security & Agent Evaluation Pipelines",
    ],
  },
  formats: [
    {
      id: "fmt-1",
      iconName: "Rocket",
      title: "Main Stage Conference",
      tag: "Inspiring AI Builders",
      description:
        "Central learning experience where industry leaders, practitioners, and innovators share how products are built, systems are secured, and businesses are scaled in the AI era.",
      deliverables: [
        "Mainstage opening keynote address & executive panel discussions",
        "Technical deep dives on AI behavior, reasoning, and system architecture",
        "Executive panels on how organizations adopt AI responsibly",
        "Interactive Q&A and community audience engagement",
      ],
    },
    {
      id: "fmt-2",
      iconName: "Laptop",
      title: "Focused Silent Workshops",
      tag: "Learn by Building",
      description:
        "Transforms learning into an immersive headphone-based environment with 30–40 participants per session, guided coding, and dedicated technical facilitators.",
      deliverables: [
        "Exclusive headphone-based immersive lab room (30–40 seats)",
        "Dedicated facilitators providing on-site technical support",
        "Live coding with guided production-ready exercises",
        "Official Certificate of Participation upon completion",
      ],
    },
    {
      id: "fmt-3",
      iconName: "Presentation",
      title: "Mini Talks & Lightning Sessions",
      tag: "Bite-Sized Insights",
      description:
        "Short, engaging 10–15 minute presentations introducing emerging ideas, CFP-driven community stories, and approachable technical lessons located within the public event space.",
      deliverables: [
        "10–15 minute lightning sessions on emerging technical & career topics",
        "Community CFP-driven speakers and partner showcase slots",
        "Open audience flow within the main exhibition area",
        "High-engagement accessible format for spontaneous discussions",
      ],
    },
    {
      id: "fmt-4",
      iconName: "Users",
      title: "Thematic Networking Spot",
      tag: "Conversations into Connections",
      description:
        "A dedicated networking space powered by rotating digital signage discussion prompts on TV screens that evolve throughout the day to foster peer learning and cross-functional collaboration.",
      deliverables: [
        "Guided conversation prompts displayed on TV digital signage",
        "Open networking area for attendees, speakers, and partner teams",
        "Cross-functional matchmaking (Engineering, Product, Founders)",
        "Meaningful professional connections beyond traditional mingling",
      ],
    },
    {
      id: "fmt-5",
      iconName: "Terminal",
      title: "Road to DevFest Workshop Series",
      tag: "Pre-Event Build Track",
      description:
        "A chain of 3–4 intensive workshop sessions (100 participants/session) in October 2026 guiding builder teams through conceptualizing, building, shipping to production, and pitching to tech recruiters.",
      deliverables: [
        "4-stage path: Conceptualizing, Building, Ship to Prod, Pitch Perfect",
        "Required deliverables: Live deployed URL/APK, GitHub repo & Architecture brief",
        "Direct talent pipeline & insights from leading tech recruiters",
        "Hands-on mentorship from Google Developer Experts (GDEs)",
      ],
    },
    {
      id: "fmt-6",
      iconName: "Flame",
      title: "Gamified Venue Activations & Quizzes",
      tag: "Meaningful Experiences",
      description:
        "An event-wide engagement program that encourages attendees to explore every corner of the venue while interacting with both the community and partner brands.",
      deliverables: [
        "Venue-wide QR Code Hunt and interactive missions",
        "Partner product trivia & technical algorithmic quizzes",
        "Mission cards, sticker collection challenges & passport stamps",
        "Point-based rewards redeemable for exclusive merchandise and prizes",
      ],
    },
  ],
  benefits: [
    {
      id: "ben-1",
      iconName: "MonitorCheck",
      title: "Brand-Led Activations & Interactive Showcases",
      category: "Developer Acquisition",
      points: [
        "Dedicated brand booth space (up to 4m x 3m) in prime exhibition hall for product demos and developer conversations",
        "Opportunity to host interactive mini-games, algorithmic puzzles, AI playground sandboxes, and developer challenges",
        "Distribution of trial credits, developer onboarding vouchers, and platform documentation",
        "Immediate feedback and testing directly from practicing software engineers and tech architects",
      ],
    },
    {
      id: "ben-2",
      iconName: "Megaphone",
      title: "Stage Authority & Thought Leadership",
      category: "Brand Prominence",
      points: [
        "Main Stage titling or dedicated breakout session titling opportunities",
        "Speaking opportunities for your technical leads or engineering executives (aligned with technical criteria)",
        "Sponsor video looping (up to 2 mins) and brand promotion time on stage (up to 10 mins)",
        "Ad-libs by professional MCs during stage idle intervals (min 2 times)",
      ],
    },
    {
      id: "ben-3",
      iconName: "Briefcase",
      title: "Tech Talent & Recruitment Pipeline",
      category: "Talent Acquisition",
      points: [
        "Direct access to 1,500+ attendees with 53.6% engineering density and >2 YOE practitioner core focus",
        "Promote engineering roles through hiring campaigns, career showcase booths, and talent lead collection",
        "Dedicated career lounge and internship showcase opportunities",
        "Direct engagement with student builders, senior engineers, and engineering managers",
      ],
    },
    {
      id: "ben-4",
      iconName: "Users2",
      title: "Multi-Channel Digital & Physical Visibility",
      category: "Long-Term Resonance",
      points: [
        "Giant, large, or medium brand visibility across event banners, stage backdrops, printings, and event web page",
        "Dedicated social media posts & stories on GDG Jakarta Instagram (17.5K+ followers, 73.2K+ monthly views)",
        "Prominent feature mentions in GDG Jakarta official newsletters (min 2 times)",
        "Brand merchandise placement inside attendee kits and welcome packs",
      ],
    },
  ],
  tiers: [
    {
      id: "tier-diamond",
      name: "Diamond",
      popular: false,
      description: "",
      slots: "",
      highlights: [
        "Main Stage Titling",
        "Speaking Opportunities*\n(the title have to meet our criteria)",
        "Sponsor’s Video Looping\n(max 2 mins)",
        "Sponsor’s Brand Promotion\n(max 10 mins)",
        "Brand Booth Space (4m x 3m)",
        "Brand’s Merchandise Placement",
        "Giant Brand Visibility",
        "All Silver’s Benefits",
      ],
    },
    {
      id: "tier-platinum",
      name: "Platinum",
      popular: false,
      description: "",
      slots: "",
      highlights: [
        "Dedicated Session Titling",
        "Speaking Opportunities*\n(the title have to meet our criteria)",
        "Sponsor’s Video Looping\n(max 2 mins)",
        "Brand Booth Space (3m x 2m)",
        "Brand’s Merchandise Placement",
        "Large Brand Visibility",
        "All Silver’s Benefits",
      ],
    },
    {
      id: "tier-gold",
      name: "Gold",
      popular: false,
      description: "",
      slots: "",
      highlights: [
        "Speaking Opportunities *\n(the title have to meet our criteria)",
        "Brand Booth Space (2m x 2m)",
        "Brand’s Merchandise Placement",
        "Medium Brand Visibility",
        "All Silver’s Benefits",
      ],
    },
    {
      id: "tier-silver",
      name: "Silver",
      popular: false,
      description: "",
      slots: "",
      highlights: [
        "Brand’s Merchandise Placement",
        "Small Brand Visibility",
        "Ad-Libs in every idle\n(min 2 times)",
        "Dedicated Social Media Content\n(in our Instagram’s post & stories)",
        "GDG Jakarta’s Newsletter\n(min 2 times)",
      ],
    },
  ],
  faqs: [
    {
      id: "sp-faq-1",
      question: "When and where will DevFest Jakarta 2026 take place?",
      answer:
        "DevFest Jakarta 2026 is scheduled for Sunday, 1 November 2026, from 09:00 to 18:00 WIB. The conference is a hybrid event expected to bring together 1,500+ participants, with TMII entrance tickets and event merchandise included for in-person attendees.",
    },
    {
      id: "sp-faq-2",
      question: "What is Road to DevFest 2026 and how can brands participate?",
      answer:
        "Road to DevFest is a 4-stage workshop series taking place in October 2026 with 3–4 sessions (100 participants per session). The program guides builder teams from conceptualizing to shipping live to production and pitching to tech talent recruiters. Partners can co-host workshop sessions, provide cloud/API credits, or participate as talent judges.",
    },
    {
      id: "sp-faq-3",
      question: "What are the requirements for speaking opportunities in Diamond, Platinum, and Gold tiers?",
      answer:
        "Speaking slots must align with GDG Jakarta's technical criteria. Rather than promotional sales pitches, sessions focus on architectural judgment, production challenges, code quality, engineering trade-offs, and practical lessons in building and scaling technology in an AI-first era.",
    },
    {
      id: "sp-faq-4",
      question: "How do we receive the full DevFest 2026 sponsorship proposal deck?",
      answer:
        "Simply send an email to hello@gdgjakarta.org, message our partnership team via (+62) 821-2488-5424 (Anggi Maisa H.), or submit the quick inquiry form on this page. Our partnership team will respond within 24–48 hours with our complete deck, floor plan, and activation details.",
    },
    {
      id: "sp-faq-5",
      question: "Can we collaborate on custom developer activations or workshops?",
      answer:
        "Yes! We welcome custom collaborations such as co-hosting Road to DevFest workshops, branded hackathons, and interactive demo sandboxes. Reach out to our team to discuss customized activations.",
    },
    {
      id: "sp-faq-6",
      question: "Can you provide official invoices and receipts for corporate compliance?",
      answer:
        "Yes, GDG Jakarta provides complete corporate paperwork, partnership agreements, itemized receipts, and tax documentation necessary for your legal, finance, and procurement departments.",
    },
  ],
  contact: {
    heading: "Interested to Collaborate with Us?",
    subheading:
      "Let’s elevate the community together. Connect with our partnership team to explore tailored opportunities for DevFest Jakarta 2026.",
    contactEmail: "hello@gdgjakarta.org",
    instagramUrl: "https://instagram.com/gdgjakarta",
    contactPerson: "Anggi Maisa H.",
    phoneOrWhatsapp: "(+62) 821-2488-5424",
    interestOptions: [
      "DevFest Jakarta 2026 - Diamond",
      "DevFest Jakarta 2026 - Platinum",
      "DevFest Jakarta 2026 - Gold",
      "DevFest Jakarta 2026 - Silver",
      "Road to DevFest Workshop Series Co-Host",
      "Brand-Led Interactive Activation or Booth",
      "Custom Bespoke Collaboration",
    ],
  },
};
