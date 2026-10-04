import { Code, Flame, Gift, Laptop, Presentation, Rocket, Terminal } from "lucide-react";

interface CollaborationFormat {
  icon: typeof Rocket;
  title: string;
  tag: string;
  description: string;
  deliverables: string[];
}

const COLLABORATION_FORMATS: CollaborationFormat[] = [
  {
    icon: Rocket,
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
    icon: Laptop,
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
    icon: Terminal,
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
    icon: Presentation,
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
    icon: Flame,
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
    icon: Gift,
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
];

export function PartnershipFormats() {
  return (
    <section className="bg-muted/30 py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 font-medium text-xs"
            style={{
              borderColor: "var(--theme-border)",
              backgroundColor: "var(--background)",
              color: "var(--theme-text)",
            }}
          >
            <Code className="size-3.5" style={{ color: "var(--theme-primary)" }} />
            <span>Collaboration Formats</span>
          </div>

          <h2 className="mt-4 font-bold text-2xl tracking-tight sm:text-4xl text-foreground">
            What Can We Do Together?
          </h2>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
            Choose from proven event formats or combine them into a bespoke campaign that meets your developer relations
            and business goals.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {COLLABORATION_FORMATS.map((format) => {
            const Icon = format.icon;
            return (
              <div
                key={format.title}
                className="flex flex-col justify-between rounded-2xl border bg-background p-6 shadow-xs transition-all duration-300 hover:border-[var(--theme-primary)] hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className="flex size-11 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: "var(--theme-bg-subtle)",
                        color: "var(--theme-primary)",
                      }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-[11px] text-muted-foreground">
                      {format.tag}
                    </span>
                  </div>

                  <h3 className="mt-4 font-bold text-foreground text-lg">{format.title}</h3>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{format.description}</p>

                  <div className="mt-5 space-y-2">
                    <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
                      Included touchpoints:
                    </span>
                    <ul className="space-y-1.5 text-muted-foreground text-xs">
                      {format.deliverables.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--theme-primary)]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
