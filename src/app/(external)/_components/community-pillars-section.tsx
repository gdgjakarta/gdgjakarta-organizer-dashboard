import { Cpu, Globe, Terminal } from "lucide-react";

const PILLARS = [
  {
    icon: Terminal,
    tag: "Practical Skills",
    title: "Hands-on Code Labs",
    description:
      "Deep dive into code. Experience hands-on technical sessions covering Gemini API, Google Cloud Vertex AI, Android Jetpack Compose, and Next.js.",
  },
  {
    icon: Globe,
    tag: "Conferences",
    title: "Flagship Summits",
    description:
      "Experience marquee annual events like DevFest Jakarta, Google I/O Extended, and Cloud Community Days with multi-track presentations.",
  },
  {
    icon: Cpu,
    tag: "Ecosystem",
    title: "Direct Mentorship",
    description:
      "Connect with certified Google Developer Experts (GDEs), Women Techmakers leaders, and senior architects in Jakarta's tech scene.",
  },
];

export function CommunityPillarsSection() {
  return (
    <section className="container mx-auto px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <span
          className="font-medium text-xs uppercase tracking-widest transition-colors duration-500"
          style={{ color: "var(--theme-text)" }}
        >
          What We Do
        </span>
        <h2 className="mt-3 font-medium text-[32px] leading-[1.1] tracking-tight sm:text-[44px] lg:text-[59.33px]">
          Complete developer empowerment.
        </h2>
        <p className="mt-4 text-[14px] text-muted-foreground leading-relaxed">
          GDG Jakarta is built by developers, for developers. Whether you are writing your first lines of code or
          leading an engineering team, our programs accelerate your growth.
        </p>
      </div>

      {/* 3 Pillars Grid */}
      <div className="mt-16 grid gap-8 md:grid-cols-3">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon;

          return (
            <div
              key={pillar.title}
              className="group flex flex-col justify-between rounded-[2rem] border bg-card p-8 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
              style={{
                borderColor: "var(--theme-border)",
              }}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className="flex size-14 items-center justify-center rounded-2xl transition-colors duration-300"
                    style={{
                      backgroundColor: "var(--theme-bg-subtle)",
                      color: "var(--theme-primary)",
                    }}
                  >
                    <Icon className="size-7" />
                  </div>
                  <span
                    className="rounded-full px-3 py-1 font-medium text-xs"
                    style={{
                      backgroundColor: "var(--theme-bg-subtle)",
                      color: "var(--theme-text)",
                    }}
                  >
                    {pillar.tag}
                  </span>
                </div>

                <h3 className="mt-6 font-medium text-[22.66px] tracking-tight transition-colors group-hover:text-[var(--theme-text)]">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-muted-foreground text-[14px] leading-relaxed">{pillar.description}</p>
              </div>

              <div className="mt-8 border-t pt-4" style={{ borderColor: "var(--theme-border)" }}>
                <span
                  className="inline-flex items-center font-medium text-[14px] transition-colors group-hover:text-[var(--theme-text)]"
                  style={{ color: "var(--theme-text)" }}
                >
                  Learn with GDG Jakarta →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
