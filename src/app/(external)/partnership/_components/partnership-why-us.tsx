import { Award, Compass, HeartHandshake, Lightbulb, Users, Zap } from "lucide-react";

interface WhyUsItem {
  icon: typeof Zap;
  title: string;
  description: string;
  badge: string;
}

const WHY_US_ITEMS: WhyUsItem[] = [
  {
    icon: Compass,
    title: "At the Center of Indonesia's Tech Capital",
    badge: "Direct Reach",
    description:
      "Jakarta is the vibrant heartbeat of Southeast Asian tech. Partnering with GDG Jakarta connects your brand directly with developers, tech leads, system architects, and startup founders actively building Indonesia's digital products.",
  },
  {
    icon: Lightbulb,
    title: "Authentic Tech Credibility & Trust",
    badge: "Community-First",
    description:
      "Developers tune out traditional banner ads. GDG Jakarta provides an authentic, peer-to-peer developer platform where your tools, APIs, and cloud services are showcased through genuine utility, hands-on learning, and technical thought leadership.",
  },
  {
    icon: Zap,
    title: "Interactive, Hands-on Engagements",
    badge: "Real Adoption",
    description:
      "Move beyond passive marketing. Our collaboration formats include dedicated codelabs, live architecture teardowns, gamified booth challenges, and developer hackathons that drive real product adoption.",
  },
  {
    icon: Users,
    title: "Elite Engineering & DevRel Talent",
    badge: "Talent Pipeline",
    description:
      "Struggling to hire top-tier software engineers and engineering managers? Our community brings together both seasoned senior practitioners and hungry tech innovators eager to solve tough technical challenges.",
  },
  {
    icon: Award,
    title: "Global GDG Ecosystem Standard",
    badge: "High Standard",
    description:
      "As an official Google Developer Group chapter, we uphold world-class event production standards, transparent communication, vetted code-of-conduct compliance, and seamless collaboration with our sponsor partners.",
  },
  {
    icon: HeartHandshake,
    title: "Tailored to Your Strategic Goals",
    badge: "Custom Activations",
    description:
      "Whether your goal is developer signups for a new cloud service, developer advocacy, employer branding, or API launch awareness, we craft sponsorship packages to maximize your specific ROI.",
  },
];

export function PartnershipWhyUs() {
  return (
    <section className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 font-medium text-xs"
          style={{
            borderColor: "var(--theme-border)",
            backgroundColor: "var(--theme-bg-subtle)",
            color: "var(--theme-text)",
          }}
        >
          <span>Why Collaborate With GDG Jakarta</span>
        </div>

        <h2 className="mt-4 font-bold text-2xl tracking-tight sm:text-4xl text-foreground">
          How Collaboration with Us Actually Looks Like
        </h2>
        <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
          We don&apos;t just print logos on paper flyers. We partner with tech brands to create memorable, high-value
          touchpoints that resonate with engineers.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {WHY_US_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="group relative flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
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
                    {item.badge}
                  </span>
                </div>

                <h3 className="mt-4 font-semibold text-foreground text-lg transition-colors group-hover:text-[var(--theme-primary)]">
                  {item.title}
                </h3>

                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{item.description}</p>
              </div>

              <div className="mt-6 border-t pt-4">
                <span className="font-medium text-[12px] text-[var(--theme-primary)]">
                  Designed for developer resonance &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
