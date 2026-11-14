"use client";

import Link from "next/link";

import { ArrowRight, Award, Compass, HeartHandshake, Lightbulb, Users, Zap } from "lucide-react";

import { usePartnershipContent } from "@/lib/content/hooks";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Compass,
  Lightbulb,
  Zap,
  Users,
  Award,
  HeartHandshake,
};

const DEFAULT_CARD_ACTIONS: Record<number, { text: string; url: string }> = {
  0: { text: "Explore Community Reach", url: "#tiers" },
  1: { text: "View Conference Sessions", url: "#featured-event" },
  2: { text: "See Collaboration Formats", url: "#formats" },
  3: { text: "Explore Talent Activations", url: "#deliverables" },
  4: { text: "View Chapter Trust & Sponsors", url: "#sponsors" },
  5: { text: "Request Custom Proposal", url: "#inquiry" },
};

export function PartnershipWhyUs() {
  const { content } = usePartnershipContent();
  const visibleWhyUs = content.whyUs.filter((item) => item.isActive !== false);

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
        {visibleWhyUs.map((item, idx) => {
          const Icon = ICON_MAP[item.iconName] || Zap;
          const fallbackAction = DEFAULT_CARD_ACTIONS[idx] || {
            text: "Explore opportunities",
            url: "#tiers",
          };
          const resolvedActionText =
            item.actionText &&
            item.actionText !== "Designed for developer resonance →" &&
            item.actionText !== "Designed for developer resonance"
              ? item.actionText
              : fallbackAction.text;
          const resolvedActionUrl = item.actionUrl || fallbackAction.url;

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
                {resolvedActionUrl ? (
                  <Link
                    href={resolvedActionUrl}
                    className="inline-flex items-center gap-1.5 font-medium text-[13px] text-[var(--theme-primary)] transition-colors hover:underline group-hover:text-[var(--theme-primary)]"
                  >
                    <span>{resolvedActionText}</span>
                    <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-medium text-[13px] text-[var(--theme-primary)]">
                    <span>{resolvedActionText}</span>
                    <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
