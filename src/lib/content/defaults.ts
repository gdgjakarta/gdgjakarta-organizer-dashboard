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
    title: "Empower Indonesia's Premier Developer Community",
    description:
      "Connect your brand with over 10,000+ passionate software engineers, tech leads, system architects, and tech innovators in Jakarta. Elevate your technology, launch new APIs, hire senior engineering talent, and build authentic developer trust.",
    contactEmail: "hello@gdgjakarta.org",
    proposalDeckUrl: "",
    stats: [
      { id: "stat-1", label: "Dev Community Members", value: "10,000+" },
      { id: "stat-2", label: "Annual DevFest Attendees", value: "1,000+" },
      { id: "stat-3", label: "Deep-Dive Tech Tracks", value: "15+" },
      { id: "stat-4", label: "Inclusive & Community Run", value: "100%" },
    ],
  },
  whyUs: [
    {
      id: "why-1",
      iconName: "Compass",
      title: "At the Center of Indonesia's Tech Capital",
      badge: "Direct Reach",
      description:
        "Jakarta is the vibrant heartbeat of Southeast Asian tech. Partnering with GDG Jakarta connects your brand directly with developers, tech leads, system architects, and startup founders actively building Indonesia's digital products.",
    },
    {
      id: "why-2",
      iconName: "Lightbulb",
      title: "Authentic Tech Credibility & Trust",
      badge: "Community-First",
      description:
        "Developers tune out traditional banner ads. GDG Jakarta provides an authentic, peer-to-peer developer platform where your tools, APIs, and cloud services are showcased through genuine utility, hands-on learning, and technical thought leadership.",
    },
    {
      id: "why-3",
      iconName: "Zap",
      title: "Interactive, Hands-on Engagements",
      badge: "Real Adoption",
      description:
        "Move beyond passive marketing. Our collaboration formats include dedicated codelabs, live architecture teardowns, gamified booth challenges, and developer hackathons that drive real product adoption.",
    },
    {
      id: "why-4",
      iconName: "Users",
      title: "Elite Engineering & DevRel Talent",
      badge: "Talent Pipeline",
      description:
        "Struggling to hire top-tier software engineers and engineering managers? Our community brings together both seasoned senior practitioners and hungry tech innovators eager to solve tough technical challenges.",
    },
    {
      id: "why-5",
      iconName: "Award",
      title: "Global GDG Ecosystem Standard",
      badge: "High Standard",
      description:
        "As an official Google Developer Group chapter, we uphold world-class event production standards, transparent communication, vetted code-of-conduct compliance, and seamless collaboration with our sponsor partners.",
    },
    {
      id: "why-6",
      iconName: "HeartHandshake",
      title: "Tailored to Your Strategic Goals",
      badge: "Custom Activations",
      description:
        "Whether your goal is developer signups for a new cloud service, developer advocacy, employer branding, or API launch awareness, we craft sponsorship packages to maximize your specific ROI.",
    },
  ],
  devfest: {
    badge: "Flagship Community Event",
    title: "DevFest Jakarta 2026",
    description:
      "DevFest is our marquee annual developer conference. Designed by developers for developers, it stands as one of the largest independent technology summits in Indonesia with dual keynotes, interactive hands-on labs, engineering panels, and an expansive technology expo floor.",
    highlights: [
      { id: "h-1", label: "Target Attendees", value: "1,000+ In-Person" },
      { id: "h-2", label: "Conference Tracks", value: "4 Parallel Stages" },
      { id: "h-3", label: "Expert Speakers", value: "30+ Industry Leads" },
      { id: "h-4", label: "Expo Floor Hours", value: "8 Hours Dedicated" },
    ],
    tracks: [
      "Generative AI & Machine Learning",
      "Cloud Architecture & DevOps",
      "Modern Web & Frontend Frameworks",
      "Android, Flutter & Cross-Platform",
      "Cybersecurity & Scalability",
    ],
  },
  formats: [
    {
      id: "fmt-1",
      iconName: "Rocket",
      title: "DevFest Jakarta 2026 (Flagship)",
      tag: "Annual Mega Conference",
      description:
        "Our premier annual conference gathering 1,000+ developers, tech leads, and innovators for a full day of multi-track keynotes, deep dive sessions, hands-on labs, and expansive expo floors.",
      deliverables: [
        "Mainstage keynote & lightning talk sessions",
        "Prime exhibition demo booth with live interactive kiosks",
        "Branded conference lanyards, badging & tote bags",
        "Executive networking & speaker lounge access",
      ],
    },
    {
      id: "fmt-2",
      iconName: "Laptop",
      title: "Hands-on Technical Codelabs & Workshops",
      tag: "High Adoption",
      description:
        "Empower developers to build directly with your SDK, cloud infrastructure, AI models, or APIs under the guided supervision of your developer advocates and our facilitators.",
      deliverables: [
        "Dedicated 2–3 hour hands-on classroom format",
        "Pre-event tutorial guides & code repository assets",
        "Direct trial accounts and credits distribution",
        "Live developer Q&A and technical feedback collection",
      ],
    },
    {
      id: "fmt-3",
      iconName: "Terminal",
      title: "Hackathons & Innovation Challenges",
      tag: "Project Showcase",
      description:
        "Host a dedicated challenge track or full hackathon where engineering teams solve real-world industry problems using your platform and product ecosystem.",
      deliverables: [
        "Custom sponsor challenge track & judging panel seat",
        "Showcase of winning projects & community presentations",
        "Developer trial usage spike during sprint period",
        "Co-branded awards, digital certificates & prizes",
      ],
    },
    {
      id: "fmt-4",
      iconName: "Presentation",
      title: "Monthly Meetups & Tech Talks",
      tag: "Continuous Engagement",
      description:
        "Stay top-of-mind throughout the year. Sponsor or co-host focused evening tech sessions on specific technologies like Android, Flutter, Google Cloud, AI/ML, and Modern Web.",
      deliverables: [
        "Targeted audience of 80–200 specialized engineers per event",
        "Speaker slot for your technical leads or DevRel champions",
        "Venue co-hosting or catering branding recognition",
        "Prominent mention in meetup recaps & social announcements",
      ],
    },
    {
      id: "fmt-5",
      iconName: "Flame",
      title: "Gamified Booth & Developer Activations",
      tag: "Expo Standout",
      description:
        "Make your brand the most talked-about spot at the event with engaging mini-games, algorithmic puzzles, claw machines, speed-coding faceoffs, or live coding battles.",
      deliverables: [
        "Turnkey interactive activation area with electricity & high-speed Wi-Fi",
        "High attendee foot-traffic & dwell time at your booth",
        "Leaderboards and live community challenge tracking",
        "Direct lead capture and dev community onboarding",
      ],
    },
    {
      id: "fmt-6",
      iconName: "Gift",
      title: "Community Merch & Swag Sponsorship",
      tag: "Lasting Impression",
      description:
        "Developers love high-quality, practical gear. Put your brand on premium community swag worn by engineers for months and years across tech offices.",
      deliverables: [
        "Co-branded premium hoodies, t-shirts, caps, or developer jackets",
        "Die-cut tech sticker packs, laptop sleeves, or lanyard badges",
        "Direct inclusion in attendees' registration welcome kits",
        "Unboxing moments & social media tag exposure",
      ],
    },
  ],
  benefits: [
    {
      id: "ben-1",
      iconName: "MonitorCheck",
      title: "Direct Product Showcase & Trial Adoption",
      category: "Developer Acquisition",
      points: [
        "Physical booth space in high-traffic exhibition hall for product demos and developer conversations",
        "Opportunity to distribute trial credits, API access keys, and developer onboarding vouchers",
        "Dedicated interactive session or code walkthrough demonstrating your platform's capabilities",
        "Immediate feedback directly from practicing developers, DevOps engineers, and architects",
      ],
    },
    {
      id: "ben-2",
      iconName: "Megaphone",
      title: "Stage Authority & Thought Leadership",
      category: "Brand Prominence",
      points: [
        "Mainstage keynote or dedicated breakout session speaking opportunity for your tech leads or executives",
        "Prominent logo placement on main stage backdrops, live stream screens, and digital displays",
        "Formal acknowledgement and video intro during opening and closing keynote ceremonies",
        "Co-branded post-event video recordings published on official GDG Jakarta community channels",
      ],
    },
    {
      id: "ben-3",
      iconName: "Briefcase",
      title: "Elite Talent Pipeline & Recruitment",
      category: "Talent Acquisition",
      points: [
        "Targeted access to 1,000+ practicing developers ranging from mid-level to principal engineers",
        "Promote your open engineering, product, and leadership roles through community boards and badges",
        "Dedicated recruitment desk or hiring lounge options to conduct on-site informal talent chats",
        "Direct access to opted-in attendee talent database and developer skill profiles",
      ],
    },
    {
      id: "ben-4",
      iconName: "Users2",
      title: "Year-Round Developer Community Trust",
      category: "Long-Term Resonance",
      points: [
        "Permanent sponsor logo presence on official GDG Jakarta Bevy community page",
        "Continuous visibility across 12+ monthly technical meetups and study jams throughout the year",
        "Endorsement and collaborative rapport with Google Developer Experts (GDEs) and community leads",
        "Featured spotlight articles and interviews highlighting your engineering team's achievements",
      ],
    },
  ],
  tiers: [
    {
      id: "tier-silver",
      name: "Silver Partner",
      badge: "Standard",
      popular: false,
      description: "Great for tech companies seeking high-value developer visibility and booth exhibition presence.",
      slots: "Limited Slots Available",
      highlights: [
        "Standard Expo Booth (3x2m) with power & Wi-Fi",
        "Logo on official website, event banners & screens",
        "1x Social media announcement post",
        "Company swag insert inside attendee welcome tote",
        "4x All-Access Conference Passes",
        "Post-event attendee analytics overview",
      ],
    },
    {
      id: "tier-gold",
      name: "Gold Partner",
      badge: "Most Popular",
      popular: true,
      description:
        "Ideal for brands wanting dedicated breakout stage presence, recruitment visibility, and premier booth placement.",
      slots: "5 Slots Only",
      highlights: [
        "Prime Expo Booth location with double developer frontage",
        "25-min Breakout Session speaking slot for your tech lead",
        "Dedicated Recruitment & Job Board promotion package",
        "Large logo placement on mainstage backdrop & live streams",
        "Dedicated sponsor shoutouts on Instagram & LinkedIn",
        "Swag & promotional flyer distribution in all bags",
        "8x All-Access Conference Passes + 2 VIP Lounge Passes",
      ],
    },
    {
      id: "tier-platinum",
      name: "Platinum / Title Partner",
      badge: "Flagship Lead",
      popular: false,
      description:
        "Maximum category exclusivity, opening keynote address, headline branding across all channels, and VIP hospitality.",
      slots: "2 Slots Exclusive",
      highlights: [
        "Premier Double Island Expo Booth at prime hall entrance",
        "20-min Mainstage Opening Keynote address to all attendees",
        "Headline co-branding on event name, website & lanyards",
        "Exclusive press release & multi-part social campaign",
        "Priority talent matching and resume drop database",
        "VIP Dinner & Speakers Lounge access for executives",
        "15x All-Access Conference Passes + 6 VIP Passes",
      ],
    },
    {
      id: "tier-community",
      name: "Community & In-Kind",
      badge: "In-Kind / Open",
      popular: false,
      description:
        "For cloud credits, venue hosting, hackathon prizes, student scholarships, or food & beverage sponsorships.",
      slots: "Open Opportunities",
      highlights: [
        "Custom brand attribution aligned with your contribution",
        "Logo on official website partner section",
        "Social media thank-you shoutout to our community",
        "Swag / trial credits distributed directly to participants",
        "2x All-Access Conference Passes",
        "Certificate of Community Appreciation",
      ],
    },
  ],
  faqs: [
    {
      id: "sp-faq-1",
      question: "How early should we confirm our sponsorship for DevFest Jakarta 2026?",
      answer:
        "We recommend confirming as early as possible. Premium tiers (Platinum & Gold) have strictly capped speaking slots and premier booth locations that are allocated on a first-come, first-served basis. Early confirmation also guarantees maximum duration of pre-event digital branding.",
    },
    {
      id: "sp-faq-2",
      question: "How do we receive the full DevFest 2026 sponsorship proposal deck and rate card?",
      answer:
        "Simply send an email to hello@gdgjakarta.org or submit the quick contact inquiry on this page. Our partnership team will respond within 24–48 hours with our official slide deck, floor plan, and pricing sheet.",
    },
    {
      id: "sp-faq-3",
      question: "Can our engineering team deliver a workshop or hands-on session?",
      answer:
        "Yes! We strongly encourage practical, hands-on technical sessions over sales pitches. As part of Gold and Platinum packages (or standalone workshop sponsorships), our content committee will collaborate with your engineering leads to ensure the session provides high technical value to attendees.",
    },
    {
      id: "sp-faq-4",
      question: "Can we provide cloud credits, software licenses, or developer gear instead of cash?",
      answer:
        "Yes, our Community & In-Kind Partnership tier accommodates product credits, developer tooling subscriptions, venue support, merchandise, and hackathon prizes. Get in touch with us to explore mutual value fits.",
    },
    {
      id: "sp-faq-5",
      question: "Can you provide official invoices and receipts for corporate compliance?",
      answer:
        "Yes, GDG Jakarta provides complete corporate paperwork, partnership agreements, itemized receipts, and tax documentation necessary for your finance and legal departments.",
    },
  ],
  contact: {
    heading: "Let’s Build Something Impactful Together!",
    subheading:
      "Ready to align your brand with Jakarta’s premier developer community? Drop us an email or send us a DM to receive our complete sponsorship proposal deck.",
    contactEmail: "hello@gdgjakarta.org",
    instagramUrl: "https://instagram.com/gdgjakarta",
    interestOptions: [
      "DevFest Jakarta 2026 - Platinum / Title Tier",
      "DevFest Jakarta 2026 - Gold Tier",
      "DevFest Jakarta 2026 - Silver Tier",
      "DevFest Jakarta 2026 - Community / In-Kind",
      "Technical Workshop or Hands-on Codelab",
      "Hackathon or Developer Challenge Track",
      "Custom Bespoke Activation",
    ],
  },
};
