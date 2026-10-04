"use client";

import { Code, Flame, Gift, Laptop, Presentation, Rocket, Terminal } from "lucide-react";

import { usePartnershipContent } from "@/lib/content/hooks";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Laptop,
  Terminal,
  Presentation,
  Flame,
  Gift,
};

export function PartnershipFormats() {
  const { content } = usePartnershipContent();
  const visibleFormats = content.formats.filter((format) => format.isActive !== false);

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
          {visibleFormats.map((format, idx) => {
            const Icon = ICON_MAP[format.iconName] || Rocket;
            return (
              <div
                key={format.id || format.title || idx}
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
                      {format.deliverables?.map((item, dIdx) => (
                        <li key={dIdx} className="flex items-start gap-2">
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
