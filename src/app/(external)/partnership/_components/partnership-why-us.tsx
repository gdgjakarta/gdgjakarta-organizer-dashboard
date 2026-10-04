"use client";

import { Award, Compass, HeartHandshake, Lightbulb, Users, Zap } from "lucide-react";

import { usePartnershipContent } from "@/lib/content/hooks";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Compass,
  Lightbulb,
  Zap,
  Users,
  Award,
  HeartHandshake,
};

export function PartnershipWhyUs() {
  const { content } = usePartnershipContent();

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
        {content.whyUs.map((item, idx) => {
          const Icon = ICON_MAP[item.iconName] || Zap;
          return (
            <div
              key={item.id || item.title || idx}
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
