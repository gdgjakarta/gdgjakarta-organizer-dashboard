import { Bot, Cloud, Cpu, Globe2, Smartphone, Sparkles, Users } from "lucide-react";

export function PartnershipDevfest() {
  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div
        className="relative overflow-hidden rounded-[2.5rem] border p-8 sm:p-12 lg:p-16 shadow-xl"
        style={{
          backgroundColor: "var(--theme-bg-subtle)",
          borderColor: "var(--theme-border)",
        }}
      >
        {/* Ambient Top Glow */}
        <div
          className="pointer-events-none absolute -top-32 right-0 size-96 rounded-full opacity-25 blur-3xl"
          style={{
            background: "radial-gradient(circle, var(--theme-primary) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: DevFest Narrative */}
          <div className="lg:col-span-7 space-y-6">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 font-medium text-xs shadow-xs"
              style={{
                borderColor: "var(--theme-border)",
                backgroundColor: "var(--background)",
                color: "var(--theme-text)",
              }}
            >
              <Sparkles className="size-3.5" style={{ color: "var(--theme-primary)" }} />
              <span>Flagship Community Event</span>
            </div>

            <h2 className="font-extrabold text-3xl tracking-tight sm:text-4xl lg:text-5xl leading-tight">
              DevFest Jakarta 2026
            </h2>

            <p className="text-foreground/80 text-sm sm:text-base leading-relaxed">
              DevFest is our marquee annual developer conference organized globally by Google Developer Groups. In
              Jakarta, DevFest represents the largest gathering of Google developers, open-source contributors, tech
              executives, and engineers in the country.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border bg-background/80 p-4 backdrop-blur-xs">
                <div className="flex items-center gap-2.5 font-bold text-foreground text-sm">
                  <Cpu className="size-4 text-[var(--theme-primary)]" />
                  <span>1,000+ Participants</span>
                </div>
                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                  Developers, tech leads, system architects, founders, and engineering managers under one roof.
                </p>
              </div>

              <div className="rounded-xl border bg-background/80 p-4 backdrop-blur-xs">
                <div className="flex items-center gap-2.5 font-bold text-foreground text-sm">
                  <Globe2 className="size-4 text-[var(--theme-primary)]" />
                  <span>Multi-Track Program</span>
                </div>
                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                  Concurrent tracks covering AI, Cloud, Mobile, Web, and Developer Productivity.
                </p>
              </div>
            </div>

            {/* Focus Tracks Pill Grid */}
            <div className="pt-2">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider block mb-3">
                DevFest 2026 Core Technology Tracks:
              </span>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
                  <Bot className="size-3.5 text-blue-600 dark:text-blue-400" />
                  Generative AI & Gemini
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
                  <Cloud className="size-3.5 text-red-600 dark:text-red-400" />
                  Google Cloud & Kubernetes
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
                  <Smartphone className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Android & Modern Kotlin
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
                  <Globe2 className="size-3.5 text-amber-500" />
                  Modern Web & Chrome
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
                  <Cpu className="size-3.5 text-purple-600 dark:text-purple-400" />
                  Flutter & Multiplatform
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Audience Breakdown Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border bg-background p-6 sm:p-8 shadow-md space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-[var(--theme-primary)]" />
                  <h3 className="font-bold text-foreground text-base">Attendee Demographics</h3>
                </div>
                <span className="text-muted-foreground text-xs">Based on Past DevFest</span>
              </div>

              {/* Progress bars for demographics */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-foreground">Mid, Senior & Lead Software Engineers</span>
                    <span className="font-bold text-[var(--theme-primary)]">65%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--theme-primary)]" style={{ width: "65%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-foreground">CTOs, Tech Leads & Engineering Managers</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">18%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400" style={{ width: "18%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-foreground">Junior Engineers & Open-Source Builders</span>
                    <span className="font-bold text-amber-500">12%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: "12%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-foreground">Product Managers & Startup Founders</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">5%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: "5%" }} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground leading-relaxed">
                💡 <strong className="text-foreground font-semibold">High Purchasing & Technical Influence:</strong>{" "}
                Over 70% of attendees report having direct influence or input on tools, cloud services, and developer
                platforms adopted by their companies.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
