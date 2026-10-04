import { BadgeCheck, Briefcase, Megaphone, MonitorCheck, Share2, Users2 } from "lucide-react";

interface BenefitCard {
  icon: typeof MonitorCheck;
  title: string;
  category: string;
  points: string[];
}

const BENEFIT_CARDS: BenefitCard[] = [
  {
    icon: MonitorCheck,
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
    icon: Megaphone,
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
    icon: Briefcase,
    title: "Elite Talent Pipeline & Recruitment",
    category: "Talent Acquisition",
    points: [
      "Targeted access to 1,000+ practicing developers ranging from mid-level to principal engineers",
      "Promote your open engineering, product, and leadership roles through community boards and badges",
      "Dedicated recruitment desk or hiring lounge options to conduct on-site informal talent chats",
      "Direct employer branding spotlighting your company's tech stack and engineering culture",
    ],
  },
  {
    icon: Share2,
    title: "Digital Multi-Channel Exposure",
    category: "Digital Reach",
    points: [
      "Dedicated sponsor announcement posts across GDG Jakarta Instagram, LinkedIn, and Telegram channels",
      "Featured placement in event blast newsletters sent to thousands of verified developer subscribers",
      "Permanent logo listing and clickable link on official GDG Jakarta website and Bevy platform",
      "Post-event recap mentions with high-resolution photography and metrics summary",
    ],
  },
  {
    icon: BadgeCheck,
    title: "Tangible Brand Immersion & Swag",
    category: "Physical Touchpoints",
    points: [
      "Insert company promotional flyers, stickers, or developer survival gifts inside all attendee tote bags",
      "Exclusive co-branding on event attendee badges, conference lanyards, or registration booth counters",
      "Branded booth game prizes or giveaway sponsorships that drive high organic social sharing",
      "Official partner plaque and framed token of appreciation presented by community leadership",
    ],
  },
  {
    icon: Users2,
    title: "Executive Networking & VIP Access",
    category: "VIP Privileges",
    points: [
      "Complimentary VIP full-access passes for your engineering, DevRel, and executive team members",
      "Exclusive access to the VIP Speakers & Organizers Lounge for high-level industry networking",
      "Private introductions to Google Developer Experts (GDEs), community leaders, and guest speakers",
      "Pre-event partner coordination and dedicated concierge liaison throughout event day",
    ],
  },
];

export function PartnershipBenefits() {
  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 font-medium text-xs"
          style={{
            borderColor: "var(--theme-border)",
            backgroundColor: "var(--theme-bg-subtle)",
            color: "var(--theme-text)",
          }}
        >
          <BadgeCheck className="size-3.5" style={{ color: "var(--theme-primary)" }} />
          <span>Measurable Value & ROI</span>
        </div>

        <h2 className="mt-4 font-bold text-2xl tracking-tight sm:text-4xl text-foreground">
          What Will Your Brand Get?
        </h2>
        <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
          Tangible, high-impact deliverables engineered to elevate your brand presence, acquire developer users, and
          attract top engineering talent.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {BENEFIT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-xs transition-all duration-300 hover:shadow-md"
              style={{
                borderColor: "var(--theme-border)",
              }}
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
                    {card.category}
                  </span>
                </div>

                <h3 className="mt-4 font-bold text-foreground text-lg">{card.title}</h3>

                <ul className="mt-4 space-y-2.5">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-muted-foreground text-xs leading-relaxed">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--theme-primary)]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
