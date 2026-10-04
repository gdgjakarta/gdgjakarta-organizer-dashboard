"use client";

import { BadgeCheck, Briefcase, Megaphone, MonitorCheck, Share2, Users2 } from "lucide-react";

import { usePartnershipContent } from "@/lib/content/hooks";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MonitorCheck,
  Megaphone,
  Briefcase,
  Users2,
  BadgeCheck,
  Share2,
};

export function PartnershipBenefits() {
  const { content } = usePartnershipContent();

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
          <span>Deliverables & Value</span>
        </div>

        <h2 className="mt-4 font-bold text-2xl tracking-tight sm:text-4xl text-foreground">
          What Will Your Brand Get?
        </h2>
        <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
          Tangible, high-impact deliverables engineered to elevate your brand presence, acquire developer users, and
          attract top engineering talent.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {content.benefits.map((benefit, idx) => {
          const Icon = ICON_MAP[benefit.iconName] || MonitorCheck;
          return (
            <div
              key={benefit.id || benefit.title || idx}
              className="flex flex-col justify-between rounded-2xl border bg-card p-6 sm:p-8 shadow-xs transition-all duration-300 hover:border-[var(--theme-primary)] hover:shadow-md"
              style={{
                borderColor: "var(--theme-border)",
              }}
            >
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-11 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: "var(--theme-bg-subtle)",
                      color: "var(--theme-primary)",
                    }}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <span className="font-medium text-[11px] uppercase tracking-wider text-[var(--theme-primary)]">
                      {benefit.category}
                    </span>
                    <h3 className="font-bold text-foreground text-lg sm:text-xl">{benefit.title}</h3>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {benefit.points?.map((point, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-3">
                      <div
                        className="mt-1.5 size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: "var(--theme-primary)" }}
                      />
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
