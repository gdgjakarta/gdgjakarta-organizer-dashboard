import Link from "next/link";

import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CommunityAccessSpotlight() {
  return (
    <section
      className="relative overflow-hidden border-y py-20 transition-colors duration-500 lg:py-28"
      style={{
        backgroundColor: "var(--theme-bg-subtle)",
        borderColor: "var(--theme-border)",
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 font-medium text-xs shadow-xs"
            style={{
              borderColor: "var(--theme-border)",
              backgroundColor: "var(--background)",
              color: "var(--theme-text)",
            }}
          >
            <Sparkles className="size-3.5" style={{ color: "var(--theme-primary)" }} />
            <span>Direct Community Access</span>
          </div>

          <h2 className="mt-4 font-bold text-[32px] leading-[1.1] tracking-tight sm:text-[44px] lg:text-[56px] text-foreground">
            Developers. Mentors. <br />
            <span style={{ color: "var(--theme-primary)" }}>Nothing in between.</span>
          </h2>

          <p className="mt-5 text-[15px] text-muted-foreground leading-relaxed sm:text-base">
            No paywalls or algorithms between you and your technical growth. GDG Jakarta gives you direct, unmediated
            access to real engineering discussions, collaborative code reviews, and live Q&amp;A sessions with Google
            Developer Experts.
          </p>

          <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
            {[
              {
                bold: "Accessible & community-first",
                desc: "Most meetups and technical workshops are 100% free to attend, with select flagship summits at accessible community pricing.",
              },
              {
                bold: "Direct networking",
                desc: "Connect directly with local engineering leads, tech founders, and core maintainers.",
              },
              {
                bold: "Instant RSVP passes",
                desc: "Instant digital RSVP passes with fast QR check-in and on-site badge printing at venues.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col rounded-2xl border bg-card/60 p-5 shadow-2xs backdrop-blur-xs transition-colors"
                style={{ borderColor: "var(--theme-border)" }}
              >
                <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                  <CheckCircle2 className="size-4 shrink-0" style={{ color: "var(--theme-primary)" }} />
                  <span>{item.bold}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Button
              asChild
              size="lg"
              className="group h-12 rounded-full px-8 font-medium text-[14px] shadow-[var(--theme-shadow)] transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: "var(--theme-primary)",
                color: "var(--theme-primary-foreground)",
              }}
            >
              <Link href="/events" className="inline-flex items-center gap-2">
                <span>Explore Upcoming Events</span>
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
